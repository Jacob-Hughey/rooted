import { useEffect, useRef, useState } from "react";
import { differenceInCalendarDays, format, formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PlantPhoto } from "@/components/PlantPhoto";
import { useDeletePhoto, useSetCover } from "@/data/queries";
import type { Plant, PlantPhotoRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const when = (iso: string) => {
  const d = new Date(iso);
  return differenceInCalendarDays(new Date(), d) === 0 ? "Today" : formatDistanceToNow(d, { addSuffix: true });
};

/** Whether a point is on the visible picture of an object-contain <img> (not its letterbox bars). */
function onPicture(img: HTMLImageElement, x: number, y: number) {
  const r = img.getBoundingClientRect();
  if (!img.naturalWidth || !img.naturalHeight) return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const left = r.left + (r.width - w) / 2;
  const top = r.top + (r.height - h) / 2;
  return x >= left && x <= left + w && y >= top && y <= top + h;
}

function apart(later: string, earlier: string) {
  const a = new Date(later);
  const b = new Date(earlier);
  if (differenceInCalendarDays(a, b) === 0) return "Same day";
  return `${formatDistanceStrict(a, b, { roundingMethod: "floor" })} of growth`;
}

/**
 * Full-screen photo viewer. Photos are newest first; swipe left (or press →) for older ones.
 * "Compare with first" puts the photo next to the plant's first photo.
 */
export function PhotoViewer({
  plant,
  name,
  photos,
  startIndex,
  onClose,
}: {
  plant: Pick<Plant, "id" | "cover_photo_path">;
  name: string;
  photos: PlantPhotoRow[];
  startIndex: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(startIndex);
  const [compare, setCompare] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const setCover = useSetCover();
  const del = useDeletePhoto();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // The list shrinks after a delete: stay in range, close when nothing is left
  useEffect(() => {
    if (photos.length === 0) onClose();
    else if (index > photos.length - 1) setIndex(photos.length - 1);
  }, [photos.length, index, onClose]);

  const photo = photos[Math.min(index, photos.length - 1)];
  if (!photo) return null;
  const first = photos[photos.length - 1];
  const isFirst = photo.id === first.id;
  const isCover = plant.cover_photo_path === photo.path;
  const showCompare = compare && !isFirst;

  const go = (step: number) => {
    setIndex((i) => Math.min(photos.length - 1, Math.max(0, i + step)));
    if (index + step >= photos.length - 1) setCompare(false);
  };

  const darkButton =
    "inline-flex h-11 items-center gap-2 rounded-[var(--radius)] border border-white/30 px-4 font-medium text-white disabled:opacity-70";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`Photos of ${name}`}
      onKeyDown={(e) => {
        if (confirmDelete) return;
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#0e1a14] p-0 text-[#eef3f0] backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 pt-safe">
          <button
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-full bg-white/10"
          >
            <X className="size-6" />
          </button>
          <p className="text-white/80">
            {index + 1} of {photos.length}
          </p>
          <span className="size-11" aria-hidden="true" />
        </div>

        <div
          className="relative min-h-0 flex-1"
          style={{ touchAction: "pan-y" }}
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY };
            swiped.current = false;
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            if (Math.hypot(dx, dy) > 10) swiped.current = true; // a drag, not a tap
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          }}
          onClick={(e) => {
            // Tapping the empty space around the photo closes the viewer; taps on the photo, text or buttons don't
            if (swiped.current) return;
            const target = e.target as HTMLElement;
            if (target.closest("button, p, figcaption")) return;
            const imgs = [...e.currentTarget.querySelectorAll("img")];
            if (imgs.some((img) => onPicture(img, e.clientX, e.clientY))) return;
            ref.current?.close();
          }}
        >
          {showCompare ? (
            <div className="flex h-full flex-col px-4 py-3">
              <p className="pb-3 text-center text-2xl font-bold">{apart(photo.taken_at, first.taken_at)}</p>
              <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 md:grid-cols-2 md:grid-rows-1">
                {[first, photo].map((p, i) => (
                  <figure key={p.id} className="flex min-h-0 flex-col">
                    <PlantPhoto path={p.path} alt={`${name}, ${format(new Date(p.taken_at), "MMMM d, yyyy")}`} fit="contain" className="min-h-0 flex-1" />
                    <figcaption className="pt-1.5 text-center text-white/80">
                      {i === 0 ? "First photo" : "This photo"}, {format(new Date(p.taken_at), "MMM d, yyyy")}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : (
            <PlantPhoto
              key={photo.id}
              path={photo.path}
              alt={`${name}, ${format(new Date(photo.taken_at), "MMMM d, yyyy")}`}
              fit="contain"
              className="absolute inset-0 animate-in fade-in duration-200"
            />
          )}

          {/* Arrows for iPad keyboards, mice and anyone who doesn't swipe */}
          {index > 0 && (
            <button
              onClick={() => go(-1)}
              aria-label="Newer photo"
              className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 md:grid"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}
          {index < photos.length - 1 && (
            <button
              onClick={() => go(1)}
              aria-label="Older photo"
              className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 md:grid"
            >
              <ChevronRight className="size-6" />
            </button>
          )}
        </div>

        <div className="space-y-3 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3">
          {!showCompare && (
            <div>
              <p className="text-lg font-bold">{format(new Date(photo.taken_at), "MMMM d, yyyy")}</p>
              <p className="text-white/70">{when(photo.taken_at)}</p>
              {photo.caption && <p className="mt-1">{photo.caption}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className={darkButton}
              disabled={isCover || setCover.isPending}
              onClick={() => setCover.mutate({ plantId: plant.id, path: photo.path })}
            >
              {isCover ? (
                <>
                  <Check className="size-5" /> Cover photo
                </>
              ) : (
                "Use as cover"
              )}
            </button>
            {!isFirst && (
              <button
                className={cn(darkButton, compare && "border-white bg-white text-[#0e1a14]")}
                aria-pressed={compare}
                onClick={() => setCompare((c) => !c)}
              >
                Compare with first
              </button>
            )}
            <button className={cn(darkButton, "ml-auto border-transparent text-[#ffb4ab]")} onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this photo?"
        confirmLabel="Delete photo"
        busy={del.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          del.mutate(
            { photo, plant },
            {
              onSuccess: () => {
                setConfirmDelete(false);
                setCompare(false);
              },
            },
          )
        }
      >
        <p>
          The photo from {format(new Date(photo.taken_at), "MMMM d")} will be removed from {name}’s photos.
          {isCover && photos.length > 1 && " The next newest photo becomes the cover."}
        </p>
      </ConfirmDialog>
    </dialog>
  );
}
