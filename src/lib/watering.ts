import { differenceInCalendarDays, startOfDay } from "date-fns";
import type { Plant } from "./types";

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
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return "1 day overdue";
  if (days === 0) return "Water today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export const LIGHT_LABEL: Record<string, string> = {
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
