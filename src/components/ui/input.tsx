import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md bg-elevated px-3 text-base text-fg shadow-border outline-none placeholder:text-subtle",
        "focus-visible:shadow-border-hover",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md bg-elevated px-3 py-2.5 text-base text-fg shadow-border outline-none placeholder:text-subtle",
        "focus-visible:shadow-border-hover",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
