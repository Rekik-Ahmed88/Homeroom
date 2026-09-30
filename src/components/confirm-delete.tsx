import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDeleteButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }
  return (
    <Button type="button" variant="danger" onClick={onConfirm}>
      {confirmLabel}
    </Button>
  );
}
