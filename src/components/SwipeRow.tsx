import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const ACTION_WIDTH = 88;

/**
 * Swipe left to reveal a Delete button (iOS Mail style). Vertical scrolling still works:
 * the gesture only takes over once the finger is clearly moving sideways.
 * Keyboard users reach the same button with Tab; focusing it slides the row open.
 */
export function SwipeRow({
  children,
  open,
  onOpenChange,
  onDelete,
  deleteLabel,
  disabled,
}: {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  /** Accessible name for the delete button, e.g. "Delete Watered, November 2". */
  deleteLabel: string;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number; base: number; axis?: "x" | "y" } | null>(null);
  const moved = useRef(false);

  const offset = drag ?? (open ? -ACTION_WIDTH : 0);

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={onDelete}
        onFocus={() => onOpenChange(true)}
        aria-label={deleteLabel}
        tabIndex={disabled ? -1 : 0}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive font-bold text-white"
        style={{ width: ACTION_WIDTH }}
      >
        Delete
      </button>
      <div
        className={cn("relative bg-background", drag === null && "transition-transform duration-200 ease-out")}
        style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY, base: open ? -ACTION_WIDTH : 0 };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!s.axis) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
              s.axis = "x";
              e.currentTarget.setPointerCapture(e.pointerId);
            } else if (Math.abs(dy) > 8) s.axis = "y";
          }
          if (s.axis === "x") {
            moved.current = true;
            setDrag(Math.min(0, Math.max(-ACTION_WIDTH * 1.4, s.base + dx)));
          }
        }}
        onPointerUp={() => {
          if (start.current?.axis === "x" && drag !== null) onOpenChange(drag < -ACTION_WIDTH / 2);
          start.current = null;
          setDrag(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        onClickCapture={(e) => {
          // A swipe shouldn't also count as a tap on whatever is under the finger; a tap on an open row closes it
          if (moved.current || open) {
            e.stopPropagation();
            e.preventDefault();
            moved.current = false;
            if (open) onOpenChange(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
