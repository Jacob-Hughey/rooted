import type { ReactNode } from "react";

/**
 * A label wrapping a hidden file input. On iPhone and iPad this offers the camera or the photo library.
 * Style it through className; children are the visible content.
 */
export function AddPhotoButton({
  onPick,
  disabled,
  className,
  children,
  label,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  /** Accessible name when the visible content is only an icon. */
  label?: string;
}) {
  return (
    <label className={className} aria-label={label} aria-disabled={disabled || undefined}>
      {children}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // picking the same photo twice should still fire
          if (f) onPick(f);
        }}
      />
    </label>
  );
}
