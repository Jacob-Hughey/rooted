import { differenceInCalendarDays, startOfDay } from "date-fns";
import type { LightLevel, Plant } from "./types";

export type WaterStatus = "overdue" | "today" | "soon" | "ok" | "unknown";

/** Local-day bucket for a plant's next watering (the DB view uses UTC; this uses the device's day). */
export function waterStatus(plant: Pick<Plant, "next_water_at">, now = new Date()): WaterStatus {
  if (!plant.next_water_at) return "unknown";
  const days = differenceInCalendarDays(startOfDay(new Date(plant.next_water_at)), startOfDay(now));
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 2) return "soon";
  return "ok";
}

export function waterLabel(plant: Pick<Plant, "next_water_at">, now = new Date()): string {
  if (!plant.next_water_at) return "Not watered yet";
  const days = differenceInCalendarDays(startOfDay(new Date(plant.next_water_at)), startOfDay(now));
  if (days < -1) return `${-days} days late`;
  if (days === -1) return "1 day late";
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** Days until the next watering (negative = late), or null if it has never been watered. */
export function daysUntilWater(plant: Pick<Plant, "next_water_at">, now = new Date()): number | null {
  if (!plant.next_water_at) return null;
  return differenceInCalendarDays(startOfDay(new Date(plant.next_water_at)), startOfDay(now));
}

/** Watered at some point today (device's local day). */
export function wateredToday(plant: Pick<Plant, "last_watered_at">, now = new Date()): boolean {
  return !!plant.last_watered_at && differenceInCalendarDays(new Date(plant.last_watered_at), now) === 0;
}

/** The name she'd use: the nickname if she gave one, otherwise the plant's name. */
export const displayName = (plant: Pick<Plant, "name" | "nickname">) => plant.nickname || plant.name;

/** Light as it reads mid-sentence: "Living room, bright indirect light". */
export const LIGHT_PHRASE: Record<LightLevel, string> = {
  low: "low light",
  medium: "medium light",
  bright_indirect: "bright indirect light",
  direct: "direct sun",
};

export const LIGHT_LABEL: Record<LightLevel, string> = {
  low: "Low light",
  medium: "Medium light",
  bright_indirect: "Bright, indirect",
  direct: "Direct sun",
};

/** Starting intervals for common houseplants — a friendly default when adding a plant. */
export const WATERING_PRESETS: { label: string; days: number }[] = [
  { label: "Thirsty (ferns, calatheas)", days: 4 },
  { label: "Weekly (pothos, monstera)", days: 7 },
  { label: "Relaxed (ZZ, snake plant)", days: 14 },
  { label: "Desert (cacti, succulents)", days: 21 },
];

/** A gentle hint for the watering picker. Light changes how fast soil dries; it doesn't change the numbers. */
export function lightWaterHint(light: LightLevel | null): string | null {
  switch (light) {
    case "direct":
    case "bright_indirect":
      return "Bright spot: soil dries faster here, so it may want water a little sooner than usual.";
    case "low":
      return "Low light: soil stays damp longer here, so it can usually go a little longer between waterings.";
    default:
      return null;
  }
}
