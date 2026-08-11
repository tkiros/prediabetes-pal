import { ImageResponse } from "next/og";

import { RISK_LABELS } from "../lib/pal/labels";

// The branded link-preview card (strategy §0.2 #7): a Prediabetes Pal link pasted into
// Reddit/FB/DMs renders this instead of a bare domain. Every string is an
// existing approved surface string (landing hero + standard disclaimer);
// verdict words interpolate from RISK_LABELS like every other render surface.
// Static: no dynamic APIs, so Next generates it once at build.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Prediabetes Pal — check a meal, get one cautious educational label";

const CHIPS = [
  { label: RISK_LABELS.SAFE, color: "#065f46" },
  { label: RISK_LABELS.MODERATE, color: "#92400e" },
  { label: RISK_LABELS.HIGH, color: "#991b1b" }
] as const;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#0d5f57",
          color: "#f8fafc",
          fontFamily: "sans-serif"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28, opacity: 0.85 }}>
            Built for the prediabetes A1C range (5.7%–6.4%)
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.15,
              marginTop: 24,
              maxWidth: 980
            }}
          >
            Check a meal. Understand its balance in seconds.
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 44 }}>
            {CHIPS.map((chip) => (
              <div
                key={chip.label}
                style={{
                  display: "flex",
                  backgroundColor: "#f8fafc",
                  color: chip.color,
                  fontSize: 30,
                  fontWeight: 600,
                  padding: "12px 28px",
                  borderRadius: 999
                }}
              >
                {chip.label}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>
            Prediabetes Pal
          </div>
          <div style={{ display: "flex", fontSize: 24, opacity: 0.8 }}>
            Informational only — not medical advice.
          </div>
        </div>
      </div>
    ),
    size
  );
}
