/**
 * Pure helpers for paginated catalog browsing. Kept free of Supabase/Next
 * imports so they are trivially unit-testable; the query side lives in
 * catalog-browse.ts.
 */

export const PROGRAMS_PAGE_SIZE = 24;
export const COURSES_PAGE_SIZE = 50;

/** Hard ceiling so a hostile `page` param can never produce a huge offset. */
export const MAX_PAGE = 10_000;

export function sanitizePage(raw: string | undefined): number {
  if (!raw) return 1;
  if (!/^\d+$/.test(raw)) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_PAGE);
}

export function lastPageFor(count: number | null, pageSize: number): number {
  if (!count || count <= 0) return 1;
  return Math.ceil(count / pageSize);
}

/** Inclusive bounds for supabase `.range()`. */
export function rangeBounds(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Human-facing "Showing start–end of count". */
export function showingRange(
  page: number,
  pageSize: number,
  count: number,
): { start: number; end: number } {
  if (count <= 0) return { start: 0, end: 0 };
  const start = (page - 1) * pageSize + 1;
  return { start, end: Math.min(page * pageSize, count) };
}

/**
 * For plain `.ilike()` filters: strips SQL LIKE wildcards plus the characters
 * PostgREST's `.or()` grammar treats as syntax, and caps length.
 */
export function sanitizeSearchText(raw: string): string {
  return raw
    .slice(0, 100)
    .replace(/[%_,().'"\\]/g, "")
    .trim();
}

/**
 * For values embedded in a `.or()` filter string: whitelist alphanumerics and
 * spaces. PostgREST parses `,`/`(`/`)` as logic inside `.or()`, so anything
 * outside the whitelist is an injection vector, not a search term.
 */
export function sanitizeCodeSearch(raw: string): string {
  return raw
    .slice(0, 100)
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds the course search `.or()` string matching title OR generated code
 * column. Returns null when nothing searchable remains after sanitization.
 * The university scope must stay a separate chained `.eq()` — never move it
 * into this string.
 */
export function courseSearchOr(raw: string): string | null {
  const q = sanitizeCodeSearch(raw);
  if (!q) return null;
  return `title.ilike.%${q}%,code.ilike.%${q}%`;
}

/** Builds a page link preserving filters; page 1 gets the canonical bare URL. */
export function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  else search.delete("page");
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export type PageItem = number | "ellipsis";

/** Windowed page list: first, last, current ±1, ellipses between gaps. */
export function pageNumbers(current: number, last: number): PageItem[] {
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  const wanted = new Set<number>([1, last, current - 1, current, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const items: PageItem[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) items.push("ellipsis");
    items.push(p);
    prev = p;
  }
  return items;
}
