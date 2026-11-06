import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PHOTO_BUCKET, supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import type { CareEvent, CareType, Household, Location, Plant, PlantWithPlace, Profile, Room } from "@/lib/types";

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export const keys = {
  household: ["household"] as const,
  profile: ["profile"] as const,
  plants: ["plants"] as const,
  archived: ["plants", "archived"] as const, // under "plants" so plant edits refresh it too
  plant: (id: string) => ["plants", id] as const,
  history: (id: string) => ["history", id] as const,
  places: ["places"] as const,
};

/** The household the signed-in person belongs to (one per person for now). */
export function useHousehold() {
  const { session } = useAuth();
  return useQuery({
    queryKey: keys.household,
    enabled: !!session,
    staleTime: Infinity,
    queryFn: async () =>
      unwrap<Household>(await supabase.from("households").select("id, name, hemisphere").limit(1).single()),
  });
}

export function useProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: keys.profile,
    enabled: !!session,
    queryFn: async () =>
      unwrap<Profile>(await supabase.from("profiles").select("*").eq("id", session!.user.id).single()),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) =>
      unwrap(await supabase.from("profiles").update(patch).eq("id", session!.user.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profile }),
  });
}

export function usePlants() {
  return useQuery({
    queryKey: keys.plants,
    queryFn: async () =>
      unwrap<PlantWithPlace[]>(
        await supabase.from("plant_status").select("*").is("archived_at", null).order("next_water_at", { nullsFirst: true }),
      ),
  });
}

export function useArchivedPlants() {
  return useQuery({
    queryKey: keys.archived,
    queryFn: async () =>
      unwrap<PlantWithPlace[]>(
        await supabase.from("plant_status").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false }),
      ),
  });
}

export function usePlant(id: string) {
  return useQuery({
    queryKey: keys.plant(id),
    queryFn: async () => unwrap<PlantWithPlace>(await supabase.from("plant_status").select("*").eq("id", id).single()),
  });
}

export function useCareHistory(plantId: string) {
  return useQuery({
    queryKey: keys.history(plantId),
    queryFn: async () =>
      unwrap<CareEvent[]>(
        await supabase
          .from("care_events")
          .select("*")
          .eq("plant_id", plantId)
          .order("performed_at", { ascending: false })
          .limit(100),
      ),
  });
}

export function usePlaces() {
  return useQuery({
    queryKey: keys.places,
    queryFn: async () => {
      const [locations, rooms] = await Promise.all([
        supabase.from("locations").select("*").order("sort_order"),
        supabase.from("rooms").select("*").order("sort_order"),
      ]);
      return { locations: unwrap<Location[]>(locations), rooms: unwrap<Room[]>(rooms) };
    },
  });
}

/** Log care (watering etc). The database trigger recalculates the plant's next watering. */
export function useLogCare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { plant: { id: string; household_id: string }; type: CareType; note?: string }) =>
      unwrap<CareEvent>(
        await supabase
          .from("care_events")
          .insert({ plant_id: input.plant.id, household_id: input.plant.household_id, type: input.type, note: input.note })
          .select()
          .single(),
      ),
    onSuccess: (ev) => {
      qc.invalidateQueries({ queryKey: keys.plants });
      qc.invalidateQueries({ queryKey: keys.history(ev.plant_id) });
    },
  });
}

/** Undo = delete the event; the trigger rolls last_watered_at back to the previous one. */
export function useUndoCare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ev: CareEvent) => unwrap(await supabase.from("care_events").delete().eq("id", ev.id)),
    onSuccess: (_d, ev) => {
      qc.invalidateQueries({ queryKey: keys.plants });
      qc.invalidateQueries({ queryKey: keys.history(ev.plant_id) });
    },
  });
}

export function useCreatePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      household_id: string;
      name: string;
      species?: string;
      nickname?: string;
      room_id?: string | null;
      water_interval_days: number;
      notes?: string;
      cover_photo_path?: string | null;
      last_watered_at?: string | null;
    }) => {
      const plant = unwrap<{ id: string }>(await supabase.from("plants").insert(input).select("id").single());
      if (input.cover_photo_path) await recordPhoto(input.household_id, plant.id, input.cover_photo_path);
      return plant;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plants }),
  });
}

export type PlantPatch = Partial<
  Pick<Plant, "name" | "nickname" | "species" | "notes" | "room_id" | "water_interval_days" | "cover_photo_path" | "archived_at">
>;

/** Edit a plant. Changing water_interval_days makes the database trigger recalculate next_water_at. */
export function useUpdatePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ plant, patch }: { plant: Pick<Plant, "id" | "household_id" | "cover_photo_path">; patch: PlantPatch }) => {
      unwrap(await supabase.from("plants").update(patch).eq("id", plant.id));
      if (patch.cover_photo_path && patch.cover_photo_path !== plant.cover_photo_path) {
        await recordPhoto(plant.household_id, plant.id, patch.cover_photo_path);
      }
    },
    // keys.plants is a prefix of keys.plant(id), so this refreshes the list and the detail page.
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plants }),
  });
}

/** Keep every cover photo in plant_photos so the future photo timeline has the full history. */
async function recordPhoto(household_id: string, plant_id: string, path: string) {
  unwrap(await supabase.from("plant_photos").insert({ household_id, plant_id, path }));
}

export function useInvite() {
  return useMutation({
    mutationFn: async (input: { household_id: string; email: string }) =>
      unwrap(await supabase.from("household_invites").insert({ ...input, email: input.email.trim().toLowerCase() })),
  });
}

/**
 * Permanently delete a plant. The database cascades its care_events and plant_photos rows;
 * the photo files in storage are removed here, since the database can't do that.
 */
export function useDeletePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plant: Pick<Plant, "id" | "cover_photo_path">) => {
      // Collect photo paths first: the rows that list them disappear with the plant.
      const [photos, events] = await Promise.all([
        supabase.from("plant_photos").select("path").eq("plant_id", plant.id),
        supabase.from("care_events").select("photo_path").eq("plant_id", plant.id).not("photo_path", "is", null),
      ]);
      const paths = new Set<string>([
        ...unwrap<{ path: string }[]>(photos).map((r) => r.path),
        ...unwrap<{ photo_path: string }[]>(events).map((r) => r.photo_path),
      ]);
      if (plant.cover_photo_path) paths.add(plant.cover_photo_path);

      const deleted = unwrap<{ id: string }[]>(await supabase.from("plants").delete().eq("id", plant.id).select("id"));
      if (deleted.length === 0) throw new Error("Couldn't delete that plant — it may already be gone.");

      if (paths.size > 0) {
        const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([...paths]);
        if (error) console.warn("Plant deleted, but some photo files weren't removed", error);
      }
    },
    onSuccess: (_d, plant) => {
      // Drop it from the cached lists directly rather than refetching everything under "plants",
      // which would re-request the deleted plant while its screen is still closing.
      const drop = (list?: PlantWithPlace[]) => list?.filter((p) => p.id !== plant.id);
      qc.setQueryData(keys.plants, drop);
      qc.setQueryData(keys.archived, drop);
    },
  });
}
