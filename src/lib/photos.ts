import { supabase, PHOTO_BUCKET } from "./supabase";

/**
 * Shrink a camera photo before upload (iPhone photos are 3–6 MB).
 * On iOS, <input type="file" accept="image/*"> already converts HEIC to JPEG.
 */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
  );
}

/** Upload under {household_id}/{folder}/{uuid}.jpg — the storage RLS policies key off the first folder. */
export async function uploadPhoto(householdId: string, folder: string, file: File): Promise<string> {
  const blob = await resizeImage(file);
  const path = `${householdId}/${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return path;
}

/** Private bucket → short-lived signed URLs. Cached per path for the session. */
const urlCache = new Map<string, { url: string; expires: number }>();

// (Photos are already resized on upload. Supabase image transforms are a Pro-plan feature;
//  if you have it, pass { transform: { width: 600 } } to createSignedUrl for thumbnails.)
export async function photoUrl(path: string): Promise<string> {
  const key = path;
  const hit = urlCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) throw error ?? new Error("No signed URL");
  urlCache.set(key, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}
