import { Link } from "react-router";
import { Check, Droplet } from "lucide-react";
import { PlantPhoto } from "./PlantPhoto";
import { waterLabel, waterStatus } from "@/lib/watering";
import { useLogCare } from "@/data/queries";
import type { PlantWithPlace } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles = {
  overdue: "bg-clay text-clay-foreground",
  today: "bg-water text-water-foreground",
  soon: "bg-card/90 text-foreground",
  ok: "bg-card/90 text-foreground",
  unknown: "bg-card/90 text-foreground",
} as const;

export function PlantCard({ plant, showWaterButton = false }: { plant: PlantWithPlace; showWaterButton?: boolean }) {
  const status = waterStatus(plant);
  const logCare = useLogCare();
  const watered = logCare.isSuccess;

  return (
    <div className="group relative">
      <Link to={`/plants/${plant.id}`} className="block">
        <PlantPhoto
          path={plant.cover_photo_path}
          alt={plant.name}
          className="aspect-[4/5] rounded-[var(--radius-xl)] shadow-sm transition-transform group-active:scale-[0.98]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[var(--radius-xl)] bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 pt-10 text-white">
          <p className="font-display text-lg leading-tight">{plant.nickname ?? plant.name}</p>
          {plant.room_name && <p className="text-xs opacity-85">{plant.room_name}</p>}
        </div>
        <span
          className={cn(
            "absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur",
            statusStyles[status],
          )}
        >
          {waterLabel(plant)}
        </span>
      </Link>

      {showWaterButton && (
        <button
          aria-label={`Mark ${plant.name} as watered`}
          disabled={logCare.isPending || watered}
          onClick={() => logCare.mutate({ plant, type: "water" })}
          className={cn(
            "absolute bottom-3 right-3 grid size-11 place-items-center rounded-full shadow-md transition-all active:scale-90",
            watered ? "bg-primary text-primary-foreground" : "bg-water text-water-foreground",
          )}
        >
          {watered ? <Check className="size-5" /> : <Droplet className="size-5" />}
        </button>
      )}
    </div>
  );
}
