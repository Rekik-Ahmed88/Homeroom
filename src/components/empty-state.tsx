import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-lg bg-surface text-muted">
        <Icon className="size-6" strokeWidth={1.6} />
      </div>
      <h3 className="mt-4 font-display text-lg font-medium tracking-tight">
        {title}
      </h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>
      {action && actionLabel ? (
        <Button className="mt-5" onClick={action}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
