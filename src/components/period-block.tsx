import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { ColorDot } from "@/components/subject-chip";
import { subjectById } from "@/lib/selectors";
import { useSemesterSubjects } from "@/lib/semesters";
import type { Period } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PeriodRow({
  period,
  onOpen,
  trailing,
}: {
  period: Period;
  onOpen?: (period: Period) => void;
  trailing?: ReactNode;
}) {
  const subjects = useSemesterSubjects();
  const subject = subjectById(subjects, period.subjectId);

  const inner = (
    <>
      <div className="flex w-14 shrink-0 flex-col justify-center tabular-nums">
        <span className="text-sm font-medium">{period.start}</span>
        <span className="text-xs text-subtle">{period.end}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          {subject ? <ColorDot color={subject.color} /> : null}
          {subject?.name ?? "Unknown"}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          {period.room ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {period.room}
            </span>
          ) : null}
          {subject?.teacher ? <span>{subject.teacher}</span> : null}
        </p>
      </div>
      {trailing}
    </>
  );

  const className = cn(
    "flex w-full items-stretch gap-3 rounded-lg bg-elevated p-3 text-left shadow-border",
    onOpen && "transition-transform duration-150 active:scale-[0.99]",
  );

  if (onOpen) {
    return (
      <button type="button" onClick={() => onOpen(period)} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}
