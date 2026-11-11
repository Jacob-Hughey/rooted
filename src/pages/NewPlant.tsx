import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { EMPTY_PLANT, PlantForm, type PlantFormValues } from "@/components/PlantForm";
import { useCreatePlant, useHousehold } from "@/data/queries";
import { uploadPhoto } from "@/lib/photos";

export default function NewPlant() {
  const nav = useNavigate();
  const { data: household } = useHousehold();
  const create = useCreatePlant();
  const [wateredToday, setWateredToday] = useState(false);

  async function save(v: PlantFormValues, photo: File | null) {
    if (!household) throw new Error("Still loading your household — try again in a moment");
    const cover = photo ? await uploadPhoto(household.id, "plants", photo) : null;
    const { id } = await create.mutateAsync({
      household_id: household.id,
      name: v.name,
      nickname: v.nickname || undefined,
      species: v.species || undefined,
      light: v.light,
      notes: v.notes || undefined,
      room_id: v.roomId || null,
      water_interval_days: v.waterDays,
      cover_photo_path: cover,
      last_watered_at: wateredToday ? new Date().toISOString() : null,
    });
    nav(`/plants/${id}`, { replace: true });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-4">
      <button type="button" onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Back
      </button>
      <h1 className="text-3xl">New plant</h1>
      <PlantForm
        initial={EMPTY_PLANT}
        isNew
        submitLabel="Add to the greenhouse"
        savingLabel="Planting…"
        onSubmit={save}
        extra={
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={wateredToday} onChange={(e) => setWateredToday(e.target.checked)} className="size-5 accent-[var(--primary)]" />
            I watered it today
          </label>
        }
      />
    </div>
  );
}
