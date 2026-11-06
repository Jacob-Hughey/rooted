import { Link } from "react-router";
import { ChevronRight, DoorOpen, Plus } from "lucide-react";
import { PlantPhoto } from "@/components/PlantPhoto";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { usePlaces, usePlants } from "@/data/queries";
import { LIGHT_LABEL, waterStatus } from "@/lib/watering";

export default function Rooms() {
  const { data: places } = usePlaces();
  const { data: plants = [] } = usePlants();
  const homeless = plants.filter((p) => !p.room_id).length;

  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle="Where everyone lives"
        action={
          <Link to="/rooms/new">
            <Button size="icon" aria-label="Add room">
              <Plus className="size-5" />
            </Button>
          </Link>
        }
      />

      {places && places.rooms.length === 0 && (
        <p className="text-muted-foreground">No rooms yet. Tap + to add one.</p>
      )}

      <div className="space-y-8">
        {places?.locations.map((loc) => (
          <section key={loc.id}>
            {places.locations.length > 1 && <h2 className="mb-3 text-xl">{loc.name}</h2>}
            <div className="grid gap-3 sm:grid-cols-2">
              {places.rooms
                .filter((r) => r.location_id === loc.id)
                .map((room) => {
                  const here = plants.filter((p) => p.room_id === room.id);
                  const thirsty = here.filter((p) => ["overdue", "today"].includes(waterStatus(p))).length;
                  return (
                    <Link
                      key={room.id}
                      to={`/rooms/${room.id}/edit`}
                      className="flex items-center gap-3 rounded-[var(--radius-xl)] bg-card p-4 shadow-sm transition-transform active:scale-[0.98]"
                    >
                      {room.photo_path && (
                        <PlantPhoto path={room.photo_path} alt="" icon={DoorOpen} className="size-14 shrink-0 rounded-[var(--radius-md)]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="truncate text-xl">{room.name}</h3>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {here.length} {here.length === 1 ? "plant" : "plants"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {room.light ? LIGHT_LABEL[room.light] : "Light not set"}
                          {thirsty > 0 && <span className="text-clay"> · {thirsty} thirsty</span>}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {homeless > 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          {homeless} {homeless === 1 ? "plant has" : "plants have"} no room. Set it from the plant's edit screen.
        </p>
      )}
    </>
  );
}
