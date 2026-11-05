import { PageHeader } from "@/components/AppShell";
import { usePlaces, usePlants } from "@/data/queries";
import { LIGHT_LABEL, waterStatus } from "@/lib/watering";

export default function Rooms() {
  const { data: places } = usePlaces();
  const { data: plants = [] } = usePlants();

  return (
    <>
      <PageHeader title="Rooms" subtitle="Where everyone lives" />
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
                    <div key={room.id} className="rounded-[var(--radius-xl)] bg-card p-5 shadow-sm">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-xl">{room.name}</h3>
                        <span className="text-sm text-muted-foreground">{here.length} plants</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {room.light ? LIGHT_LABEL[room.light] : "Light not set"}
                        {thirsty > 0 && <span className="text-clay"> · {thirsty} thirsty</span>}
                      </p>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
