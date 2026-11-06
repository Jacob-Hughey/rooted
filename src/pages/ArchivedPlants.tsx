import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { format } from "date-fns";
import { ArchiveRestore, ChevronLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { PlantPhoto } from "@/components/PlantPhoto";
import { Button } from "@/components/ui/button";
import { useArchivedPlants, useDeletePlant, useUpdatePlant } from "@/data/queries";

export default function ArchivedPlants() {
  const nav = useNavigate();
  const { data: plants = [], isLoading } = useArchivedPlants();
  const restore = useUpdatePlant();
  const del = useDeletePlant();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <button type="button" onClick={() => nav(-1)} className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Back
      </button>
      <PageHeader title="Archived" subtitle="Hidden from lists and reminders, history kept" />

      {!isLoading && plants.length === 0 && <p className="text-muted-foreground">Nothing archived.</p>}
      {del.error && <p className="mb-3 text-sm text-destructive">{del.error.message}</p>}

      <ul className="space-y-3">
        {plants.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card p-3 shadow-sm">
            <Link to={`/plants/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <PlantPhoto path={p.cover_photo_path} alt={p.name} className="size-14 shrink-0 rounded-[var(--radius-md)]" />
              <div className="min-w-0">
                <p className="truncate font-medium">{p.nickname ?? p.name}</p>
                <p className="text-sm text-muted-foreground">Archived {format(new Date(p.archived_at!), "MMM d, yyyy")}</p>
              </div>
            </Link>
            {confirming === p.id ? (
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => del.mutate(p, { onSettled: () => setConfirming(null) })}>
                  Delete forever
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex shrink-0">
                <Button size="icon" variant="ghost" aria-label={`Restore ${p.name}`} disabled={restore.isPending} onClick={() => restore.mutate({ plant: p, patch: { archived_at: null } })}>
                  <ArchiveRestore />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Delete ${p.name} permanently`} className="text-destructive" onClick={() => setConfirming(p.id)}>
                  <Trash2 />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
