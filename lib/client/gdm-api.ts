import { GDM_ROUTES } from "../pal/gdm/routes";

/**
 * The GDM door's one client wrapper for its own routes and the shared account
 * routes. JSON in and out, and it never throws: a dropped connection is
 * `{ ok: false, status: 0 }`, a body that is not JSON reads as no body.
 *
 * A refusal also hands back its whole parsed body as `payload` (null when
 * there is none): R46, a 409 from a full questions list still carries the
 * clinical card (`route`, `routeCopy`), and the list must be able to show it.
 */
export type GdmFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; payload: unknown };

export type GdmFetchInit = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorLine(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return "";
}

/**
 * G-14: a 401 is an expired session, and "try again in a moment" can never fix
 * one. So a 401 is not handed back: the page goes to the door's sign-up (which
 * returns to /gdm/start) and the promise is left pending on purpose, so the
 * caller's in-flight state holds until the page unloads instead of flashing a
 * failure line. Only if the navigation itself cannot run is the 401 returned.
 */
export async function gdmFetch<T>(path: string, init: GdmFetchInit = {}): Promise<GdmFetchResult<T>> {
  let response: Response;
  try {
    const hasBody = init.body !== undefined;
    response = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: hasBody ? { accept: "application/json", "content-type": "application/json" } : { accept: "application/json" },
      body: hasBody ? JSON.stringify(init.body) : undefined
    });
  } catch {
    return { ok: false, status: 0, error: "", payload: null };
  }

  if (response.status === 401) {
    try {
      window.location.assign(GDM_ROUTES.signup);
      return new Promise<never>(() => undefined);
    } catch {
      // No window to navigate (never in the browser): fall through and return it.
    }
  }

  const payload = await readJson(response);
  if (response.ok) return { ok: true, data: payload as T };
  return { ok: false, status: response.status, error: errorLine(payload), payload };
}

type DeviceStorage = Pick<Storage, "length" | "key" | "removeItem">;

const GDM_KEY_PREFIX = "pal.gdm.";

function deviceStorages(): DeviceStorage[] {
  const out: DeviceStorage[] = [];
  try {
    out.push(window.localStorage);
  } catch {
    // Blocked or absent (private mode, no window): nothing stored there.
  }
  try {
    out.push(window.sessionStorage);
  } catch {
    // As above.
  }
  return out;
}

/**
 * Removes every `pal.gdm.*` key from this device — an unsent draft or a
 * rotation counter; nothing health-related is stored on the device. Run on
 * sign-out, erase and account deletion so her typed text never outlives them on
 * a shared phone. The keys are collected first and removed after: removing
 * while walking `storage.key(i)` shifts the indexes and skips entries.
 */
export function clearGdmDeviceKeys(storages: DeviceStorage[] = deviceStorages()): void {
  for (const storage of storages) {
    try {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(GDM_KEY_PREFIX)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    } catch {
      // A storage that throws is skipped; the others are still cleared.
    }
  }
}
