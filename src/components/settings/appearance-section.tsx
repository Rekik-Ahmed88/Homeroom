import { Monitor, Moon, Sun } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Field } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Theme } from "@/lib/types";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function AppearanceSection() {
  const theme = useAppStore((s) => s.settings.theme);
  const updateSettings = useAppStore((s) => s.updateSettings);

  return (
    <Field label="Appearance">
      <div className="flex rounded-md bg-surface p-1" role="group" aria-label="Appearance">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => updateSettings({ theme: value })}
            aria-pressed={theme === value}
            className={cn(
              "flex h-9 min-h-9 flex-1 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium",
              theme === value
                ? "bg-elevated text-fg shadow-border"
                : "text-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </Field>
  );
}
