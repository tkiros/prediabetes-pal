// Sanctioned inline icon set (DESIGN.md §Icons). Hand-written 24-viewbox
// strokes, sized via the --icon tokens, colored via currentColor. No icon
// library — these fourteen glyphs are the whole vocabulary.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props
  };
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5" />
      <path d="M12 18.2v.1" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function IconMic(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function IconKeyboard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 11h.1M11 11h.1M15 11h.1M8 14.5h8" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconLeaf(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 19C5 9 12 4 20 4c0 8-5 15-15 15z" />
      <path d="M5 19c3-5 7-8 11-10" />
    </svg>
  );
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20s-7-4.6-9-9c-1.2-2.7.5-6 3.7-6C9 5 10.8 6.6 12 8c1.2-1.4 3-3 5.3-3 3.2 0 4.9 3.3 3.7 6-2 4.4-9 9-9 9z" />
    </svg>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 3l18 18" />
      <path d="M2 12s3.5-7 10-7c1.8 0 3.4.5 4.8 1.3" />
      <path d="M22 12s-3.5 7-10 7c-1.8 0-3.4-.5-4.8-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 11l8-6 8 6" />
      <path d="M6 10v9h12v-9" />
    </svg>
  );
}

export function IconPerson(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="9" r="3.4" />
      <path d="M5.5 19c1-3 3.6-4.4 6.5-4.4s5.5 1.4 6.5 4.4" />
    </svg>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

/** My Meals — a saved/remembered place (C7 four-jobs nav, 2026-07-21). */
export function IconBookmark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4h10v16l-5-3.5L7 20V4z" />
    </svg>
  );
}

/** My Journey — direction/learning (C7 four-jobs nav, 2026-07-21). */
export function IconCompass(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.2 8.8l-2 4.4-4.4 2 2-4.4 4.4-2z" />
    </svg>
  );
}

/** Learn — an open guide (PR-5 quick row, 2026-09-18). */
export function IconBook(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5c-.8 0-1.5-.7-1.5-1.5v-13z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5c.8 0 1.5-.7 1.5-1.5v-13z" />
    </svg>
  );
}
