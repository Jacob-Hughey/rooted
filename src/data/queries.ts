import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import type { CareEvent, CareType, Household, Location, PlantWithPlace, Profile, Room } from "@/lib/types";

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export const keys = {
  household: ["household"] as const,
  profile: ["profile"] as const,
  plants: ["plants"] as const,
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
      cover_photo_path?: string | null;
      last_watered_at?: string | null;
    }) => unwrap<{ id: string }>(await supabase.from("plants").insert(input).select("id").single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plants }),
  });
}

export function useInvite() {
  return useMutation({
    mutationFn: async (input: { household_id: string; email: string }) =>
      unwrap(await supabase.from("household_invites").insert({ ...input, email: input.email.trim().toLowerCase() })),
  });
}
