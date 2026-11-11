// Hand-written domain types matching supabase/migrations/*_init.sql.
// Replace with generated types (`npm run db:types`) when convenient.

export type LightLevel = "low" | "medium" | "bright_indirect" | "direct";
export type CareType =
  | "water"
  | "check_moist"
  | "fertilize"
  | "mist"
  | "repot"
  | "prune"
  | "rotate"
  | "note"
  | "photo";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  reminder_time: string; // "08:30:00"
  reminders_enabled: boolean;
}

export interface Household {
  id: string;
  name: string;
  hemisphere: "north" | "south";
}

export interface Location {
  id: string;
  household_id: string;
  name: string;
  sort_order: number;
}

export interface Room {
  id: string;
  household_id: string;
  location_id: string;
  name: string;
  light: LightLevel | null;
  photo_path: string | null;
  sort_order: number;
}

export interface Plant {
  id: string;
  household_id: string;
  room_id: string | null;
  name: string;
  nickname: string | null;
  species: string | null;
  /** Light where this plant sits. null = same as its room. */
  light: LightLevel | null;
  cover_photo_path: string | null;
  notes: string | null;
  acquired_on: string | null;
  water_interval_days: number;
  water_adjust: number;
  last_watered_at: string | null;
  next_water_at: string | null;
  fertilize_interval_days: number | null;
  last_fertilized_at: string | null;
  next_fertilize_at: string | null;
  archived_at: string | null;
  created_at: string;
}

/** Row from the plant_status view */
export interface PlantWithPlace extends Plant {
  room_name: string | null;
  location_name: string | null;
  room_light: LightLevel | null;
  /** plant.light ?? room light */
  effective_light: LightLevel | null;
}

/** Row from plant_photos: every photo a plant has had, including old covers. */
export interface PlantPhotoRow {
  id: string;
  household_id: string;
  plant_id: string;
  path: string;
  caption: string | null;
  taken_at: string;
}

export interface CareEvent {
  id: string;
  household_id: string;
  plant_id: string;
  type: CareType;
  performed_at: string;
  performed_by: string | null;
  note: string | null;
  photo_path: string | null;
}
