import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Archive, Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { PlantCard } from "@/components/PlantCard";
import { Button } from "@/components/ui/button";
import { useArchivedPlants, usePlants } from "@/data/queries";
import { cn } from "@/lib/utils";

export default function Plants() {
  const { data: plants = [] } = usePlants();
  const { data: archived = [] } = useArchivedPlants();
  const [room, setRoom] = useState<string | null>(null);

  const rooms = useMemo(
    () => [...new Set(plants.map((p) => p.room_name).filter(Boolean))] as string[],
    [plants],
  );
  const shown = room ? plants.filter((p) => p.room_name === room) : plants;

  return (
    <>
      <PageHeader
        title="Plants"
        subtitle={`${plants.length} in the collection`}
        action={
          <Link to="/plants/new">
            <Button size="icon" aria-label="Add plant">
              <Plus className="size-5" />
            </Button>
          </Link>
        }
      />

      {rooms.length > 1 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-none">
          {[null, ...rooms].map((r) => (
            <button
              key={r ?? "all"}
              onClick={() => setRoom(r)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
                room === r ? "border-primary bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              {r ?? "All"}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <PlantCard key={p.id} plant={p} />
        ))}
      </div>

      {archived.length > 0 && (
        <Link to="/plants/archived" className="mt-8 flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Archive className="size-4" /> Archived ({archived.length})
        </Link>
      )}
    </>
  );
}
