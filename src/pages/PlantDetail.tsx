import { useNavigate, useParams } from "react-router";
import { format, formatDistanceToNow } from "date-fns";
import { ChevronLeft, Droplet, Hand, Sprout, Undo2 } from "lucide-react";
import { PlantPhoto } from "@/components/PlantPhoto";
import { Button } from "@/components/ui/button";
import { useCareHistory, useLogCare, usePlant, useUndoCare } from "@/data/queries";
import { waterLabel } from "@/lib/watering";
import type { CareType } from "@/lib/types";

const EVENT_LABEL: Record<CareType, string> = {
  water: "Watered",
  check_moist: "Checked — soil still damp",
  fertilize: "Fed",
  mist: "Misted",
  repot: "Repotted",
  prune: "Pruned",
  rotate: "Rotated",
  note: "Note",
  photo: "New photo",
};

export default function PlantDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: plant } = usePlant(id);
  const { data: history = [] } = useCareHistory(id);
  const log = useLogCare();
  const undo = useUndoCare();

  if (!plant) return <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-xl)] bg-muted" />;

  return (
    <div className="mx-auto max-w-2xl md:pt-6">
      {/* Photo hero bleeds to the screen edges on phones */}
      <div className="relative -mx-4 md:mx-0">
        <PlantPhoto path={plant.cover_photo_path} alt={plant.name} className="aspect-[4/5] md:aspect-[16/10] md:rounded-[var(--radius-xl)]" />
        <button
          onClick={() => nav(-1)}
          aria-label="Back"
          className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)] grid size-10 place-items-center rounded-full bg-card/80 backdrop-blur"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16 text-white md:rounded-b-[var(--radius-xl)]">
          <h1 className="text-4xl">{plant.nickname ?? plant.name}</h1>
          <p className="opacity-85">
            {[plant.species, plant.room_name].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-lg)] bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Next water</p>
          <p className="font-display text-xl">{waterLabel(plant)}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Rhythm</p>
          <p className="font-display text-xl">Every {plant.water_interval_days}d</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="water" className="flex-1" disabled={log.isPending} onClick={() => log.mutate({ plant, type: "water" })}>
          <Droplet /> Watered
        </Button>
        <Button variant="outline" className="flex-1" disabled={log.isPending} onClick={() => log.mutate({ plant, type: "check_moist" })}>
          <Hand /> Still damp
        </Button>
        <Button variant="outline" size="icon" aria-label="Fed" disabled={log.isPending} onClick={() => log.mutate({ plant, type: "fertilize" })}>
          <Sprout />
        </Button>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xl">Care history</h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-secondary pl-5">
            {history.map((ev, i) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-primary ring-4 ring-background" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{EVENT_LABEL[ev.type]}</p>
                    <p className="text-sm text-muted-foreground" title={format(new Date(ev.performed_at), "PPpp")}>
                      {formatDistanceToNow(new Date(ev.performed_at), { addSuffix: true })}
                    </p>
                    {ev.note && <p className="mt-1 text-sm">{ev.note}</p>}
                  </div>
                  {i === 0 && (
                    <button
                      onClick={() => undo.mutate(ev)}
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                      aria-label="Undo last entry"
                    >
                      <Undo2 className="size-3.5" /> Undo
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
