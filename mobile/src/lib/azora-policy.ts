import { workKey } from "./work-lookup";
import type { Work } from "./types";
export const CATALOG_VERSION = 2;
export type CatalogPost = {
  slug: string;
  postTitle: string;
  featuredImage?: string;
  id?: number;
};
export function catalogPost(
  value: Record<string, any>,
  slug?: string,
): CatalogPost | null {
  const key = String(value.slug || slug || "");
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(key)) return null;
  const image = value.featuredImage || value.cover;
  return {
    slug: key,
    postTitle: String(
      value.postTitle || value.title_en || value.title || key,
    ).trim(),
    ...(typeof image === "string" && /^https:\/\//.test(image)
      ? { featuredImage: image }
      : {}),
    ...(Number.isSafeInteger(Number(value.id || value.post_id)) &&
    Number(value.id || value.post_id) > 0
      ? { id: Number(value.id || value.post_id) }
      : {}),
  };
}
export function catalogDecision(
  state: Record<string, any>,
  known: Record<string, unknown>,
  posts: CatalogPost[],
  complete: boolean,
) {
  const fresh = posts.filter((p) => !Object.hasOwn(known, p.slug));
  const baseline =
    state.native_catalog_version !== CATALOG_VERSION ||
    !state.baseline_done ||
    !state.listing_v2;
  const backfill = fresh.length > 10;
  return {
    baseline,
    backfill,
    fresh,
    add:
      complete && !baseline && !backfill && state.auto_add_new_works !== false
        ? fresh
        : [],
  };
}
export function canAutoAdd(works: Work[], post: CatalogPost) {
  return (
    !!post.postTitle &&
    !works.some(
      (w) =>
        w.azora?.slug === post.slug ||
        workKey(w.name) === workKey(post.postTitle) ||
        (w.azora?.title_en &&
          workKey(w.azora.title_en) === workKey(post.postTitle)),
    )
  );
}
// Only the previous application's bulk-import signature is eligible; bot/manual links have linked_by.
export function accidentalCatalogWork(
  work: Work,
  known: Record<string, any>,
  records: { work_name: string }[],
) {
  const a = work.azora,
    post = a && known[a.slug];
  return Boolean(
    a &&
    !a.linked_by &&
    a.linked_at &&
    a.linked_at >= "2026-10-13T00:00:00" &&
    a.post_id &&
    a.title_en === work.name &&
    post &&
    workKey(String(post.postTitle || post.title_en || "")) ===
      workKey(work.name) &&
    work.active === true &&
    work.paid_start == null &&
    !work.isolated &&
    !Object.keys(work.custom_prices || {}).length &&
    !records.some((r) => workKey(r.work_name) === workKey(work.name)),
  );
}
