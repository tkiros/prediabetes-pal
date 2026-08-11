# Revora ↔ OpenAI: Key, Model, Cost & Process

**Last updated:** 2026-06-20
**Scope:** How Revora calls OpenAI, which key/model to use, what it costs, and the levers that move cost.
**Pricing source:** third-party trackers (June 2026) — **confirm against OpenAI's official pricing page before relying on exact figures.**

---

## 1. Which API key

A standard OpenAI **platform API secret key** — not a ChatGPT subscription.

| Item | Detail |
|---|---|
| Env var | `OPENAI_API_KEY` |
| Key type | `sk-proj-...` (project-scoped, recommended) or `sk-...` |
| Account | OpenAI platform account with active billing/credits; newer GPT-5.x models may need a **verified org** |
| Capabilities | Access to the **Responses API** + **Structured Outputs (strict `json_schema`)** for the chosen model |
| Where | Vercel env vars in **Preview + Production**, plus `.env.local` for dev/eval |
| Exposure | **Server-only.** `lib/pal/openai-client.ts` throws if `window` is defined; there is no client-side OpenAI path |

**Add a backstop:** set a **monthly budget/usage limit** on the OpenAI project. Independent of the app's WAF rate limit, Edge Config kill switch, and ~2,000-checks/24h threshold.

---

## 2. How the request flows

```
User form {food, a1c}  ──POST /api/check──┐
                                          ▼
[1] middleware.ts  ── pre-model PAUSE GATE (Edge Config)  → paused? 503, no spend
    (Vercel WAF rate-limits at the edge, before app code runs)
                                          ▼
[2] route.ts → checkFood()  (lib/pal/service.ts)
                                          ▼
[3] DETERMINISTIC PRECHECKS (no model call):
      A1C band routing (out-of-scope short-circuits) · non-food · ambiguous
      → many requests never reach OpenAI
                                          ▼
[4] buildRevoraPrompt() → instructions + input
                                          ▼
[5] openai-client.ts → responses.create({
        model, instructions, input,
        store: false,                          ← no provider-side retention
        [reasoning: { effort: <PAL_REASONING_EFFORT> }]  ← OPTIONAL cost lever; OMITTED by default
        text.format = json_schema strict        ← structured output
    })
      retries once on contract/JSON failure (MAX_MODEL_ATTEMPTS = 2), then fails closed
                                          ▼
[6] Zod-validate → postprocess() conservative floors (safety over trust)
                                          ▼
[7] emitSafeEvent() — coarse telemetry only (no raw food/A1C/prompt/output)
                                          ▼
[8] Rendered inline (result | clarify | not_food | out_of_scope | retry)
```

The model is the **last** resort. Deterministic gates handle pauses, abuse, out-of-scope A1C, non-food, and ambiguity before any token is spent — so **model volume < request volume**.

`store: false` means OpenAI does not persist the response as app state; provider-side abuse-monitoring logs may still retain prompts/responses ~30 days (documented in `docs/privacy/data-flow.md`, not overclaimed as zero retention).

---

## 3. Model selection

**Default:** `gpt-5.4-mini` (`openai-client.ts` → `DEFAULT_PAL_MODEL`), overridable via **`PAL_MODEL`** (env, no code change).

Pricing (June 2026, per 1M tokens — verify on OpenAI's official page):

| Model | Input | Output | Cached input | Note |
|---|---|---|---|---|
| `gpt-5.5` | $5.00 | $30.00 | $1.25 | Flagship; overkill here |
| `gpt-5.4` | $2.50 | $15.00 | — | Mid frontier |
| **`gpt-5.4-mini`** *(default)* | $0.75 | $4.50 | — | Current |
| `gpt-5.5-mini` | $0.50 | $2.00 | $0.125 | Newer + cheaper both axes |
| `gpt-5.4-nano` | $0.20 | $1.25 | — | Cheapest |

**Recommendation:** `gpt-5.5-mini` is newer and cheaper on both axes than the current default; `gpt-5.4-nano` is cheaper still. But this is a **safety-critical classifier** with a *zero-harmful-SAFE* launch gate — **pick on the eval, not the price.** Run the eval across candidates (flip `PAL_MODEL`) and choose the **cheapest model that holds zero-harmful-SAFE** on the fixtures. Any candidate must support the Responses API + strict `json_schema` (all GPT-5.x mini/nano do).

---

## 4. Cost

**Per-call footprint** (estimated from `prompt.ts` + strict schema): **~1,000 input tokens** (≈600 instructions + ~50 input + ~300 schema + overhead), **~200 output tokens**. Confirm exact numbers from eval logs.

> ⚠️ **Reasoning tokens.** GPT-5.x reasoning models bill hidden reasoning tokens as **output**, so the "~200 output" figure depends on the effort level. The app ships the `PAL_REASONING_EFFORT` lever but **defaults to omitting it** (model's own default) — lowering reasoning on the live safety classifier must be **eval-confirmed (zero-harmful-SAFE)** before it's activated. Once confirmed, `low`/`minimal` is the main cost lever; `medium`/`high` raise output tokens (and cost/latency) several-fold.

**Per-call cost** and **monthly at the 2,000-checks/day ceiling** (~60k calls; worst case all reach the model, no caching):

| Model | Per call | Monthly @ ~60k calls |
|---|---|---|
| `gpt-5.4-nano` | ~$0.00045 | **~$27** |
| `gpt-5.5-mini` | ~$0.0009 | **~$54** |
| `gpt-5.4-mini` (default) | ~$0.00165 | **~$99** |
| `gpt-5.4` | ~$0.0055 | ~$330 |

These are **ceilings.** Real spend is lower because: prechecks short-circuit traffic; **automatic prompt caching** bills the static instructions+schema prefix (≥1,024 tokens) at **25%** on repeats within ~5–10 min; and 2,000/day is the kill-switch threshold, not expected launch volume. Realistic launch cost on a mini/nano tier: **single-digit to low-tens of dollars/month.**

---

## 5. Cost / quality levers

| Lever | How | Effect |
|---|---|---|
| **Reasoning effort** | `PAL_REASONING_EFFORT` = `none`/`minimal`/`low`/`medium`/`high`/`xhigh`; unset/`off` omits the param | **Default: omitted** (model's own default — behavior-neutral). Set `low`/`minimal` only after eval-confirming zero-harmful-SAFE; then it's the main cost lever |
| **Model tier** | `PAL_MODEL` | nano < 5.5-mini < 5.4-mini < 5.4 on cost; pick cheapest that passes the safety eval |
| **Prompt caching** | Automatic | Keep the instruction prefix stable to maximize the 25% cache rate |
| **Batch / Flex** | OpenAI request tiers | Use **Batch (−50%)** or **Flex** for the offline eval, not the live path |
| **Prechecks** | Already in `service.ts` | Out-of-scope/non-food/ambiguous never hit the model |
| **Retry** | `MAX_MODEL_ATTEMPTS = 2` | Strict schema makes failures rare; worst case doubles a call's cost |

---

## 6. Env knobs (quick reference)

| Env var | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — (required) | Server-side OpenAI key |
| `PAL_MODEL` | `gpt-5.4-mini` | Model id (must support Responses API + strict json_schema) |
| `PAL_REASONING_EFFORT` | unset → model default (param omitted) | Reasoning effort lever; set `low`/`minimal` after eval-confirming zero-harmful-SAFE |
| `EDGE_CONFIG` | optional | Launch-control kill switch (Plan 04-02) |

---

## 7. A/B the model + effort (with your key)

```bash
# baseline (current default: gpt-5.4-mini, effort low)
npm run eval:pal

# cheaper, newer model
PAL_MODEL=gpt-5.5-mini npm run eval:pal

# cheapest tier
PAL_MODEL=gpt-5.4-nano npm run eval:pal

# minimal reasoning (cheapest/fastest) — confirm it still holds zero-harmful-SAFE
PAL_REASONING_EFFORT=minimal npm run eval:pal

# revert reasoning to the model default
PAL_REASONING_EFFORT=off npm run eval:pal
```

**Decision rule:** choose the cheapest `{model, effort}` pair that keeps **zero harmful-SAFE** classifications on the fixture set, then set those two env vars in Vercel Preview + Production.

---

*Pricing figures are third-party (June 2026). Always reconcile against OpenAI's official pricing before budgeting.*
