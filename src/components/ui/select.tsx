import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/ui/popover";

type Option = { value: string; label: string };

function readOptions(children: ReactNode): Option[] {
  const options: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: unknown; children?: ReactNode }>(child)) return;
    if (child.type !== "option") return;
    const value = String(child.props.value ?? "");
    const label = typeof child.props.children === "string" ? child.props.children : value;
    options.push({ value, label });
  });
  return options;
}

export type SelectChange = { target: { value: string } };

export function Select({
  value,
  onChange,
  children,
  className,
  label,
}: {
  value: string;
  onChange: (e: SelectChange) => void;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const options = readOptions(children);
  const selected = options.find((o) => o.value === String(value)) ?? options[0];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setActive(Math.max(0, options.findIndex((o) => o.value === String(value))));
    }
  }, [open, options, value]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(next: string) {
    close();
    if (next !== String(value)) onChange({ target: { value: next } });
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[active]?.value ?? String(value));
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKey}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md bg-elevated px-3 text-left text-base text-fg shadow-border outline-none",
          "focus-visible:shadow-border-hover",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ""}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted transition-transform duration-150", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        maxHeightVh={40}
      >
        <ul role="listbox" aria-label={label} className="py-1">
          {options.map((opt, i) => {
            const isSelected = opt.value === String(value);
            return (
              <li key={opt.value + i} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => choose(opt.value)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex h-11 min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-base",
                    i === active ? "bg-surface" : "bg-transparent",
                    isSelected ? "font-medium text-fg" : "text-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {isSelected ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </>
  );
}
