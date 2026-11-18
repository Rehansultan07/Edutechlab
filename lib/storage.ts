import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "institution-assets";

export function isDirectUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("/")
  );
}

/**
 * Resolves a single Supabase storage path (e.g. "<orgId>/settings/logo.webp")
 * into a displayable URL (signed URL for private buckets, with public URL fallback).
 */
export async function resolveStorageUrl(
  supabase: SupabaseClient,
  pathOrUrl: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (!pathOrUrl) return "";
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return "";
  if (isDirectUrl(trimmed)) return trimmed;

  const cleanPath = trimmed.replace(/^\/+/, "");

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn("Signed URL resolution failed, falling back to public URL:", err);
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
  return pub?.publicUrl || "";
}

/**
 * Batch-resolves many Supabase storage paths into a map: originalPath -> displayableUrl.
 * Uses a single createSignedUrls request for speed on pages with many student photos.
 */
export async function resolveStorageUrlMap(
  supabase: SupabaseClient,
  paths: Array<string | null | undefined>,
  bucket: string = DEFAULT_BUCKET,
  expiresInSeconds: number = 3600
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const toSignSet = new Set<string>();

  for (const raw of paths) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (isDirectUrl(trimmed)) {
      result[trimmed] = trimmed;
    } else {
      toSignSet.add(trimmed.replace(/^\/+/, ""));
    }
  }

  const toSign = Array.from(toSignSet);
  if (toSign.length === 0) return result;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(toSign, expiresInSeconds);

    if (!error && Array.isArray(data)) {
      data.forEach((item, idx) => {
        const key = item.path || toSign[idx];
        if (item.signedUrl && key) {
          result[key] = item.signedUrl;
        }
      });
    }
  } catch (err) {
    console.warn("Batch createSignedUrls failed:", err);
  }

  // Fallback for any path that did not get a signed URL
  for (const p of toSign) {
    if (!result[p]) {
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(p);
      if (pub?.publicUrl) {
        result[p] = pub.publicUrl;
      }
    }
  }

  return result;
}
