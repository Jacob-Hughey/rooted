import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Archive, ArchiveRestore, ChevronLeft, Trash2 } from "lucide-react";
import { PlantForm, type PlantFormValues } from "@/components/PlantForm";
import { Button } from "@/components/ui/button";
import { useDeletePlant, usePlant, useUpdatePlant } from "@/data/queries";
import { uploadPhoto } from "@/lib/photos";

export default function EditPlant() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { data: plant } = usePlant(id);
  const update = useUpdatePlant();
  const del = useDeletePlant();
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);

  // Opened straight from a link (no history inside the app)? Go to the plant instead of leaving the app.
  const back = () => (location.key === "default" ? nav(`/plants/${id}`, { replace: true }) : nav(-1));

  if (!plant) return <div className="mx-auto mt-16 aspect-[4/3] max-w-lg animate-pulse rounded-[var(--radius-xl)] bg-muted" />;

  async function save(v: PlantFormValues, photo: File | null) {
    const cover = photo ? await uploadPhoto(plant!.household_id, "plants", photo) : plant!.cover_photo_path;
    await update.mutateAsync({
      plant: plant!,
      patch: {
        name: v.name,
        nickname: v.nickname || null,
        species: v.species || null,
        light: v.light,
        notes: v.notes || null,
        room_id: v.roomId || null,
        water_interval_days: v.waterDays,
        fertilize_interval_days: v.fertilizeDays,
        cover_photo_path: cover,
      },
    });
    back();
  }

  async function archive() {
    await update.mutateAsync({ plant: plant!, patch: { archived_at: new Date().toISOString() } });
    nav("/plants", { replace: true });
  }

  async function restore() {
    await update.mutateAsync({ plant: plant!, patch: { archived_at: null } });
  }

  async function deleteForever() {
    await del.mutateAsync(plant!);
    nav("/plants", { replace: true });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-4 pb-10">
      <button type="button" onClick={back} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Back
      </button>
      <h1 className="text-3xl">Edit {plant.nickname ?? plant.name}</h1>

      <PlantForm
        key={plant.id}
        initial={{
          name: plant.name,
          nickname: plant.nickname ?? "",
          species: plant.species ?? "",
          roomId: plant.room_id ?? "",
          light: plant.light,
          waterDays: plant.water_interval_days,
          fertilizeDays: plant.fertilize_interval_days,
          notes: plant.notes ?? "",
        }}
        photoPath={plant.cover_photo_path}
        submitLabel="Save changes"
        savingLabel="Saving…"
        onSubmit={save}
      />

      <div className="space-y-2 border-t pt-6">
        {confirm === "archive" ? (
          <Confirm
            text="It'll leave your lists and reminders, but its photos and care history are kept. You can restore it any time."
            action="Yes, archive it"
            busy={update.isPending}
            onYes={archive}
            onNo={() => setConfirm(null)}
          />
        ) : confirm === "delete" ? (
          <Confirm
            text="This permanently deletes the plant, its photos and its whole care history. It can't be undone."
            action="Delete forever"
            busy={del.isPending}
            onYes={deleteForever}
            onNo={() => setConfirm(null)}
          />
        ) : (
          <>
            {plant.archived_at ? (
              <Button variant="ghost" className="w-full" disabled={update.isPending} onClick={() => restore().catch(() => {})}>
                <ArchiveRestore /> Restore from archive
              </Button>
            ) : (
              <Button variant="ghost" className="w-full" onClick={() => setConfirm("archive")}>
                <Archive /> Archive (RIP or rehomed, keep its history)
              </Button>
            )}
            <Button variant="ghost" className="w-full text-destructive" onClick={() => setConfirm("delete")}>
              <Trash2 /> Delete permanently
            </Button>
          </>
        )}
        {(update.error || del.error) && (
          <p className="text-sm text-destructive">{(update.error ?? del.error)!.message}</p>
        )}
      </div>
    </div>
  );
}

function Confirm({ text, action, busy, onYes, onNo }: { text: string; action: string; busy: boolean; onYes: () => Promise<void>; onNo: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="flex gap-2">
        <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => onYes().catch(() => {})}>
          {action}
        </Button>
        <Button variant="ghost" className="flex-1" onClick={onNo}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
