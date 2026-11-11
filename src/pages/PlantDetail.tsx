import { Link, useNavigate, useParams } from "react-router";
import { format } from "date-fns";
import { ArchiveRestore, Camera, ChevronLeft, Droplet } from "lucide-react";
import { PlantPhoto } from "@/components/PlantPhoto";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useCareHistory, useLogCare, usePlant, useUndoCare, useUpdatePlant } from "@/data/queries";
import { daysUntilWater, displayName, LIGHT_PHRASE } from "@/lib/watering";
import type { CareEvent, CareType, PlantWithPlace } from "@/lib/types";

const EVENT_LABEL: Record<CareType, string> = {
  water: "Watered",
  check_moist: "Checked, soil still damp",
  fertilize: "Fertilized",
  mist: "Misted",
  repot: "Repotted",
  prune: "Pruned",
  rotate: "Rotated",
  note: "Note",
  photo: "New photo",
};

/** Toast wording per action, matching the button that was tapped. */
const LOGGED: Partial<Record<CareType, string>> = {
  water: "watered",
  check_moist: "checked, still damp",
  fertilize: "fertilized",
};

/** "Wants water every 7 days. Last watered November 2, so it's 2 days late." */
function Rhythm({ plant }: { plant: PlantWithPlace }) {
  const every = plant.water_interval_days === 1 ? "every day" : `every ${plant.water_interval_days} days`;
  const d = daysUntilWater(plant);
  const last = plant.last_watered_at ? `Last watered ${format(new Date(plant.last_watered_at), "MMMM d")}` : null;

  let tail: React.ReactNode = null;
  if (plant.archived_at) tail = last ? `${last}.` : null; // archived plants are off the schedule: never "late"
  else if (!last) tail = "It hasn’t been watered in Rooted yet.";
  else if (d === null) tail = `${last}.`;
  else if (d < 0) tail = <>{last}, so it’s <strong className="font-bold text-late">{-d === 1 ? "1 day" : `${-d} days`} late</strong>.</>;
  else if (d === 0) tail = <>{last}, so it’s <strong className="font-bold">due today</strong>.</>;
  else tail = <>{last}. Next watering {d === 1 ? "tomorrow" : `in ${d} days`}.</>;

  return (
    <p className="max-w-[34ch] text-lg leading-relaxed">
      Wants water <strong className="font-bold">{every}</strong>. {tail}
    </p>
  );
}

export default function PlantDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: plant } = usePlant(id);
  const { data: history = [] } = useCareHistory(id);
  const log = useLogCare();
  const undo = useUndoCare();
  const update = useUpdatePlant();
  const toast = useToast();

  if (!plant) return <div className="-mx-5 aspect-[4/5] max-h-[45dvh] animate-pulse bg-muted md:mx-0 md:rounded-[var(--radius-xl)]" />;

  const name = displayName(plant);
  const place = [plant.room_name, plant.effective_light && LIGHT_PHRASE[plant.effective_light]].filter(Boolean).join(", ");

  function logCare(type: CareType) {
    log.mutate(
      { plant: plant!, type },
      {
        onSuccess: (ev: CareEvent) =>
          toast(`${name} ${LOGGED[type] ?? "updated"}`, { label: "Undo", onClick: () => undo.mutate(ev) }),
        onError: () => toast("Couldn't save. Check your connection and try again."),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl md:pt-6">
      {/* Photo bleeds to the screen edges on phones */}
      <div className="relative -mx-5 -mt-[max(env(safe-area-inset-top),0.75rem)] md:mx-0 md:mt-0">
        <PlantPhoto path={plant.cover_photo_path} alt={name} className="aspect-[4/5] max-h-[45dvh] w-full md:aspect-[16/10] md:rounded-[var(--radius-xl)]" />
        <button
          onClick={() => nav(-1)}
          aria-label="Back"
          className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)] grid size-11 place-items-center rounded-full bg-card text-foreground"
        >
          <ChevronLeft className="size-6" />
        </button>
        <Link
          to={`/plants/${plant.id}/edit`}
          className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] flex h-11 items-center rounded-full bg-card px-4 font-bold text-foreground"
        >
          Edit
        </Link>
        {!plant.cover_photo_path && (
          <Link
            to={`/plants/${plant.id}/edit`}
            className="absolute inset-x-0 bottom-6 mx-auto flex h-11 w-fit items-center gap-2 rounded-[var(--radius)] bg-card px-4 font-medium"
          >
            <Camera className="size-5" /> Add a photo
          </Link>
        )}
      </div>

      <div className="mt-5 space-y-1">
        <h1 className="text-[2.75rem]">{name}</h1>
        {plant.species && <p className="text-lg italic text-muted-foreground">{plant.species}</p>}
        {place && <p className="text-muted-foreground">{place}</p>}
      </div>

      {plant.archived_at && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-secondary p-4">
          <p>Archived {format(new Date(plant.archived_at), "MMMM d, yyyy")}</p>
          <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ plant, patch: { archived_at: null } })}>
            <ArchiveRestore /> Restore
          </Button>
        </div>
      )}

      <div className="mt-5">
        <Rhythm plant={plant} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Button variant="water" size="lg" className="col-span-2" disabled={log.isPending} onClick={() => logCare("water")}>
          <Droplet /> Mark as watered
        </Button>
        <Button variant="outline" disabled={log.isPending} onClick={() => logCare("check_moist")}>
          Soil still damp
        </Button>
        <Button variant="outline" disabled={log.isPending} onClick={() => logCare("fertilize")}>
          Fertilized
        </Button>
      </div>

      {plant.notes && <p className="mt-6 max-w-prose whitespace-pre-line">{plant.notes}</p>}

      <section className="mt-9">
        <h2 className="mb-2 text-2xl">History</h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Nothing logged yet. Waterings and checks will show up here.</p>
        ) : (
          <ol>
            {history.map((ev) => (
              <li key={ev.id} className="grid grid-cols-[4.5rem_1fr] gap-x-2 border-b py-2.5 last:border-b-0">
                <time
                  dateTime={ev.performed_at}
                  title={format(new Date(ev.performed_at), "PPpp")}
                  className="text-muted-foreground"
                >
                  {format(new Date(ev.performed_at), "MMM d")}
                </time>
                <div>
                  <p>{EVENT_LABEL[ev.type]}</p>
                  {ev.note && <p className="text-sm text-muted-foreground">{ev.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
