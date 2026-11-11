import { useEffect, useState } from "react";
import { Camera, type LucideIcon } from "lucide-react";
import { PlantPhoto } from "@/components/PlantPhoto";

/** Tap-to-pick photo area: shows the new pick, else the current photo, else an "Add a photo" prompt. */
export function PhotoPicker({
  photoPath,
  onChange,
  placeholderIcon,
  compact = false,
}: {
  photoPath?: string | null;
  onChange: (file: File | null) => void;
  placeholderIcon?: LucideIcon;
  /** A small one-line row instead of the big photo area — for places where a photo is a nice extra. */
  compact?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const hasPhoto = !!preview || !!photoPath;

  const input = (
    <input
      type="file"
      accept="image/*"
      className="sr-only"
      onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        onChange(f);
        setPreview(f ? URL.createObjectURL(f) : null);
      }}
    />
  );

  if (compact) {
    return (
      <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border bg-card p-2 pr-4">
        <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-sm,0.5rem)] bg-secondary">
          {preview ? (
            <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
          ) : photoPath ? (
            <PlantPhoto path={photoPath} alt="" icon={placeholderIcon} className="absolute inset-0" />
          ) : (
            <Camera className="size-5 text-muted-foreground" strokeWidth={1.5} />
          )}
        </span>
        <span className="text-sm">
          {hasPhoto ? "Change photo" : "Add a photo"}
          {!hasPhoto && <span className="text-muted-foreground"> (optional)</span>}
        </span>
        {input}
      </label>
    );
  }

  return (
    <label className="relative grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden rounded-[var(--radius-xl)] border-2 border-dashed bg-card">
      {preview ? (
        <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
      ) : photoPath ? (
        <PlantPhoto path={photoPath} alt="" icon={placeholderIcon} className="absolute inset-0" />
      ) : (
        <span className="flex flex-col items-center gap-2 text-muted-foreground">
          <Camera className="size-8" strokeWidth={1.5} />
          Add a photo
        </span>
      )}
      {hasPhoto && (
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-[var(--radius)] bg-card px-3 py-1.5 text-sm">
          <Camera className="size-4" /> Change photo
        </span>
      )}
      {input}
    </label>
  );
}
