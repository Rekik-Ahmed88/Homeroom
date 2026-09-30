import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  default: "bg-primary text-primary-fg shadow-border hover:opacity-90",
  secondary: "bg-elevated text-fg shadow-border hover:shadow-border-hover",
  outline: "bg-transparent text-fg shadow-border hover:bg-elevated",
  ghost: "bg-transparent text-fg hover:bg-surface",
  danger: "bg-danger text-elevated hover:opacity-90",
  link: "bg-transparent text-primary underline-offset-4 hover:underline",
} as const;

const SIZES = {
  default: "h-11 min-h-11 px-4",
  sm: "h-9 min-h-9 px-3 text-sm",
  lg: "h-12 min-h-12 px-5",
  icon: "size-11 min-h-11 min-w-11",
  "icon-sm": "size-9 min-h-9 min-w-9",
} as const;

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}
