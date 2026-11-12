import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { PHOTO_BUCKET, supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/photos";
import { useAuth } from "@/auth/AuthProvider";
import { displayName } from "@/lib/watering";
import {
  overlayHistory,
  overlayPlant,
  overlayPlants,
  outboxEntries,
  queueDelete,
  queueLog,
  queueNote,
  useOutbox,
  type Prior,
} from "@/data/outbox";
import type { CareEvent, CareType, Household, LightLevel, Location, Plant, PlantPhotoRow, PlantWithPlace, Profile, Room } from "@/lib/types";

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
  photos: (id: string) => ["photos", id] as const,
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

/** Hemisphere for the seasonal watering factor (only needed to preview offline waterings). */
const hemisphereOf = (qc: QueryClient) => qc.getQueryData<Household>(keys.household)?.hemisphere ?? "north";

/** Active plants, including care that's saved on this device but not synced yet. */
export function usePlants() {
  const qc = useQueryClient();
  const outbox = useOutbox();
  const query = useQuery({
    queryKey: keys.plants,
    queryFn: async () =>
      unwrap<PlantWithPlace[]>(
        await supabase.from("plant_status").select("*").is("archived_at", null).order("next_water_at", { nullsFirst: true }),
      ),
  });
  const data = useMemo(
    () =>
      query.data &&
      overlayPlants(query.data, outbox, hemisphereOf(qc), (id) => qc.getQueryData<CareEvent[]>(keys.history(id))),
    [query.data, outbox, qc],
  );
  return { ...query, data };
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
  const qc = useQueryClient();
  const outbox = useOutbox();
  const query = useQuery({
    queryKey: keys.plant(id),
    queryFn: async () => unwrap<PlantWithPlace>(await supabase.from("plant_status").select("*").eq("id", id).single()),
    // Show the plant from the list straight away (and offline) while its own row loads.
    placeholderData: () => qc.getQueryData<PlantWithPlace[]>(keys.plants)?.find((p) => p.id === id),
  });
  const data = useMemo(
    () =>
      query.data && overlayPlant(query.data, outbox, hemisphereOf(qc), qc.getQueryData<CareEvent[]>(keys.history(id))),
    [query.data, outbox, qc, id],
  );
  return { ...query, data };
}

export function useCareHistory(plantId: string) {
  const outbox = useOutbox();
  const query = useQuery({
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
  const data = useMemo(() => overlayHistory(query.data, outbox, plantId), [query.data, outbox, plantId]);
  return { ...query, data };
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

type PlantRef = Pick<Plant, "id" | "household_id"> & Partial<Pick<Plant, "name" | "nickname">>;

/** The plant as the screens show it right now (server data + outbox), for names and offline undo. */
function currentPlant(qc: QueryClient, id: string): PlantWithPlace | undefined {
  return (
    qc.getQueryData<PlantWithPlace>(keys.plant(id)) ?? qc.getQueryData<PlantWithPlace[]>(keys.plants)?.find((p) => p.id === id)
  );
}

function nameOf(qc: QueryClient, plant: Pick<Plant, "id"> & Partial<Pick<Plant, "name" | "nickname">>) {
  const p = plant.name ? plant : currentPlant(qc, plant.id);
  return p?.name ? displayName(p as Pick<Plant, "name" | "nickname">) : "a plant";
}

/**
 * Log care (watering etc). Saved on the device instantly and synced in the background (see outbox.ts),
 * so it works with no signal. The database trigger recalculates the next watering once it arrives,
 * including for backdated care.
 */
export function useLogCare() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    networkMode: "always", // never wait for a connection: the outbox handles that
    mutationFn: async (input: {
      plant: PlantRef;
      type: CareType;
      note?: string;
      /** When it actually happened, for care logged after the fact. Omit for "now". */
      performedAt?: string;
    }): Promise<CareEvent> => {
      const event: CareEvent = {
        id: crypto.randomUUID(),
        household_id: input.plant.household_id,
        plant_id: input.plant.id,
        type: input.type,
        // Set on the device so care logged offline keeps the time she actually did it.
        performed_at: input.performedAt ?? new Date().toISOString(),
        performed_by: session?.user.id ?? null,
        note: input.note ?? null,
        photo_path: null,
      };
      const shown = currentPlant(qc, input.plant.id);
      const before = shown && overlayPlant(shown, outboxEntries(), hemisphereOf(qc));
      const prior: Prior | undefined = before && {
        last_watered_at: before.last_watered_at,
        next_water_at: before.next_water_at,
        water_adjust: before.water_adjust,
        last_fertilized_at: before.last_fertilized_at,
        next_fertilize_at: before.next_fertilize_at,
      };
      queueLog(event, nameOf(qc, input.plant), prior);
      return event;
    },
  });
}

/** Undo = delete the event; the trigger rolls last_watered_at back to the previous one. Works offline too. */
export function useUndoCare() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: async (ev: CareEvent) => queueDelete(ev, nameOf(qc, { id: ev.plant_id })),
  });
}

/** Change the text of a history entry (used for daily notes). Works offline too. */
export function useUpdateCareNote() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: async ({ ev, note }: { ev: CareEvent; note: string }) =>
      queueNote(ev, note, nameOf(qc, { id: ev.plant_id })),
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
      light?: LightLevel | null;
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
  Pick<Plant, "name" | "nickname" | "species" | "light" | "notes" | "room_id" | "water_interval_days" | "cover_photo_path" | "archived_at">
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
    onSuccess: (_d, { plant }) => {
      qc.invalidateQueries({ queryKey: keys.plants });
      qc.invalidateQueries({ queryKey: keys.photos(plant.id) });
    },
  });
}

/** Keep every cover photo in plant_photos so the future photo timeline has the full history. */
async function recordPhoto(household_id: string, plant_id: string, path: string) {
  unwrap(await supabase.from("plant_photos").insert({ household_id, plant_id, path }));
}

/** When each plant last had a photo taken (plant id → ISO date). Used for "no photo in a while" nudges. */
export function useLatestPhotoDates() {
  return useQuery({
    queryKey: ["photos", "latest"],
    queryFn: async () => {
      const rows = unwrap<{ plant_id: string; taken_at: string }[]>(
        await supabase.from("plant_photos").select("plant_id, taken_at").order("taken_at", { ascending: false }),
      );
      const latest = new Map<string, string>();
      for (const r of rows) if (!latest.has(r.plant_id)) latest.set(r.plant_id, r.taken_at);
      return latest;
    },
  });
}

/** Every photo of a plant, newest first. */
export function usePlantPhotos(plantId: string) {
  return useQuery({
    queryKey: keys.photos(plantId),
    queryFn: async () =>
      unwrap<PlantPhotoRow[]>(
        await supabase.from("plant_photos").select("*").eq("plant_id", plantId).order("taken_at", { ascending: false }),
      ),
  });
}

/** Add a photo to the plant's gallery. The newest photo becomes the cover. */
export function useAddPlantPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ plant, file }: { plant: Pick<Plant, "id" | "household_id">; file: File }) => {
      const path = await uploadPhoto(plant.household_id, "plants", file);
      await recordPhoto(plant.household_id, plant.id, path);
      unwrap(await supabase.from("plants").update({ cover_photo_path: path }).eq("id", plant.id));
      return path;
    },
    onSuccess: (_path, { plant }) => {
      qc.invalidateQueries({ queryKey: keys.plants });
      qc.invalidateQueries({ queryKey: keys.photos(plant.id) });
    },
  });
}

/** Make an existing gallery photo the cover (no new gallery entry). */
export function useSetCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ plantId, path }: { plantId: string; path: string }) =>
      unwrap(await supabase.from("plants").update({ cover_photo_path: path }).eq("id", plantId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plants }),
  });
}

/**
 * Remove a photo from the gallery. If it was the cover, the next newest photo takes over.
 * The file is removed from storage unless something else still points at it.
 */
export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ photo, plant }: { photo: PlantPhotoRow; plant: Pick<Plant, "id" | "cover_photo_path"> }) => {
      if (plant.cover_photo_path === photo.path) {
        const next = unwrap<{ path: string }[]>(
          await supabase
            .from("plant_photos")
            .select("path")
            .eq("plant_id", plant.id)
            .neq("id", photo.id)
            .order("taken_at", { ascending: false })
            .limit(1),
        );
        unwrap(await supabase.from("plants").update({ cover_photo_path: next[0]?.path ?? null }).eq("id", plant.id));
      }
      unwrap(await supabase.from("plant_photos").delete().eq("id", photo.id));

      const [others, events] = await Promise.all([
        supabase.from("plant_photos").select("id").eq("path", photo.path).limit(1),
        supabase.from("care_events").select("id").eq("photo_path", photo.path).limit(1),
      ]);
      if (!unwrap<unknown[]>(others).length && !unwrap<unknown[]>(events).length) {
        const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.path]);
        if (error) console.warn("Photo removed from the gallery, but its file wasn't deleted", error);
      }
    },
    onSuccess: (_d, { plant }) => {
      qc.invalidateQueries({ queryKey: keys.plants });
      qc.invalidateQueries({ queryKey: keys.photos(plant.id) });
    },
  });
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

export interface RoomInput {
  name: string;
  light: LightLevel | null;
  location_id: string;
  photo_path: string | null;
}

/** Create a room (when no id is given) or edit one. Rooms are listed by sort_order, so new ones go last. */
export function useSaveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      household_id,
      input,
      previousPhoto,
    }: {
      id?: string;
      household_id: string;
      input: RoomInput;
      /** The room's photo before this save; removed from storage if it was replaced. */
      previousPhoto?: string | null;
    }) => {
      if (id) {
        unwrap(await supabase.from("rooms").update(input).eq("id", id));
        if (previousPhoto && previousPhoto !== input.photo_path) {
          await supabase.storage.from(PHOTO_BUCKET).remove([previousPhoto]); // best effort
        }
        return id;
      }
      const last = unwrap<{ sort_order: number }[]>(
        await supabase.from("rooms").select("sort_order").eq("location_id", input.location_id).order("sort_order", { ascending: false }).limit(1),
      );
      const room = unwrap<{ id: string }>(
        await supabase
          .from("rooms")
          .insert({ ...input, household_id, sort_order: (last[0]?.sort_order ?? -1) + 1 })
          .select("id")
          .single(),
      );
      return room.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.places });
      qc.invalidateQueries({ queryKey: keys.plants }); // plant_status carries room_name
    },
  });
}

/** Make sure the household has at least one location ("Home") to put rooms in. */
export async function ensureLocation(household_id: string, locations: Location[]): Promise<string> {
  if (locations[0]) return locations[0].id;
  const loc = unwrap<{ id: string }>(
    await supabase.from("locations").insert({ household_id, name: "Home" }).select("id").single(),
  );
  return loc.id;
}

/** Delete a room. Its plants aren't deleted: the database sets their room to "none". */
export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (room: Pick<Room, "id" | "photo_path">) => {
      const deleted = unwrap<{ id: string }[]>(await supabase.from("rooms").delete().eq("id", room.id).select("id"));
      if (deleted.length === 0) throw new Error("Couldn't delete that room — it may already be gone.");
      if (room.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([room.photo_path]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.places });
      qc.invalidateQueries({ queryKey: keys.plants });
    },
  });
}
