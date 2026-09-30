import { cn } from "@/lib/utils";
import { subjectDotClass } from "@/lib/colors";
import type { Subject } from "@/lib/types";

export function SubjectChip({
  subject,
  className,
}: {
  subject: Subject;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-fg",
        className,
      )}
    >
      <span
        className={cn("size-2 rounded-full", subjectDotClass(subject.color))}
        aria-hidden
      />
      {subject.name}
    </span>
  );
}

export function ColorDot({
  color,
  className,
}: {
  color: Subject["color"];
  className?: string;
}) {
  return (
    <span
      className={cn("size-2.5 rounded-full", subjectDotClass(color), className)}
      aria-hidden
    />
  );
}
