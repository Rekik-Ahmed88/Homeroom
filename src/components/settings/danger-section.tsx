import { toast } from "@/lib/toast";
import { useAppStore } from "@/lib/store";
import { HoldToConfirmButton } from "@/components/hold-to-confirm";
import { HOLD_MS } from "./shared";

export function DangerSection({
  drawerOpen,
  onClose,
}: {
  drawerOpen: boolean;
  onClose: () => void;
}) {
  const loadSample = useAppStore((s) => s.loadSample);
  const startFresh = useAppStore((s) => s.startFresh);

  return (
    <div className="mt-6 flex flex-col gap-2">
      <HoldToConfirmButton
        variant="secondary"
        holdMs={HOLD_MS}
        active={drawerOpen}
        label="Load sample week"
        onConfirm={() => {
          loadSample();
          toast("Sample week loaded");
          onClose();
        }}
      />
      <p className="text-xs text-subtle">
        Press and hold to load a sample week
      </p>
      <HoldToConfirmButton
        variant="danger"
        holdMs={HOLD_MS}
        active={drawerOpen}
        label="Start fresh"
        onConfirm={() => {
          startFresh();
          toast("All data cleared");
          onClose();
        }}
      />
      <p className="text-xs text-subtle">
        Start fresh needs a press-and-hold — keep it held to erase
        everything on this device.
      </p>
    </div>
  );
}
