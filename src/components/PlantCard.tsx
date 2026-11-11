import { Link } from "react-router";
import { PlantPhoto } from "./PlantPhoto";
import { displayName, waterLabel, waterStatus } from "@/lib/watering";
import type { PlantWithPlace } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Photo with the name and watering status underneath (not printed over the photo). */
export function PlantCard({ plant }: { plant: PlantWithPlace }) {
  const status = waterStatus(plant);
  return (
    <Link to={`/plants/${plant.id}`} className="block rounded-[var(--radius-lg)]">
      <PlantPhoto path={plant.cover_photo_path} alt="" className="aspect-[4/5] rounded-[var(--radius-lg)]" />
      <p className="mt-2 truncate text-lg font-medium leading-tight">{displayName(plant)}</p>
      <p
        className={cn(
          "truncate text-sm",
          status === "overdue" ? "font-bold text-late" : status === "today" ? "font-bold text-water" : "text-muted-foreground",
        )}
      >
        {waterLabel(plant)}
      </p>
    </Link>
  );
}
