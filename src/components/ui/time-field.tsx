import { Select } from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function split(value: string): [string, string] {
  const [h = "09", m = "00"] = value.split(":");
  return [h.padStart(2, "0"), m.padStart(2, "0")];
}

/** Time of day as two themed dropdowns. Minutes run in 5-minute steps. */
export function TimeField({
  id,
  value,
  onChange,
  label,
}: {
  id?: string;
  value: string;
  onChange: (hhmm: string) => void;
  label?: string;
}) {
  const [hour, minute] = split(value);
  const minutes = MINUTE_STEPS.includes(minute)
    ? MINUTE_STEPS
    : [...MINUTE_STEPS, minute].sort();

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" id={id}>
      <Select
        value={hour}
        label={label ? `${label} hour` : undefined}
        onChange={(e) => onChange(`${e.target.value}:${minute}`)}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Select>
      <span className="font-medium text-muted" aria-hidden>
        :
      </span>
      <Select
        value={minute}
        label={label ? `${label} minute` : undefined}
        onChange={(e) => onChange(`${hour}:${e.target.value}`)}
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
    </div>
  );
}
