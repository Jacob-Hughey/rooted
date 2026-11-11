import { useQuery } from "@tanstack/react-query";
import { Leaf, type LucideIcon } from "lucide-react";
import { photoUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** Photo-first everywhere: shows the plant's photo, or a soft botanical placeholder. */
export function PlantPhoto({
  path,
  alt,
  className,
  icon: Icon = Leaf,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  icon?: LucideIcon;
}) {
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
        <div className="absolute inset-0 grid place-items-center">
          <Icon className="size-[38%] max-h-24 text-done/60" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
