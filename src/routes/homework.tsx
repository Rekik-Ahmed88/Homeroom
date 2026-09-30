import { useMemo, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { HomeworkCard } from "@/components/homework-card";
import { HomeworkFormDrawer } from "@/components/homework-form";
import { isoDate } from "@/lib/dates";
import { groupHomework } from "@/lib/selectors";
import { useSemesterHomework, useSemesterSubjects } from "@/lib/semesters";
import type { Homework } from "@/lib/types";
import { cn, riseDelay } from "@/lib/utils";

type Filter = "open" | "all" | "done";

export function HomeworkPage() {
  const homework = useSemesterHomework();
  const subjects = useSemesterSubjects();
  const [filter, setFilter] = useState<Filter>("open");
  const [subjectId, setSubjectId] = useState("all");
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<Homework | null>(null);

  const today = isoDate();
  const filtered = useMemo(() => {
    return homework.filter((h) => {
      if (subjectId !== "all" && h.subjectId !== subjectId) return false;
      if (filter === "open") return !h.done;
      if (filter === "done") return h.done;
      return true;
    });
  }, [homework, filter, subjectId]);

  const groups = groupHomework(filtered, today);
  const sections =
    filter === "done"
      ? [{ key: "done", title: "Done", items: groups.done }]
      : [
          { key: "overdue", title: "Overdue", items: groups.overdue },
          { key: "today", title: "Due today", items: groups.dueToday },
          { key: "upcoming", title: "Upcoming", items: groups.upcoming },
          ...(filter === "all"
            ? [{ key: "done", title: "Done", items: groups.done }]
            : []),
        ];

  const empty = filtered.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="animate-rise flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">
            Homework
          </h1>
          <p className="mt-1 text-sm text-muted">
            {homework.filter((h) => !h.done).length} open
          </p>
        </div>
        <Button
          size="icon"
          aria-label="Add homework"
          onClick={() => {
            setItem(null);
            setOpen(true);
          }}
        >
          <Plus />
        </Button>
      </div>

      <div className="animate-rise flex flex-col gap-3 sm:flex-row" style={riseDelay(1)}>
        <div className="flex rounded-md bg-surface p-1">
          {(
            [
              ["open", "Open"],
              ["all", "All"],
              ["done", "Done"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "h-9 min-h-9 flex-1 rounded-sm px-3 text-sm font-medium sm:flex-none",
                filter === key ? "bg-elevated text-fg shadow-border" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {subjects.length > 0 ? (
          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            label="Filter by subject"
            className="sm:max-w-48"
          >
            <option value="all">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {empty ? (
        <EmptyState
          icon={BookOpen}
          title={filter === "done" ? "Nothing completed yet" : "No homework"}
          body={
            filter === "done"
              ? "Tick a task off and it lands here."
              : "Capture an assignment the moment it’s set."
          }
          action={
            filter === "open"
              ? () => {
                  setItem(null);
                  setOpen(true);
                }
              : undefined
          }
          actionLabel="Add homework"
        />
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) =>
            section.items.length === 0 ? null : (
              <section key={section.key} className="flex flex-col gap-2">
                <h2 className="text-xs font-medium uppercase tracking-wider text-subtle">
                  {section.title}
                  <span className="ml-2 tabular-nums">{section.items.length}</span>
                </h2>
                {section.items.map((h, i) => (
                  <HomeworkCard
                    key={h.id}
                    item={h}
                    index={i}
                    onOpen={(next) => {
                      setItem(next);
                      setOpen(true);
                    }}
                  />
                ))}
              </section>
            ),
          )}
        </div>
      )}

      <HomeworkFormDrawer open={open} onOpenChange={setOpen} item={item} />
    </div>
  );
}
