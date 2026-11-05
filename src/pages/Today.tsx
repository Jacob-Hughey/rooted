import { useEffect, useMemo } from "react";
import { Link } from "react-router";
import { format } from "date-fns";
import { Plus, Sun } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { PlantCard } from "@/components/PlantCard";
import { Button } from "@/components/ui/button";
import { useProfile, usePlants } from "@/data/queries";
import { waterStatus } from "@/lib/watering";
import { clearBadge } from "@/lib/push";
import type { PlantWithPlace } from "@/lib/types";

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Today() {
  const { data: plants = [], isLoading } = usePlants();
  const { data: profile } = useProfile();

  useEffect(clearBadge, []);

  const groups = useMemo(() => {
    const g: Record<"needs" | "soon", PlantWithPlace[]> = { needs: [], soon: [] };
    for (const p of plants) {
      const s = waterStatus(p);
      if (s === "overdue" || s === "today" || s === "unknown") g.needs.push(p);
      else if (s === "soon") g.soon.push(p);
    }
    return g;
  }, [plants]);

  const firstName = profile?.display_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        subtitle={format(new Date(), "EEEE, MMMM d")}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
      />

      {isLoading ? (
        <SkeletonGrid />
      ) : plants.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] bg-card p-8 text-center shadow-sm">
          <h2 className="text-2xl">Your greenhouse is empty</h2>
          <p className="mt-2 text-muted-foreground">Add your first plant — snap a photo and we'll handle the reminders.</p>
          <Link to="/plants/new">
            <Button className="mt-6">
              <Plus /> Add a plant
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-xl">
              {groups.needs.length ? `Thirsty today · ${groups.needs.length}` : "Nothing to water today"}
            </h2>
            {groups.needs.length ? (
              <Grid plants={groups.needs} showWaterButton />
            ) : (
              <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-secondary p-4 text-secondary-foreground">
                <Sun className="size-5" /> Everyone's happy. Enjoy the green.
              </div>
            )}
          </section>

          {groups.soon.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl text-muted-foreground">Coming up</h2>
              <Grid plants={groups.soon} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

function Grid({ plants, showWaterButton }: { plants: PlantWithPlace[]; showWaterButton?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {plants.map((p) => (
        <PlantCard key={p.id} plant={p} showWaterButton={showWaterButton} />
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-[var(--radius-xl)] bg-muted" />
      ))}
    </div>
  );
}
