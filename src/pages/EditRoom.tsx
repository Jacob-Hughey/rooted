import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ChevronLeft, Trash2 } from "lucide-react";
import { field } from "@/components/PlantForm";
import { Button } from "@/components/ui/button";
import { ensureLocation, useArchivedPlants, useDeleteRoom, useHousehold, usePlaces, usePlants, useSaveRoom } from "@/data/queries";
import { LIGHT_LABEL } from "@/lib/watering";
import type { LightLevel, Location, Room } from "@/lib/types";
import { cn } from "@/lib/utils";

const LIGHT_OPTIONS: { value: LightLevel; hint: string }[] = [
  { value: "low", hint: "Far from windows, north-facing" },
  { value: "medium", hint: "A few steps from a window" },
  { value: "bright_indirect", hint: "Near a window, no harsh sun" },
  { value: "direct", hint: "Sunny windowsill" },
];

/** Add a room (/rooms/new) or edit one (/rooms/:id/edit). */
export default function EditRoom() {
  const { id } = useParams();
  const { data: places } = usePlaces();
  const room = id ? places?.rooms.find((r) => r.id === id) : undefined;

  if (!places) return <div className="mx-auto mt-16 h-64 max-w-lg animate-pulse rounded-[var(--radius-xl)] bg-muted" />;
  if (id && !room) return <p className="mx-auto mt-16 max-w-lg text-muted-foreground">That room doesn't exist anymore.</p>;
  return <RoomForm key={id ?? "new"} room={room} locations={places.locations} />;
}

function RoomForm({ room, locations }: { room?: Room; locations: Location[] }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { data: household } = useHousehold();
  const { data: plants = [] } = usePlants();
  const { data: archived = [] } = useArchivedPlants();
  const save = useSaveRoom();
  const del = useDeleteRoom();

  const [name, setName] = useState(room?.name ?? "");
  const [light, setLight] = useState<LightLevel | null>(room?.light ?? null);
  const [locationId, setLocationId] = useState(room?.location_id ?? locations[0]?.id ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (loc.key === "default" ? nav("/rooms", { replace: true }) : nav(-1));
  const plantsHere = room ? [...plants, ...archived].filter((p) => p.room_id === room.id).length : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!household) return;
    setError(null);
    try {
      const location_id = locationId || (await ensureLocation(household.id, locations));
      await save.mutateAsync({ id: room?.id, household_id: household.id, input: { name: name.trim(), light, location_id } });
      back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the room");
    }
  }

  async function remove() {
    if (!room) return;
    try {
      await del.mutateAsync(room);
      nav("/rooms", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the room");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-4 pb-10">
      <button type="button" onClick={back} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Back
      </button>
      <h1 className="text-3xl">{room ? `Edit ${room.name}` : "New room"}</h1>

      <form onSubmit={submit} className="space-y-6">
        <input required placeholder="Name (e.g. Sunroom)" value={name} onChange={(e) => setName(e.target.value)} className={field} />

        {locations.length > 1 && (
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}

        <fieldset className="space-y-3">
          <legend className="mb-2 font-display text-lg">How much light?</legend>
          <div className="grid grid-cols-2 gap-2">
            {LIGHT_OPTIONS.map((o) => (
              <button
                type="button"
                key={o.value}
                onClick={() => setLight(light === o.value ? null : o.value)}
                className={cn(
                  "rounded-[var(--radius-md)] border p-3 text-left text-sm transition-colors",
                  light === o.value ? "border-primary bg-secondary" : "bg-card",
                )}
              >
                <span className="block font-medium">{LIGHT_LABEL[o.value]}</span>
                <span className="text-muted-foreground">{o.hint}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The default for plants in this room. A plant in a brighter or darker spot can set its own on its edit screen. Tap again to clear.
          </p>
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="lg" className="w-full" disabled={save.isPending || !name.trim()}>
          {save.isPending ? "Saving…" : room ? "Save changes" : "Add room"}
        </Button>
      </form>

      {room && (
        <div className="space-y-3 border-t pt-6">
          {confirmDelete ? (
            <>
              <p className="text-sm text-muted-foreground">
                {plantsHere === 0
                  ? "This room is empty. Deleting it can't be undone."
                  : `The ${plantsHere === 1 ? "plant" : `${plantsHere} plants`} in here won't be deleted. ${plantsHere === 1 ? "It" : "They"}'ll just have no room until you move ${plantsHere === 1 ? "it" : "them"}.`}
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" disabled={del.isPending} onClick={remove}>
                  Delete room
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button variant="ghost" className="w-full text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete room
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
