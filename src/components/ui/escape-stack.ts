/**
 * Shared Escape-to-close stack for floating layers (sheets, menus, calendars).
 * Only the topmost layer closes, so Escape in a menu inside a sheet closes
 * just the menu — and in nested sheets just the inner one.
 */
type Closer = () => void;

const stack: Closer[] = [];

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  stack[stack.length - 1]?.();
}

export function pushEscapeLayer(closer: Closer): () => void {
  stack.push(closer);
  if (stack.length === 1) document.addEventListener("keydown", onKeyDown);
  return () => {
    const i = stack.indexOf(closer);
    if (i !== -1) stack.splice(i, 1);
    if (stack.length === 0) document.removeEventListener("keydown", onKeyDown);
  };
}
