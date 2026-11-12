import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { format } from "date-fns";
import { ArchiveRestore, Camera, ChevronLeft, Droplet, NotebookPen, Plus } from "lucide-react";
import { AddPhotoButton } from "@/components/AddPhotoButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { dayPhrase, DayPicker, dayToTimestamp, type CareDay } from "@/components/DayPicker";
import { NoteEditor } from "@/components/NoteEditor";
import { SwipeRow } from "@/components/SwipeRow";
import { PlantPhoto } from "@/components/PlantPhoto";
import { PhotoViewer } from "@/components/PhotoViewer";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  useAddPlantPhoto,
  useCareHistory,
  useDeletePhoto,
  useLogCare,
  usePlant,
  usePlantPhotos,
  useUndoCare,
  useUpdateCareNote,
  useUpdatePlant,
} from "@/data/queries";
import { daysUntilWater, displayName, LIGHT_PHRASE } from "@/lib/watering";
import type { CareEvent, CareType, PlantPhotoRow, PlantWithPlace } from "@/lib/types";

const EVENT_LABEL: Record<CareType, string> = {
  water: "Watered",
  check_moist: "Checked, soil still damp",
  fertilize: "Fertilized",
  mist: "Misted",
  repot: "Repotted",
  prune: "Pruned",
  rotate: "Rotated",
  note: "Note",
  photo: "New photo",
};

/** Short name for a history entry: the note's opening words, or the action. */
function entryName(ev: CareEvent) {
  if (ev.type === "note" && ev.note) return ev.note.length > 40 ? `${ev.note.slice(0, 40).trimEnd()}…` : ev.note;
  return EVENT_LABEL[ev.type];
}

/** Toast wording per action, matching the button that was tapped. "{name} watered yesterday" */
function loggedToast(name: string, type: CareType, day: CareDay) {
  const when = dayPhrase(day) === "today" ? "" : ` ${dayPhrase(day)}`;
  if (type === "note") return `Note added${when && ` for ${dayPhrase(day).replace(/^on /, "")}`}`;
  if (type === "water") return `${name} watered${when}`;
  if (type === "fertilize") return `${name} fertilized${when}`;
  if (type === "check_moist") return `${name} checked${when}, still damp`;
  return `${name} updated`;
}

/** "Wants water every 7 days. Last watered November 2, so it's 2 days late." */
function Rhythm({ plant }: { plant: PlantWithPlace }) {
  const every = plant.water_interval_days === 1 ? "every day" : `every ${plant.water_interval_days} days`;
  const d = daysUntilWater(plant);
  const last = plant.last_watered_at ? `Last watered ${format(new Date(plant.last_watered_at), "MMMM d")}` : null;

  let tail: React.ReactNode = null;
  if (plant.archived_at) tail = last ? `${last}.` : null; // archived plants are off the schedule: never "late"
  else if (!last) tail = "It hasn’t been watered in Rooted yet.";
  else if (d === null) tail = `${last}.`;
  else if (d < 0) tail = <>{last}, so it’s <strong className="font-bold text-late">{-d === 1 ? "1 day" : `${-d} days`} late</strong>.</>;
  else if (d === 0) tail = <>{last}, so it’s <strong className="font-bold">due today</strong>.</>;
  else tail = <>{last}. Next watering {d === 1 ? "tomorrow" : `in ${d} days`}.</>;

  return (
    <p className="max-w-[34ch] text-lg leading-relaxed">
      Wants water <strong className="font-bold">{every}</strong>. {tail}
    </p>
  );
}

/** The plant's standing note ("about this plant"), edited in place. Stored on plants.notes. */
function AboutNote({ plant }: { plant: PlantWithPlace }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdatePlant();
  const toast = useToast();

  if (editing) {
    return (
      <NoteEditor
        initial={plant.notes ?? ""}
        label="About this plant"
        placeholder="Where it came from, quirks, what it likes"
        saving={update.isPending}
        onCancel={() => setEditing(false)}
        onSave={(text) =>
          update.mutate(
            { plant, patch: { notes: text || null } },
            {
              onSuccess: () => {
                setEditing(false);
                toast(text ? "Note saved" : "Note removed");
              },
              onError: () => toast("Couldn't save the note. Check your connection and try again."),
            },
          )
        }
      />
    );
  }

  if (!plant.notes) {
    return (
      <button onClick={() => setEditing(true)} className="flex h-11 items-center gap-1.5 font-medium text-water">
        <Plus className="size-5" /> Add a note about this plant
      </button>
    );
  }

  return (
    <div className="max-w-prose">
      <p className="whitespace-pre-line">{plant.notes}</p>
      <button onClick={() => setEditing(true)} className="-ml-1 mt-1 h-11 px-1 text-sm font-medium text-water">
        Edit note
      </button>
    </div>
  );
}

export default function PlantDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: plant } = usePlant(id);
  const { data: history = [] } = useCareHistory(id);
  const log = useLogCare();
  const undo = useUndoCare();
  const update = useUpdatePlant();
  const updateNote = useUpdateCareNote();
  const toast = useToast();
  const [writingNote, setWritingNote] = useState(false);
  // Day the next logged care happened; null = today. Resets after each log so a later tap isn't backdated by accident.
  const [careDay, setCareDay] = useState<CareDay>(null);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [swipedEvent, setSwipedEvent] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CareEvent | null>(null);
  const { data: photos = [] } = usePlantPhotos(id);
  const addPhoto = useAddPlantPhoto();
  const deletePhoto = useDeletePhoto();
  const [viewing, setViewing] = useState<number | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<PlantPhotoRow | null>(null);

  if (!plant) return <div className="-mx-5 aspect-[4/5] max-h-[45dvh] animate-pulse bg-muted md:mx-0 md:rounded-[var(--radius-xl)]" />;

  const name = displayName(plant);
  const pastDay = dayPhrase(careDay) !== "today";
  const noteDay = dayPhrase(careDay).replace(/^on /, "");
  const place = [plant.room_name, plant.effective_light && LIGHT_PHRASE[plant.effective_light]].filter(Boolean).join(", ");

  function onPickPhoto(file: File) {
    addPhoto.mutate(
      { plant: plant!, file },
      {
        onSuccess: () => toast("Photo added"),
        onError: () => toast("Couldn't add the photo. Check your connection and try again."),
      },
    );
  }

  // History shows care events and photos together, newest first
  type Entry = { kind: "event"; ev: CareEvent; at: string } | { kind: "photo"; photo: PlantPhotoRow; at: string };
  const entries: Entry[] = [
    ...history.map((ev): Entry => ({ kind: "event", ev, at: ev.performed_at })),
    ...photos.map((photo): Entry => ({ kind: "photo", photo, at: photo.taken_at })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  function logCare(type: CareType, note?: string) {
    const day = careDay;
    log.mutate(
      { plant: plant!, type, note, performedAt: dayToTimestamp(day) },
      {
        onSuccess: (ev: CareEvent) => {
          if (type === "note") setWritingNote(false);
          setCareDay(null);
          toast(loggedToast(name, type, day), {
            label: "Undo",
            onClick: () => undo.mutate(ev),
          });
        },
        onError: () => toast("Couldn't save. Check your connection and try again."),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl md:pt-6">
      {/* Photo bleeds to the screen edges on phones */}
      <div className="relative -mx-5 -mt-[max(env(safe-area-inset-top),0.75rem)] md:mx-0 md:mt-0">
        <PlantPhoto path={plant.cover_photo_path} alt={name} className="aspect-[4/5] max-h-[45dvh] w-full md:aspect-[16/10] md:rounded-[var(--radius-xl)]" />
        <button
          onClick={() => nav(-1)}
          aria-label="Back"
          className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)] grid size-11 place-items-center rounded-full bg-card text-foreground"
        >
          <ChevronLeft className="size-6" />
        </button>
        <div className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] flex gap-2">
          {plant.cover_photo_path && (
            <AddPhotoButton
              onPick={onPickPhoto}
              disabled={addPhoto.isPending}
              label="Add a photo"
              className="grid size-11 cursor-pointer place-items-center rounded-full bg-card text-foreground aria-disabled:opacity-60"
            >
              <Camera className="size-5" />
            </AddPhotoButton>
          )}
          <Link to={`/plants/${plant.id}/edit`} className="flex h-11 items-center rounded-full bg-card px-4 font-bold text-foreground">
            Edit
          </Link>
        </div>
        {!plant.cover_photo_path && (
          <AddPhotoButton
            onPick={onPickPhoto}
            disabled={addPhoto.isPending}
            className="absolute inset-x-0 bottom-6 mx-auto flex h-11 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius)] bg-card px-4 font-medium"
          >
            <Camera className="size-5" /> {addPhoto.isPending ? "Adding photo…" : "Add a photo"}
          </AddPhotoButton>
        )}
      </div>

      <div className="mt-5 space-y-1">
        <h1 className="text-[2.75rem]">{name}</h1>
        {plant.species && <p className="text-lg italic text-muted-foreground">{plant.species}</p>}
        {place && <p className="text-muted-foreground">{place}</p>}
      </div>

      <div className="mt-3">
        <AboutNote plant={plant} />
      </div>

      {plant.archived_at && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-secondary p-4">
          <p>Archived {format(new Date(plant.archived_at), "MMMM d, yyyy")}</p>
          <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ plant, patch: { archived_at: null } })}>
            <ArchiveRestore /> Restore
          </Button>
        </div>
      )}

      <div className="mt-5">
        <Rhythm plant={plant} />
      </div>

      <div className="mt-5">
        <DayPicker value={careDay} onChange={setCareDay} disabled={log.isPending} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Button variant="water" size="lg" className="col-span-2" disabled={log.isPending} onClick={() => logCare("water")}>
          <Droplet /> {pastDay ? `Watered ${dayPhrase(careDay)}` : "Mark as watered"}
        </Button>
        <Button variant="outline" disabled={log.isPending} onClick={() => logCare("check_moist")}>
          Soil still damp
        </Button>
        <Button variant="outline" disabled={log.isPending} onClick={() => logCare("fertilize")}>
          Fertilized
        </Button>
        {!writingNote && (
          <Button variant="outline" className="col-span-2" onClick={() => setWritingNote(true)}>
            <NotebookPen /> Note for {noteDay}
          </Button>
        )}
      </div>

      {writingNote && (
        <div className="mt-3">
          <NoteEditor
            label={`Note for ${noteDay} about ${name}`}
            placeholder="New leaf, a pest spotted, moved it to the window…"
            saveLabel="Add note"
            saving={log.isPending}
            onCancel={() => setWritingNote(false)}
            onSave={(text) => logCare("note", text)}
          />
        </div>
      )}

      {(photos.length > 0 || addPhoto.isPending) && (
        <section className="mt-9">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl">Photos</h2>
            <span className="text-muted-foreground">{photos.length === 1 ? "1 photo" : `${photos.length} photos`}</span>
          </div>
          <ul className="-mx-5 mt-2 flex snap-x gap-3 overflow-x-auto px-5 pb-1 scrollbar-none md:mx-0 md:px-0">
            <li className="shrink-0 snap-start">
              <AddPhotoButton
                onPick={onPickPhoto}
                disabled={addPhoto.isPending}
                className="flex h-[7.5rem] w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-input/70 text-sm text-muted-foreground aria-disabled:opacity-60"
              >
                <Camera className="size-6" strokeWidth={1.6} />
                {addPhoto.isPending ? "Adding…" : "Add photo"}
              </AddPhotoButton>
            </li>
            {addPhoto.isPending && (
              <li className="shrink-0" aria-hidden="true">
                <div className="h-[7.5rem] w-24 animate-pulse rounded-[10px] bg-muted" />
              </li>
            )}
            {photos.map((ph, i) => (
              <li key={ph.id} className="shrink-0 snap-start">
                <button onClick={() => setViewing(i)} className="block w-24 rounded-[10px] text-left">
                  <PlantPhoto path={ph.path} alt="" className="h-[7.5rem] w-24 rounded-[10px]" />
                  <span className="mt-1 block text-sm">{format(new Date(ph.taken_at), "MMM d")}</span>
                  <span className="sr-only">, photo of {name}{ph.path === plant.cover_photo_path ? ", cover photo" : ""}</span>
                  {ph.path === plant.cover_photo_path && (
                    <span aria-hidden="true" className="block text-xs text-muted-foreground">Cover</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-9">
        <h2 className="text-2xl">History</h2>
        {entries.length > 0 && <p className="mb-2 text-sm text-muted-foreground">Swipe left on an entry to delete it.</p>}
        {entries.length === 0 ? (
          <p className="text-muted-foreground">Nothing logged yet. Waterings, notes and photos will show up here.</p>
        ) : (
          <ol>
            {entries.map((en) => {
              if (en.kind === "photo") {
                const ph = en.photo;
                return (
                  <li key={`photo-${ph.id}`} className="border-b last:border-b-0">
                    <SwipeRow
                      open={swipedEvent === ph.id}
                      onOpenChange={(o) => setSwipedEvent(o ? ph.id : null)}
                      onDelete={() => setDeletingPhoto(ph)}
                      deleteLabel={`Delete photo, ${format(new Date(ph.taken_at), "MMMM d")}`}
                    >
                      <button
                        onClick={() => setViewing(photos.indexOf(ph))}
                        className="grid w-full grid-cols-[4.5rem_1fr] items-center gap-x-2 py-2 text-left"
                      >
                        <time dateTime={ph.taken_at} className="text-muted-foreground">
                          {format(new Date(ph.taken_at), "MMM d")}
                        </time>
                        <span className="flex items-center gap-3">
                          <PlantPhoto path={ph.path} alt="" className="size-11 shrink-0 rounded-[8px]" />
                          <span>
                            New photo
                            {ph.caption && <span className="block text-sm text-muted-foreground">{ph.caption}</span>}
                          </span>
                        </span>
                      </button>
                    </SwipeRow>
                  </li>
                );
              }
              const ev = en.ev;
              return (
              <li key={ev.id} className="border-b last:border-b-0">
                <SwipeRow
                  open={swipedEvent === ev.id}
                  onOpenChange={(o) => setSwipedEvent(o ? ev.id : null)}
                  onDelete={() => setDeleting(ev)}
                  deleteLabel={`Delete ${entryName(ev)}, ${format(new Date(ev.performed_at), "MMMM d")}`}
                  disabled={editingEvent === ev.id}
                >
                <div className="grid grid-cols-[4.5rem_1fr] gap-x-2 py-2.5">
                <time
                  dateTime={ev.performed_at}
                  title={format(new Date(ev.performed_at), "PPpp")}
                  className="text-muted-foreground"
                >
                  {format(new Date(ev.performed_at), "MMM d")}
                </time>
                {editingEvent === ev.id ? (
                  <NoteEditor
                    initial={ev.note ?? ""}
                    label={`Edit note from ${format(new Date(ev.performed_at), "MMMM d")}`}
                    saving={updateNote.isPending}
                    onCancel={() => setEditingEvent(null)}
                    onSave={(text) =>
                      text
                        ? updateNote.mutate({ ev, note: text }, { onSuccess: () => setEditingEvent(null) })
                        : undo.mutate(ev, { onSuccess: () => setEditingEvent(null) })
                    }
                    onDelete={
                      ev.type === "note"
                        ? () => undo.mutate(ev, { onSuccess: () => { setEditingEvent(null); toast("Note deleted"); } })
                        : undefined
                    }
                  />
                ) : ev.type === "note" ? (
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-line">{ev.note}</p>
                    <button
                      onClick={() => setEditingEvent(ev.id)}
                      className="-my-2 h-10 shrink-0 px-1 text-sm font-medium text-water"
                      aria-label={`Edit note from ${format(new Date(ev.performed_at), "MMMM d")}`}
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div>
                    <p>{EVENT_LABEL[ev.type]}</p>
                    {ev.note && <p className="whitespace-pre-line text-sm text-muted-foreground">{ev.note}</p>}
                  </div>
                )}
                </div>
                </SwipeRow>
              </li>
              );
            })}
          </ol>
        )}
        <ConfirmDialog
          open={!!deleting}
          title="Delete this entry?"
          confirmLabel="Delete entry"
          busy={undo.isPending}
          onCancel={() => {
            setDeleting(null);
            setSwipedEvent(null);
          }}
          onConfirm={() =>
            deleting &&
            undo.mutate(deleting, {
              onSuccess: () => {
                setDeleting(null);
                setSwipedEvent(null);
                toast("Entry deleted");
              },
              onError: () => toast("Couldn't delete it. Check your connection and try again."),
            })
          }
        >
          {deleting && (
            <p>
              “{entryName(deleting)}” on {format(new Date(deleting.performed_at), "MMMM d")} will be removed from {name}’s history.
              {deleting.type === "water" && " The next watering will be worked out from the one before it."}
              {deleting.type === "check_moist" && " The watering schedule goes back to how it was before this check-in."}
            </p>
          )}
        </ConfirmDialog>
        <ConfirmDialog
          open={!!deletingPhoto}
          title="Delete this photo?"
          confirmLabel="Delete photo"
          busy={deletePhoto.isPending}
          onCancel={() => {
            setDeletingPhoto(null);
            setSwipedEvent(null);
          }}
          onConfirm={() =>
            deletingPhoto &&
            deletePhoto.mutate(
              { photo: deletingPhoto, plant },
              {
                onSuccess: () => {
                  setDeletingPhoto(null);
                  setSwipedEvent(null);
                  toast("Photo deleted");
                },
                onError: () => toast("Couldn't delete it. Check your connection and try again."),
              },
            )
          }
        >
          {deletingPhoto && (
            <p>
              The photo from {format(new Date(deletingPhoto.taken_at), "MMMM d")} will be removed from {name}’s photos.
              {deletingPhoto.path === plant.cover_photo_path && photos.length > 1 && " The next newest photo becomes the cover."}
            </p>
          )}
        </ConfirmDialog>
      </section>

      {viewing !== null && photos.length > 0 && (
        <PhotoViewer
          plant={plant}
          name={name}
          photos={photos}
          startIndex={Math.min(viewing, photos.length - 1)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
