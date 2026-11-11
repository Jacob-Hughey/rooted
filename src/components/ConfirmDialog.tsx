import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** A small modal for "are you sure?" moments. Uses the native <dialog>, so focus and Escape are handled by the browser. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => e.target === ref.current && onCancel()} // tap outside the box
      aria-labelledby="confirm-title"
      className="m-auto w-[min(24rem,calc(100%-2.5rem))] rounded-[var(--radius-xl)] bg-card p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="space-y-2 p-5">
        <h2 id="confirm-title" className="text-xl">{title}</h2>
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="destructive" disabled={busy} onClick={onConfirm}>
          {busy ? "Deleting…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
