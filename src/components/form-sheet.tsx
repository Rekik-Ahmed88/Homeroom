import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  deleteButton,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: () => void;
  deleteButton?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form
          className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 pb-8 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <DrawerTitle className="font-display text-2xl font-medium tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="mt-1 text-sm text-muted">
            {description}
          </DrawerDescription>
          <div className="mt-6 flex flex-col gap-5">{children}</div>
          <div className="mt-8 flex flex-col gap-2">
            <Button type="submit">{submitLabel}</Button>
            {deleteButton}
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
