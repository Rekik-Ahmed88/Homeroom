import { useState } from "react";
import { GraduationCap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { ExamCard } from "@/components/exam-card";
import { ExamFormDrawer } from "@/components/exam-form";
import { examAverage, groupExams } from "@/lib/selectors";
import { useSemesterExams, useSemesterSubjects } from "@/lib/semesters";
import type { Exam } from "@/lib/types";
import { riseDelay } from "@/lib/utils";

export function ExamsPage() {
  const exams = useSemesterExams();
  const subjects = useSemesterSubjects();
  const [subjectId, setSubjectId] = useState("all");
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<Exam | null>(null);

  const visible =
    subjectId === "all" ? exams : exams.filter((e) => e.subjectId === subjectId);
  const groups = groupExams(visible);
  const average = examAverage(visible);
  const empty = visible.length === 0;

  function addNew() {
    setItem(null);
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="animate-rise flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">
            Exams
          </h1>
          <p className="mt-1 text-sm text-muted">
            {average === null
              ? "No grades yet"
              : `${average}% average · ${groups.graded.length} graded`}
          </p>
        </div>
        <Button size="icon" aria-label="Add exam" onClick={addNew}>
          <Plus />
        </Button>
      </div>

      {subjects.length > 0 ? (
        <div className="animate-rise" style={riseDelay(1)}>
          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            label="Filter by subject"
          >
            <option value="all">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {empty ? (
        <EmptyState
          icon={GraduationCap}
          title="No exams yet"
          body="Log an upcoming exam, then add the grade when it lands."
          action={addNew}
          actionLabel="Add exam"
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.upcoming.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-subtle">
                Upcoming
                <span className="ml-2 tabular-nums">
                  {groups.upcoming.length}
                </span>
              </h2>
              {groups.upcoming.map((exam, i) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  index={i}
                  onOpen={(next) => {
                    setItem(next);
                    setOpen(true);
                  }}
                />
              ))}
            </section>
          ) : null}
          {groups.graded.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-subtle">
                Graded
                <span className="ml-2 tabular-nums">
                  {groups.graded.length}
                </span>
              </h2>
              {groups.graded.map((exam, i) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  index={i}
                  onOpen={(next) => {
                    setItem(next);
                    setOpen(true);
                  }}
                />
              ))}
            </section>
          ) : null}
        </div>
      )}

      <ExamFormDrawer open={open} onOpenChange={setOpen} exam={item} />
    </div>
  );
}
