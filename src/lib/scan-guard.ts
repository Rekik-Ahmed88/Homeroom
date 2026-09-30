// One-bit coordination between the QR scan sheet and drawers: both ride
// the same history stack (drawer pushes one entry, the sheet pushes
// another), so a system back-press pops exactly one entry while BOTH
// popstate listeners fire. The flags below tell each side what happened:
//   - scan active  -> drawer ignores the pop, the sheet cancels the scan.
//   - sheet unwinding itself (after success / Cancel button / Esc) ->
//     drawer ignores that single pop so it stays open underneath.
let scanActive = false;
let swallowNext = false;

export function setScanActive(on: boolean) {
  scanActive = on;
}

export function isScanActive(): boolean {
  return scanActive;
}

export function swallowNextDrawerPop() {
  swallowNext = true;
}

export function takeSwallowedDrawerPop(): boolean {
  const swallowed = swallowNext;
  swallowNext = false;
  return swallowed;
}
