import { useQuery } from "@tanstack/react-query";
import { Sprout } from "lucide-react";
import { photoUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** Photo-first everywhere: shows the plant's photo, or a soft botanical placeholder. */
export function PlantPhoto({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ["photo", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: () => photoUrl(path!),
  });

  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      {url ? (
        <img src={url} alt={alt} loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-secondary to-accent/60">
          <Sprout className="size-10 text-secondary-foreground/50" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
