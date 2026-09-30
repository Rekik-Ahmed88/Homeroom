import type { SubjectColor } from "./types";
import { cn } from "./utils";

const DOT: Record<SubjectColor, string> = {
  pine: "bg-sub-pine",
  slate: "bg-sub-slate",
  clay: "bg-sub-clay",
  ink: "bg-sub-ink",
  olive: "bg-sub-olive",
  dusk: "bg-sub-dusk",
  sea: "bg-sub-sea",
  wine: "bg-sub-wine",
};

export function subjectDotClass(color: SubjectColor): string {
  return DOT[color];
}

export function subjectBlockClass(color: SubjectColor): string {
  return cn(DOT[color], "text-elevated");
}

export function colorSwatchClass(color: SubjectColor, extra?: string): string {
  return cn("size-5 rounded-full", DOT[color], extra);
}
