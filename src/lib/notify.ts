import { toast } from "./toast";

/** True inside the Tauri shell (desktop AppImage / Android). */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

/** Register the service worker (web builds only; custom Tauri schemes lack SW). */
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const proto = window.location.protocol;
  if (proto !== "http:" && proto !== "https:") return;
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch {
    // Offline preview / unsupported: in-app toasts still work.
  }
}

/** Ask the OS/browser for permission to show notifications. */
export async function requestSystemPermission(): Promise<boolean> {
  if (isTauri()) {
    try {
      const mod = await import("@tauri-apps/plugin-notification");
      const granted =
        (await mod.isPermissionGranted()) ||
        (await mod.requestPermission()) === "granted";
      return granted;
    } catch {
      return false;
    }
  }
  if (!("Notification" in window)) {
    toast("System notifications aren't supported here");
    return false;
  }
  if (Notification.permission === "granted") return true;
  return (await Notification.requestPermission()) === "granted";
}

/**
 * Deliver a reminder through the best channel available:
 * 1. Tauri OS notification (desktop libnotify / Android system tray —
 *    visible even when the window is minimized or in the background),
 * 2. Service-worker notification (web — survives tab backgrounding),
 * 3. Web Notification API fallback.
 * Always toasts as well so something is visible inside the app.
 */
export async function notify(title: string, body: string): Promise<void> {
  toast(body);
  if (isTauri()) {
    try {
      const mod = await import("@tauri-apps/plugin-notification");
      await mod.sendNotification({ title, body });
      return;
    } catch {
      // Plugin unavailable (permissions): fall through to Web API.
    }
  }
  try {
    if ("serviceWorker" in navigator) {
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (navigator.serviceWorker.controller
          ? await navigator.serviceWorker.ready
          : null);
      if (reg?.showNotification) {
        await reg.showNotification(title, { body });
        return;
      }
    }
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // Toast above already covered it.
  }
}
