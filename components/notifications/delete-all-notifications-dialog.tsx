"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteAllNotificationsDialog({
  open,
  onOpenChange,
  notificationCount,
  busy,
  onConfirmDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notificationCount: number;
  busy: boolean;
  onConfirmDelete: () => void | Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md border border-[#2C2C2C]/10 bg-white font-sans text-[#2C2C2C] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2C2C2C]">Delete all notifications?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-gray-600">
            This will permanently remove all {notificationCount} notifications from your account. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full border-gray-300 text-[#2C2C2C] sm:w-auto"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void onConfirmDelete()}
            className="w-full rounded-full border-0 bg-red-600 px-5 text-white hover:bg-red-700 sm:w-auto"
          >
            {busy ? "…" : "Delete all"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
