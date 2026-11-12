import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SpeciesInput } from "@/components/SpeciesInput";
import { useHousehold, usePlaces } from "@/data/queries";
import { findSpecies } from "@/lib/species";
import {
  FERTILIZE_MAX_DAYS,
  FERTILIZE_MIN_DAYS,
  FERTILIZE_PRESETS,
  feedingResumes,
  isFeedingRest,
  LIGHT_LABEL,
  lightWaterHint,
  WATERING_PRESETS,
} from "@/lib/watering";
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
  /** null = no fertilizer reminder (the default) */
  fertilizeDays: number | null;
  notes: string;
}

export const EMPTY_PLANT: PlantFormValues = { name: "", nickname: "", species: "", roomId: "", light: null, waterDays: 7, fertilizeDays: null, notes: "" };

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
  isNew = false,
}: {
  initial: PlantFormValues;
  /** New plants take the species' typical interval; edits only get a note, since her interval may be tuned. */
  isNew?: boolean;
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
  /** She's picked a watering interval herself, so a species shouldn't overwrite it. */
  const [daysTouched, setDaysTouched] = useState(false);

  const set = <K extends keyof PlantFormValues>(key: K, value: PlantFormValues[K]) =>
    setV((s) => ({ ...s, [key]: value }));
  const clampDays = (d: number) => Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(d) || MIN_DAYS));
  const setDays = (d: number) => {
    setDaysTouched(true);
    set("waterDays", clampDays(d));
  };

  function setSpecies(species: string) {
    const match = findSpecies(species);
    setV((s) => ({
      ...s,
      species,
      waterDays: isNew && !daysTouched && match ? clampDays(match.water) : s.waterDays,
    }));
  }

  const species = findSpecies(v.species);
  const speciesChanged = v.species.trim() !== initial.species.trim();
  const typicalDays = species && (isNew || speciesChanged) ? species.water : null;

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
        <SpeciesInput
          value={v.species}
          onChange={setSpecies}
          // She rarely names plants, so an empty name takes the common name.
          onPick={(sp) => setV((s) => (s.name.trim() ? s : { ...s, name: sp.common }))}
          className={field}
        />
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
        {typicalDays !== null &&
          (typicalDays === v.waterDays ? (
            <p className="text-sm text-muted-foreground">
              Typical for {species!.common}: every {typicalDays} {typicalDays === 1 ? "day" : "days"}.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-secondary px-3 py-2 text-sm">
              <p>
                {species!.common} usually wants water every {typicalDays} {typicalDays === 1 ? "day" : "days"}. This one is set
                to every {v.waterDays}.
              </p>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setDays(typicalDays)}>
                Use {typicalDays} days
              </Button>
            </div>
          ))}
        {lightHint && <p className="rounded-[var(--radius-md)] bg-secondary px-3 py-2 text-sm">{lightHint}</p>}
        <p className="text-xs text-muted-foreground">
          The schedule stretches in winter and learns from "soil still damp" check-ins.
        </p>
        {extra}
      </fieldset>

      <FertilizerReminder days={v.fertilizeDays} onChange={(d) => set("fertilizeDays", d)} />

      <textarea
        placeholder="About this plant (optional): where it came from, quirks, what it likes"
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

const dayWord = (d: number) => (d === 1 ? "day" : "days");
const fertLabel = (d: number) => FERTILIZE_PRESETS.find((p) => p.days === d)?.label ?? `Every ${d} ${dayWord(d)}`;

/**
 * Opt-in fertilizer reminder, folded into one quiet row so it stays out of the way.
 * When it's due, Today shows a small nudge (never a notification), and nudges rest over winter.
 */
function FertilizerReminder({ days, onChange }: { days: number | null; onChange: (d: number | null) => void }) {
  const { data: household } = useHousehold();
  const [open, setOpen] = useState(false);
  const hemisphere = household?.hemisphere ?? "north";
  const resting = isFeedingRest(new Date(), hemisphere);
  const resumes = feedingResumes(hemisphere);
  const clamp = (d: number) => Math.min(FERTILIZE_MAX_DAYS, Math.max(FERTILIZE_MIN_DAYS, Math.round(d) || FERTILIZE_MIN_DAYS));

  const summary = days === null ? "Off" : resting ? `${fertLabel(days)} · resting until ${resumes}` : fertLabel(days);

  return (
    <div className="rounded-[var(--radius-md)] border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-medium">Fertilizer reminder</span>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          {summary}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 pt-3 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {FERTILIZE_PRESETS.map((p) => (
              <button
                type="button"
                key={p.days}
                onClick={() => onChange(p.days)}
                className={cn(
                  "rounded-[var(--radius-md)] border p-2 text-sm transition-colors",
                  days === p.days ? "border-primary bg-secondary font-medium" : "bg-card",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {days !== null && (
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border p-2 pl-4">
              <span className="text-sm">
                Every <strong className="font-medium">{days}</strong> {dayWord(days)}
              </span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label="One day less" onClick={() => onChange(clamp(days - 1))} disabled={days <= FERTILIZE_MIN_DAYS}>
                  <Minus />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="One day more" onClick={() => onChange(clamp(days + 1))} disabled={days >= FERTILIZE_MAX_DAYS}>
                  <Plus />
                </Button>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {days === null
              ? "Off unless you want it. When it's on, Today shows a small nudge when a feeding is due. No notifications."
              : "Counts from the last time you tap Fertilized, or from today if you haven't yet. It shows up as a small nudge on Today, never a notification."}
          </p>
          <p className="rounded-[var(--radius-md)] bg-secondary px-3 py-2 text-sm">
            {resting
              ? `Houseplants rest over winter, so there won't be any fertilizer nudges until ${resumes}. Anything due before then shows up once spring arrives.`
              : `Nudges pause each winter while houseplants rest, and pick back up in ${resumes}.`}
          </p>

          {days !== null && (
            <Button type="button" variant="ghost" size="sm" className="px-0 text-muted-foreground" onClick={() => onChange(null)}>
              Turn off
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
