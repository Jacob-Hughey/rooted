import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Leaf, type LucideIcon } from "lucide-react";
import { OFFLINE_MARK, photoUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** Signed URL for a stored photo, cached across the app. */
export function usePhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["photo", path],
    enabled: !!path,
    // An offline stand-in URL is replaced as soon as there's a connection again.
    staleTime: (q) => (q.state.data?.endsWith(OFFLINE_MARK) ? 0 : 50 * 60 * 1000),
    queryFn: () => photoUrl(path!),
  }).data;
}

/** Shows the plant's photo, or a quiet leaf placeholder. */
export function PlantPhoto({
  path,
  alt,
  className,
  icon: Icon = Leaf,
  fit = "cover",
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  icon?: LucideIcon;
  /** "contain" shows the whole photo (full-screen viewer); "cover" fills the box. */
  fit?: "cover" | "contain";
}) {
  const url = usePhotoUrl(path);
  // A photo that isn't saved on the device can't load offline: show the placeholder instead of a broken image.
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <div className={cn("relative overflow-hidden", fit === "cover" && "bg-secondary", className)}>
      {url && failed !== url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          draggable={false}
          onError={() => setFailed(url)}
          className={cn("absolute inset-0 size-full", fit === "cover" ? "object-cover" : "object-contain")}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Icon className="size-[38%] max-h-24 text-done/60" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
