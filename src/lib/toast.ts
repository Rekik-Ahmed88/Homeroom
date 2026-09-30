type Listener = (message: string) => void;

let nextId = 1;
const listeners = new Set<Listener>();

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function nextToastId(): number {
  return nextId++;
}

/** Show a brief message. No-op until <Toaster /> is mounted. */
export function toast(message: string): void {
  for (const fn of listeners) fn(message);
}

export const toastStore = { subscribe, nextToastId };
