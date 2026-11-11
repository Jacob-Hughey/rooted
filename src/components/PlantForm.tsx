import { useState, type FormEvent, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoPicker } from "@/components/PhotoPicker";
import { usePlaces } from "@/data/queries";
import { LIGHT_LABEL, lightWaterHint, WATERING_PRESETS } from "@/lib/watering";
import type { LightLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

export const field =
  "h-12 w-full rounded-[var(--radius-md)] border border-input bg-card px-4 text-base";

export interface PlantFormValues {
  name: string;
  nickname: string;
  species: string;
  roomId: string;
  /** null = same as the room */
  light: LightLevel | null;
  waterDays: number;
  notes: string;
}

export const EMPTY_PLANT: PlantFormValues = { name: "", nickname: "", species: "", roomId: "", light: null, waterDays: 7, notes: "" };

const MIN_DAYS = 1;
const MAX_DAYS = 120; // matches the check constraint on plants.water_interval_days

/**
 * The plant fields shared by "New plant" and "Edit plant".
 * The parent decides what saving means; this handles form state, the photo picker and errors.
 */
export function PlantForm({
  initial,
  photoPath,
  submitLabel,
  savingLabel,
  onSubmit,
  extra,
}: {
  initial: PlantFormValues;
  /** Current cover photo (edit only), shown until a new one is picked. */
  photoPath?: string | null;
  submitLabel: string;
  savingLabel: string;
  onSubmit: (values: PlantFormValues, newPhoto: File | null) => Promise<void>;
  /** Rendered under the watering section (e.g. "I watered it today"). */
  extra?: ReactNode;
}) {
  const { data: places } = usePlaces();
  const [v, setV] = useState(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof PlantFormValues>(key: K, value: PlantFormValues[K]) =>
    setV((s) => ({ ...s, [key]: value }));
  const setDays = (d: number) => set("waterDays", Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(d) || MIN_DAYS)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(
        { ...v, name: v.name.trim(), nickname: v.nickname.trim(), species: v.species.trim(), notes: v.notes.trim() },
        photo,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the plant");
    } finally {
      setSaving(false);
    }
  }

  const roomLight = places?.rooms.find((r) => r.id === v.roomId)?.light ?? null;
  const lightHint = lightWaterHint(v.light ?? roomLight);

  return (
    <form onSubmit={submit} className="space-y-6">
      <PhotoPicker photoPath={photoPath} onChange={setPhoto} />

      <div className="space-y-3">
        <input required placeholder="Name (e.g. Monstera)" value={v.name} onChange={(e) => set("name", e.target.value)} className={field} />
        <input placeholder="Nickname (optional, e.g. Monty)" value={v.nickname} onChange={(e) => set("nickname", e.target.value)} className={field} />
        <input placeholder="Species (optional)" value={v.species} onChange={(e) => set("species", e.target.value)} className={field} />
        <select value={v.roomId} onChange={(e) => set("roomId", e.target.value)} className={field}>
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
        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Light where it sits</span>
          <select
            value={v.light ?? ""}
            onChange={(e) => set("light", (e.target.value || null) as LightLevel | null)}
            className={field}
          >
            <option value="">
              {v.roomId ? `Same as the room (${roomLight ? LIGHT_LABEL[roomLight] : "not set"})` : "Not set"}
            </option>
            {(Object.keys(LIGHT_LABEL) as LightLevel[]).map((l) => (
              <option key={l} value={l}>
                {LIGHT_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-bold">How thirsty is it?</legend>
        <div className="grid grid-cols-2 gap-2">
          {WATERING_PRESETS.map((p) => (
            <button
              type="button"
              key={p.days}
              onClick={() => setDays(p.days)}
              className={cn(
                "rounded-[var(--radius-md)] border p-3 text-left text-sm transition-colors",
                v.waterDays === p.days ? "border-primary bg-secondary" : "bg-card",
              )}
            >
              <span className="block font-medium">Every {p.days} days</span>
              <span className="text-muted-foreground">{p.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border bg-card p-2 pl-4">
          <span className="text-sm">
            Every <strong className="font-medium">{v.waterDays}</strong> {v.waterDays === 1 ? "day" : "days"}
          </span>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label="One day less" onClick={() => setDays(v.waterDays - 1)} disabled={v.waterDays <= MIN_DAYS}>
              <Minus />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="One day more" onClick={() => setDays(v.waterDays + 1)} disabled={v.waterDays >= MAX_DAYS}>
              <Plus />
            </Button>
          </div>
        </div>
        {lightHint && <p className="rounded-[var(--radius-md)] bg-secondary px-3 py-2 text-sm">{lightHint}</p>}
        <p className="text-xs text-muted-foreground">
          The schedule stretches in winter and learns from "soil still damp" check-ins.
        </p>
        {extra}
      </fieldset>

      <textarea
        placeholder="Notes (optional) — where it came from, quirks, what it likes"
        value={v.notes}
        onChange={(e) => set("notes", e.target.value)}
        rows={3}
        className={cn(field, "h-auto py-3")}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="lg" className="w-full" disabled={saving || !v.name.trim()}>
        {saving ? savingLabel : submitLabel}
      </Button>
    </form>
  );
}
