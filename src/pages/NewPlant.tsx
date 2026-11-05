import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Camera, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreatePlant, useHousehold, usePlaces } from "@/data/queries";
import { uploadPhoto } from "@/lib/photos";
import { WATERING_PRESETS } from "@/lib/watering";
import { cn } from "@/lib/utils";

const field = "h-12 w-full rounded-[var(--radius-md)] border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring";

export default function NewPlant() {
  const nav = useNavigate();
  const { data: household } = useHousehold();
  const { data: places } = usePlaces();
  const create = useCreatePlant();

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [roomId, setRoomId] = useState<string>("");
  const [waterDays, setWaterDays] = useState(7);
  const [wateredToday, setWateredToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!household) return;
    setSaving(true);
    setError(null);
    try {
      const cover = photo ? await uploadPhoto(household.id, "plants", photo) : null;
      const { id } = await create.mutateAsync({
        household_id: household.id,
        name: name.trim(),
        species: species.trim() || undefined,
        room_id: roomId || null,
        water_interval_days: waterDays,
        cover_photo_path: cover,
        last_watered_at: wateredToday ? new Date().toISOString() : null,
      });
      nav(`/plants/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the plant");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-lg space-y-6 pt-4">
      <button type="button" onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Back
      </button>
      <h1 className="text-3xl">New plant</h1>

      <label className="relative grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden rounded-[var(--radius-xl)] border-2 border-dashed bg-card">
        {preview ? (
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <Camera className="size-8" strokeWidth={1.5} />
            Add a photo
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setPhoto(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>

      <div className="space-y-3">
        <input required placeholder="Name (e.g. Monstera)" value={name} onChange={(e) => setName(e.target.value)} className={field} />
        <input placeholder="Species (optional)" value={species} onChange={(e) => setSpecies(e.target.value)} className={field} />
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={field}>
          <option value="">No room yet</option>
          {places?.locations.map((loc) => (
            <optgroup key={loc.id} label={loc.name}>
              {places.rooms
                .filter((r) => r.location_id === loc.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-display text-lg">How thirsty is it?</legend>
        <div className="grid grid-cols-2 gap-2">
          {WATERING_PRESETS.map((p) => (
            <button
              type="button"
              key={p.days}
              onClick={() => setWaterDays(p.days)}
              className={cn(
                "rounded-[var(--radius-md)] border p-3 text-left text-sm transition-colors",
                waterDays === p.days ? "border-primary bg-secondary" : "bg-card",
              )}
            >
              <span className="block font-medium">Every {p.days} days</span>
              <span className="text-muted-foreground">{p.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          The schedule stretches in winter and learns from "soil still damp" check-ins.
        </p>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={wateredToday} onChange={(e) => setWateredToday(e.target.checked)} className="size-5 accent-[var(--primary)]" />
          I watered it today
        </label>
      </fieldset>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="lg" className="w-full" disabled={saving || !name.trim()}>
        {saving ? "Planting…" : "Add to the greenhouse"}
      </Button>
    </form>
  );
}
