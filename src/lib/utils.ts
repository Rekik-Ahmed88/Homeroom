import { twMerge } from "tailwind-merge";

type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | undefined | null>;

function clsxImpl(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const v of inputs) {
    if (!v) continue;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      const s = clsxImpl(...v);
      if (s) out.push(s);
    } else if (typeof v === "object") {
      for (const [k, on] of Object.entries(v)) if (on) out.push(k);
    }
  }
  return out.join(" ");
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsxImpl(...inputs));
}

/** Staggered entrance style for lists: caps the delay so long lists settle fast. */
export function riseDelay(index: number, stepMs = 45, maxSteps = 6) {
  return { animationDelay: `${Math.min(index, maxSteps) * stepMs}ms` } as const;
}

export function nid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
