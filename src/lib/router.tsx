import {
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Tiny hash router — the whole app is five static tabs, so this replaces
 * TanStack Router (~100kB + codegen) with a `hashchange` subscription.
 * URLs look like `#/attendance?subject=abc`; the hash keeps Tauri's
 * custom protocol and plain file:// builds working.
 */

export const PATHS = [
  "/",
  "/timetable",
  "/homework",
  "/exams",
  "/attendance",
] as const;

function currentHash(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  window.addEventListener("hashchange", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("hashchange", fn);
  };
}

function getSnapshot(): string {
  return currentHash();
}

/** Raw `#/path?query` — re-renders the caller on every hash change. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => "/");
}

function split(hash: string): { path: string; search: URLSearchParams } {
  const q = hash.indexOf("?");
  if (q === -1) return { path: hash || "/", search: new URLSearchParams() };
  return {
    path: hash.slice(0, q) || "/",
    search: new URLSearchParams(hash.slice(q + 1)),
  };
}

/** Current tab path, e.g. `/attendance`. Unknown paths fall back to `/`. */
export function usePathname(): string {
  const hash = useHash();
  const { path } = split(hash);
  return (PATHS as readonly string[]).includes(path) ? path : "/";
}

/** Single query value, e.g. `useSearchParam("subject")` on attendance. */
export function useSearchParam(key: string): string | null {
  const hash = useHash();
  return split(hash).search.get(key);
}

/** Push (default) or replace the hash. Push keeps back-gesture working. */
export function navigate(to: string, opts?: { replace?: boolean }) {
  const hash = `#${to}`;
  if (opts?.replace) {
    window.location.replace(hash);
  } else if (window.location.hash !== hash) {
    window.location.hash = to;
  }
}

export function goBack() {
  window.history.back();
}

type LinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  to: string;
  children: ReactNode;
};

/** Plain anchor over the hash — no JS interception needed. */
export function Link({ to, children, ...rest }: LinkProps) {
  return (
    <a href={`#${to}`} {...rest}>
      {children}
    </a>
  );
}
