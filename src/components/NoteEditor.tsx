import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** A textarea with Save / Cancel (and optionally Delete), used inline on the plant page. */
export function NoteEditor({
  initial = "",
  label,
  placeholder,
  saveLabel = "Save note",
  saving,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: string;
  /** Read by screen readers; the textarea has no visible label. */
  label: string;
  placeholder?: string;
  saveLabel?: string;
  saving?: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const trimmed = text.trim();

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed || initial) onSave(trimmed);
      }}
    >
      <textarea
        ref={ref}
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        rows={3}
        className="w-full rounded-[var(--radius-md)] border border-input bg-card px-4 py-3 text-base"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={saving || (!trimmed && !initial) || trimmed === initial.trim()}>
          {saving ? "Saving…" : saveLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {onDelete && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
