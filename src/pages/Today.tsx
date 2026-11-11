import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { format } from "date-fns";
import { Check, Droplet, Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { PlantPhoto } from "@/components/PlantPhoto";
import { FeaturedPlant, Nudges, pickFeatured, WeekAhead } from "@/components/TodayExtras";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useLogCare, usePlaces, usePlants, useUndoCare } from "@/data/queries";
import { displayName, waterLabel, waterStatus, wateredToday } from "@/lib/watering";
import { clearBadge } from "@/lib/push";
import type { CareEvent, Location, PlantWithPlace, Room } from "@/lib/types";
import { cn } from "@/lib/utils";

type RoomGroup = { key: string; name: string; plants: PlantWithPlace[] };

/**
 * Today is a watering round: everything due (or already watered today), grouped by room
 * in the order the rooms are listed, so she can walk the house once.
 */
function buildRound(plants: PlantWithPlace[], places?: { locations: Location[]; rooms: Room[] }) {
  const locOrder = new Map(places?.locations.map((l) => [l.id, l.sort_order]) ?? []);
  const roomOrder = new Map(
    places?.rooms.map((r) => [r.id, (locOrder.get(r.location_id) ?? 0) * 1000 + r.sort_order]) ?? [],
  );

  const groups = new Map<string, RoomGroup>();

  for (const p of plants) {
    const s = waterStatus(p);
    const due = s === "overdue" || s === "today" || s === "unknown";
    if (!due && !wateredToday(p)) continue;
    const key = p.room_id ?? "none";
    if (!groups.has(key)) groups.set(key, { key, name: p.room_name ?? "No room yet", plants: [] });
    groups.get(key)!.plants.push(p);
  }

  const round = [...groups.values()]
    .sort((a, b) => (roomOrder.get(a.key) ?? Infinity) - (roomOrder.get(b.key) ?? Infinity))
    .map((g) => ({ ...g, plants: g.plants.sort((a, b) => displayName(a).localeCompare(displayName(b))) }));

  return round;
}

export default function Today() {
  const { data: plants = [], isLoading } = usePlants();
  const { data: places } = usePlaces();
  const log = useLogCare();
  const undo = useUndoCare();
  const toast = useToast();

  // Waterings logged from this screen, so a tap can be undone and shows as done before the refetch lands
  const [logged, setLogged] = useState<Record<string, CareEvent>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(clearBadge, []);

  const round = useMemo(() => buildRound(plants, places), [plants, places]);
  const all = round.flatMap((g) => g.plants);
  const isDone = (p: PlantWithPlace) => !!logged[p.id] || wateredToday(p);
  const doneCount = all.filter(isDone).length;

  const setBusy = (id: string, busy: boolean) =>
    setPending((s) => {
      const next = new Set(s);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  function undoWater(ev: CareEvent) {
    setBusy(ev.plant_id, true);
    undo.mutate(ev, {
      onSuccess: () =>
        setLogged((l) => {
          const { [ev.plant_id]: _gone, ...rest } = l;
          return rest;
        }),
      onSettled: () => setBusy(ev.plant_id, false),
    });
  }

  function water(p: PlantWithPlace) {
    setBusy(p.id, true);
    log.mutate(
      { plant: p, type: "water" },
      {
        onSuccess: (ev) => {
          setLogged((l) => ({ ...l, [p.id]: ev }));
          toast(`${displayName(p)} watered`, { label: "Undo", onClick: () => undoWater(ev) });
        },
        onError: () => toast(`Couldn't save. Check your connection and try again.`),
        onSettled: () => setBusy(p.id, false),
      },
    );
  }

  const date = format(new Date(), "EEEE, MMMM d");

  if (isLoading) return <><PageHeader subtitle={date} title="Today" /><SkeletonRows /></>;

  if (plants.length === 0) {
    return (
      <>
        <PageHeader subtitle={date} title="Today" />
        <div className="space-y-4 rounded-[var(--radius-xl)] bg-card p-6">
          <h2 className="text-2xl">No plants yet</h2>
          <p className="max-w-prose text-muted-foreground">
            Add your plants and Rooted will keep track of when each one needs water.
          </p>
          <Link to="/plants/new" className="inline-block">
            <Button><Plus /> Add a plant</Button>
          </Link>
        </div>
      </>
    );
  }

  if (all.length === 0) {
    const featured = pickFeatured(plants);
    return (
      <>
        <PageHeader subtitle={date} title="Today" />
        <p className="-mt-2 text-xl">Nothing needs water today.</p>
        <div className="mt-7 space-y-10">
          {featured && <FeaturedPlant plant={featured} />}
          <WeekAhead plants={plants} includeToday={false} />
          <Nudges plants={plants} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        subtitle={date}
        title="Today’s round"
      />
      <div className="-mt-3 mb-6 flex items-center gap-3">
        {all.length <= 12 && (
          <div className="flex gap-0.5" aria-hidden="true">
            {all.map((p) => (
              <Droplet
                key={p.id}
                className={cn("size-[18px] text-water transition-colors duration-300")}
                strokeWidth={2}
                fill={isDone(p) ? "currentColor" : "none"}
              />
            ))}
          </div>
        )}
        <p className="text-muted-foreground">
          {doneCount === all.length ? "All watered." : `${doneCount} of ${all.length} watered`}
        </p>
      </div>

      <div className="space-y-7">
        {round.map((room) => (
          <section key={room.key}>
            <h2 className="mb-1 text-2xl">{room.name}</h2>
            <ul>
              {room.plants.map((p) => {
                const done = isDone(p);
                const ev = logged[p.id];
                const late = waterStatus(p) === "overdue" && !done;
                const busy = pending.has(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-4 border-b py-2.5 last:border-b-0">
                    <Link
                      to={`/plants/${p.id}`}
                      className={cn("flex min-w-0 flex-1 items-center gap-4 transition-opacity duration-300", done && "opacity-55")}
                    >
                      <PlantPhoto path={p.cover_photo_path} alt="" className="size-14 shrink-0 rounded-[10px]" />
                      <div className="min-w-0">
                        <p className="truncate text-lg font-medium leading-tight">{displayName(p)}</p>
                        <p className={cn("text-sm", done ? "text-done" : late ? "font-bold text-late" : "text-muted-foreground")}>
                          {done
                            ? `Watered at ${format(new Date(ev?.performed_at ?? p.last_watered_at!), "h:mm a")}`
                            : waterLabel(p)}
                        </p>
                      </div>
                    </Link>
                    <button
                      onClick={() => (done ? ev && undoWater(ev) : water(p))}
                      disabled={busy || (done && !ev)}
                      aria-label={done ? (ev ? `Undo watering ${displayName(p)}` : `${displayName(p)} was watered today`) : `Mark ${displayName(p)} as watered`}
                      className={cn(
                        "grid size-12 shrink-0 place-items-center rounded-full border-2 border-water transition-colors duration-300 disabled:cursor-default",
                        done ? "bg-water text-water-foreground" : "text-water",
                        busy && "opacity-60",
                      )}
                    >
                      {done ? <Check className="size-[22px]" strokeWidth={2.6} /> : <Droplet className="size-[22px]" strokeWidth={2} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 space-y-10">
        <WeekAhead plants={plants} />
        <Nudges plants={plants} />
      </div>
    </>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="size-14 animate-pulse rounded-[10px] bg-muted" />
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
