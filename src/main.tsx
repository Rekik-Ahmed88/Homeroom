import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./components/app-shell";
import { AppErrorComponent } from "./lib/error-component";
import { usePathname } from "./lib/router";
import { registerServiceWorker } from "./lib/notify";
import { TodayPage } from "./routes/index";
import { TimetablePage } from "./routes/timetable";
import { HomeworkPage } from "./routes/homework";
import { ExamsPage } from "./routes/exams";
import { AttendancePage } from "./routes/attendance";
import "./styles.css";

const rootEl = document.getElementById("root")!;

// Sync the saved theme before first paint (mirrors the inline script in
// index.html) so dark users never see a light flash. No forced colors here:
// the palette lives in styles.css and the `.dark` class selects the variant.
try {
  const saved = JSON.parse(localStorage.getItem("homeroom-v1") ?? "{}") as {
    state?: { settings?: { theme?: string } };
  };
  const theme = saved.state?.settings?.theme ?? "system";
  const dark =
    theme === "dark" ||
    (theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
} catch {
  // Corrupt storage: fall through to the default (light) theme.
}

void registerServiceWorker();

function App() {
  const pathname = usePathname();
  return (
    <AppShell pathname={pathname}>
      <Page pathname={pathname} />
    </AppShell>
  );
}

function Page({ pathname }: { pathname: string }) {
  switch (pathname) {
    case "/timetable":
      return <TimetablePage />;
    case "/homework":
      return <HomeworkPage />;
    case "/exams":
      return <ExamsPage />;
    case "/attendance":
      return <AttendancePage />;
    case "/":
      return <TodayPage />;
    default:
      return <AppErrorComponent error={`Unknown page: ${pathname}`} />;
  }
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
