import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@/lib/router";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { Toaster } from "@/components/ui/toast";
import { AppTour, shouldShowTour } from "@/components/app-tour";
import { cn } from "@/lib/utils";
import { formatDate, mondayOf } from "@/lib/dates";
import { applyTheme } from "@/lib/theme";
import { isTauri } from "@/lib/notify";
import { useReminders } from "@/lib/reminders";
import { syncOnOpen } from "@/lib/sync";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { SettingsDrawer } from "@/components/settings-drawer";

const TABS = [
  { to: "/", label: "Today", icon: House },
  { to: "/timetable", label: "Timetable", icon: CalendarDays },
  { to: "/homework", label: "Homework", icon: BookOpen },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
] as const;

// Anchor for the splash hold: this module evaluates right as the boot
// overlay paints (both are local, so the offset is a few ms).
const BOOT_START = performance.now();
// Long enough for the whole splash entrance (logo → title → tagline,
// last animation ends at ~800ms) to play out before the overlay dissolves.
const BOOT_HOLD_MS = 840;

// Desktop layout is only for wide, non-Android windows.
function desktopWide() {
  return (
    window.matchMedia("(min-width: 1024px)").matches &&
    !document.documentElement.classList.contains("android")
  );
}

// Sidebar collapse is a desktop preference; remember it between launches.
function savedSidebarMin() {
  try {
    return localStorage.getItem("homeroom-sidebar-min") === "1";
  } catch {
    return false;
  }
}

export function AppShell({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const theme = useAppStore((s) => s.settings.theme);
  const isTimetable = pathname === "/timetable";
  // Desktop gets a left sidebar + wider content; Android (and narrow
  // windows) keep the mobile layout. The android class is set on <html>
  // before first paint, so it's reliable here.
  const [wide, setWide] = useState(() => desktopWide());
  const [sideMin, setSideMin] = useState(savedSidebarMin);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setWide(desktopWide());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggleSidebar() {
    setSideMin((min) => {
      const next = !min;
      try {
        localStorage.setItem("homeroom-sidebar-min", next ? "1" : "0");
      } catch {
        // Private mode: the preference just won't persist.
      }
      return next;
    });
  }
  useReminders();

  // First startup: after the splash has dissolved, offer a short tour.
  useEffect(() => {
    if (!shouldShowTour()) return;
    const t = window.setTimeout(() => setTourOpen(true), 1400);
    return () => window.clearTimeout(t);
  }, []);

  // Sync on open: restart this device's listener if it was hosting, then
  // quietly sync with the paired device (silently skipped if it's off).
  useEffect(() => {
    void syncOnOpen();
  }, []);

  // Launch sequence that eliminates the native white flash:
  // 1. Keep the boot overlay — playing its splash animation — up while
  //    React mounts behind it.
  // 2. Show the hidden Tauri window — whatever the webview paints first
  //    (even a white first frame) stays covered by the overlay.
  // 3. Only after the window is up and the splash entrance has played do
  //    we dissolve the overlay.
  // If showing fails, the Rust fallback shows the window at 5s; the overlay
  // stays until then so a white frame can never slip through.
  useEffect(() => {
    const dropBoot = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Keep the overlay up until the splash animation has finished
          // (floor of the original 75ms past the first mapped frames), then
          // dissolve instead of cutting away — a soft fade never reads as a
          // flash. Reduced motion skips the hold entirely.
          const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          const wait = reduced
            ? 0
            : Math.max(75, BOOT_HOLD_MS - (performance.now() - BOOT_START));
          window.setTimeout(() => {
            const boot = document.getElementById("boot");
            if (!boot) return;
            boot.style.transition = "opacity 180ms ease-out";
            boot.style.opacity = "0";
            window.setTimeout(() => boot.remove(), 200);
          }, wait);
        });
      });
    };
    if (!isTauri()) {
      dropBoot();
      return;
    }
    void import("@tauri-apps/api/window")
      .then((m) => m.getCurrentWindow().show())
      .then(dropBoot)
      .catch(() => {
        // Rust fallback shows the window at 5s; clear the overlay after that.
        window.setTimeout(() => document.getElementById("boot")?.remove(), 6000);
      });
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-col bg-bg",
        wide
          ? cn(
              "w-full transition-[padding] duration-200",
              sideMin ? "pl-16" : "pl-56",
            )
          : "mx-auto max-w-3xl md:max-w-5xl",
      )}
    >
      <header
        className={cn(
          "app-header sticky top-0 z-30 flex items-center justify-between gap-3 bg-bg",
          isTimetable ? "px-3 pb-0" : "px-4 pb-3",
          wide && "mx-auto w-full max-w-6xl",
        )}
      >
        {isTimetable ? (
          <p className="font-display text-xl font-medium tracking-tight">
            {formatDate(mondayOf(), "MMMM")}
          </p>
        ) : (
          <p className="font-display text-xl font-medium tracking-tight">
            Homeroom
          </p>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings />
        </Button>
      </header>

      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          isTimetable
            ? cn("app-main-timetable px-0", wide && "mx-auto w-full max-w-6xl pb-6")
            : wide
              ? "mx-auto w-full max-w-6xl px-4 pb-8 pt-1"
              : "px-4 pb-28 pt-1 md:pb-32",
        )}
      >
        {children}
      </main>

      <nav
        className={cn(
          "app-tabbar z-30 border-border",
          wide
            ? cn(
                "fixed left-0 top-0 h-dvh overflow-y-auto border-r bg-elevated px-2 py-4 transition-[width] duration-200",
                sideMin ? "w-16" : "w-56 px-3",
              )
            : "fixed inset-x-0 bottom-0 border-t bg-elevated/95 backdrop-blur-sm",
        )}
        aria-label="Primary"
      >
        {wide ? (
          <div
            className={cn(
              "flex items-center pb-2",
              sideMin ? "justify-center" : "justify-end",
            )}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={sideMin ? "Expand sidebar" : "Minimize sidebar"}
              title={sideMin ? "Expand sidebar" : "Minimize sidebar"}
              onClick={toggleSidebar}
            >
              {sideMin ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </div>
        ) : null}
        <ul
          className={cn(
            wide
              ? "flex flex-col gap-1"
              : "mx-auto grid max-w-3xl grid-cols-5 md:max-w-5xl",
          )}
        >
          {TABS.map((tab) => {
            const active =
              tab.to === "/"
                ? pathname === "/"
                : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  title={wide && sideMin ? tab.label : undefined}
                  className={cn(
                    "flex items-center font-medium transition-colors duration-150",
                    wide
                      ? cn(
                          "min-h-11 rounded-lg py-2 text-sm",
                          sideMin
                            ? "justify-center px-0"
                            : "justify-start gap-3 px-3",
                        )
                      : "min-h-14 flex-col justify-center gap-0.5 text-xs",
                    active
                      ? wide
                        ? "bg-surface text-fg"
                        : "text-fg"
                      : wide
                        ? "text-subtle hover:bg-surface hover:text-fg"
                        : "text-subtle",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5 transition-transform duration-150",
                      active && !wide && "scale-110",
                    )}
                    strokeWidth={active ? 2.2 : 1.7}
                    aria-hidden
                  />
                  <span className={wide && sideMin ? "sr-only" : undefined}>
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tourOpen ? <AppTour onClose={() => setTourOpen(false)} /> : null}
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster />
    </div>
  );
}
