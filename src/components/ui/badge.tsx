import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  muted: "bg-surface text-muted",
  primary: "bg-primary text-primary-fg",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
} as const;

export function Badge({
  className,
  tone = "muted",
  ...props
}: React.ComponentProps<"span"> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
