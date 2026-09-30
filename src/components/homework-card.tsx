import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubjectChip } from "@/components/subject-chip";
import { dueLabel, isoDate } from "@/lib/dates";
import { subjectById } from "@/lib/selectors";
import { useSemesterSubjects } from "@/lib/semesters";
import { useAppStore } from "@/lib/store";
import type { Homework, Priority } from "@/lib/types";
import { cn, riseDelay } from "@/lib/utils";
import { NotificationSettings } from "@/components/notification-settings";

const PRIORITY_TONE: Record<Priority, "muted" | "warn" | "danger"> = {
  low: "muted",
  medium: "warn",
  high: "danger",
};

export function HomeworkCard({
  item,
  index = 0,
  onOpen,
}: {
  item: Homework;
  index?: number;
  onOpen: (item: Homework) => void;
}) {
  const subjects = useSemesterSubjects();
  const toggleHomework = useAppStore((s) => s.toggleHomework);
  const subject = subjectById(subjects, item.subjectId);
  const overdue = !item.done && item.dueDate < isoDate();

  return (
    <div
      className={cn(
        "animate-rise flex items-start gap-3 rounded-lg bg-elevated p-3 shadow-border",
        item.done && "opacity-60",
      )}
      style={riseDelay(index, 35)}
    >
      <button
        type="button"
        aria-label={item.done ? "Mark as not done" : "Mark as done"}
        onClick={() => toggleHomework(item.id)}
        className={cn(
          "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-xs border transition-colors duration-150 after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2",
          item.done
            ? "border-primary bg-primary text-primary-fg"
            : "border-border bg-elevated text-transparent",
        )}
      >
        <Check
          key={String(item.done)}
          className="animate-pop size-3.5"
          strokeWidth={2.4}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="button"
          tabIndex={0}
          aria-label={`Open ${item.title}`}
          className="cursor-pointer text-left"
          onClick={() => onOpen(item)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(item);
            }
          }}
        >
          <p
            className={cn(
              "font-medium leading-snug",
              item.done && "line-through text-muted",
            )}
          >
            {item.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {subject ? <SubjectChip subject={subject} className="text-xs" /> : null}
            <Badge tone={overdue ? "danger" : PRIORITY_TONE[item.priority]}>
              {dueLabel(item.dueDate)}
            </Badge>
          </div>
          {item.notes ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted">{item.notes}</p>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <NotificationSettings kind="homework" itemId={item.id} />
        </div>
      </div>
    </div>
  );
}
