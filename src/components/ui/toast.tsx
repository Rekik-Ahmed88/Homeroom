import { useEffect, useState } from "react";
import { toastStore } from "@/lib/toast";

type Toast = { id: number; message: string };

const VISIBLE_MS = 2400;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return toastStore.subscribe((message: string) => {
      const id = toastStore.nextToastId();
      setToasts((current) => [...current.slice(-2), { id, message }]);
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, VISIBLE_MS);
    });
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex w-full max-w-3xl flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <p
          key={t.id}
          className="animate-toast-in rounded-lg bg-elevated px-4 py-2.5 text-center text-sm font-medium text-fg shadow-raised"
        >
          {t.message}
        </p>
      ))}
    </div>
  );
}
