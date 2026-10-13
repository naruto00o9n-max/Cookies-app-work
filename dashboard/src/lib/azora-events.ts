import type { Work } from '../../../mobile/src/lib/types';
export function newPublishedChapters(previous: unknown[] | undefined, current: { number: string }[]) {
  if (!previous) return []; // First successful sync establishes a baseline, without historical alerts.
  const seen = new Set(previous.map(n => String(Number(n))));
  return [...new Set(current.map(c => String(Number(c.number))))].filter(n => Number.isFinite(Number(n)) && !seen.has(n)).sort((a,b) => Number(a)-Number(b));
}
export function workRecipients(records: Record<string, { work_name: string; work_type: string; chapter: string }[]>, work: Work, chapter: string) {
  if (work.isolated || work.active === false || Number(chapter) < (work.paid_start ?? 0)) return [];
  return Object.entries(records).filter(([, entries]) => entries.some(e => e.work_name === work.name && !['مكافأة','خصم'].includes(e.work_type) && e.chapter !== '-') && !entries.some(e => e.work_name === work.name && Number(e.chapter) === Number(chapter) && !['مكافأة','خصم'].includes(e.work_type))).map(([id]) => id);
}
export function azoraMetadata(post: Record<string, any>, chapters: { number: string }[]) {
  const cover = typeof post.featuredImage === 'string' && /^https:\/\//.test(post.featuredImage) ? post.featuredImage : undefined;
  return {
    ...(cover ? { cover } : {}),
    title: String(post.postTitle || post.title || post.slug || '').trim(),
    description: String(post.postContent || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,2500),
    latestChapter: chapters.length ? String(Math.max(...chapters.map(c => Number(c.number)))) : undefined,
    chapterCount: chapters.length,
  };
}
