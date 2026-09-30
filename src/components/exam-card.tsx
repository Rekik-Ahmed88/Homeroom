import { Badge } from "@/components/ui/badge";
import { SubjectChip } from "@/components/subject-chip";
import { examDateLabel, formatDate, isoDate, parseDate } from "@/lib/dates";
import { examPercent, subjectById } from "@/lib/selectors";
import { useSemesterSubjects } from "@/lib/semesters";
import type { Exam } from "@/lib/types";
import { riseDelay } from "@/lib/utils";
import { NotificationSettings } from "@/components/notification-settings";

function gradeTone(percent: number): "success" | "warn" | "danger" {
  if (percent >= 70) return "success";
  if (percent >= 50) return "warn";
  return "danger";
}

export function ExamCard({
  exam,
  index = 0,
  onOpen,
}: {
  exam: Exam;
  index?: number;
  onOpen: (exam: Exam) => void;
}) {
  const subjects = useSemesterSubjects();
  const subject = subjectById(subjects, exam.subjectId);
  const percent = examPercent(exam);
  const today = isoDate();

  return (
    <div
      className="animate-rise flex items-start gap-3 rounded-lg bg-elevated p-3 shadow-border"
      style={riseDelay(index, 35)}
    >
      <div className="flex w-14 shrink-0 flex-col justify-center tabular-nums">
        <span className="text-sm font-medium">
          {formatDate(parseDate(exam.date), "d")}
        </span>
        <span className="text-xs text-subtle">
          {formatDate(parseDate(exam.date), "MMM")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div
          role="button"
          tabIndex={0}
          aria-label={`Open ${exam.title}`}
          className="cursor-pointer text-left"
          onClick={() => onOpen(exam)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(exam);
            }
          }}
        >
          <p className="font-medium leading-snug">{exam.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {subject ? <SubjectChip subject={subject} className="text-xs" /> : null}
            <Badge tone={percent === null ? "muted" : gradeTone(percent)}>
              {percent === null ? examDateLabel(exam.date, today) : `${percent}%`}
            </Badge>
          </div>
          {exam.notes ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted">{exam.notes}</p>
          ) : null}
          {percent !== null ? (
            <p className="mt-1 text-xs tabular-nums text-subtle">
              {exam.score} of {exam.total} ·{" "}
              {formatDate(parseDate(exam.date), "EEE d MMM")}
            </p>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <NotificationSettings kind="exam" itemId={exam.id} />
        </div>
      </div>
    </div>
  );
}
