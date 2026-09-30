import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/types";
import { useSemesterAttendance } from "@/lib/semesters";
import { useAppStore } from "@/lib/store";

const OPTIONS: { status: AttendanceStatus; label: string }[] = [
  { status: "present", label: "Present" },
  { status: "late", label: "Late" },
  { status: "absent", label: "Absent" },
  { status: "excused", label: "Excused" },
];

export function AttendanceMark({
  subjectId,
  date,
}: {
  subjectId: string;
  date: string;
}) {
  const attendance = useSemesterAttendance();
  const upsertAttendance = useAppStore((s) => s.upsertAttendance);
  const current = attendance.find(
    (a) => a.subjectId === subjectId && a.date === date,
  )?.status;

  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((opt) => {
        const active = current === opt.status;
        return (
          <button
            key={opt.status}
            type="button"
            onClick={() => {
              upsertAttendance(subjectId, date, opt.status);
              toast(`${opt.label} recorded`);
            }}
            className={cn(
              "h-9 min-h-9 rounded-full px-3 text-xs font-medium transition-colors duration-150",
              active
                ? opt.status === "absent"
                  ? "bg-danger text-elevated"
                  : opt.status === "late"
                    ? "bg-warn text-elevated"
                    : "bg-primary text-primary-fg"
                : "bg-surface text-muted hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
