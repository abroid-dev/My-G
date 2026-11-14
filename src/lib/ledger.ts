/**
 * Ledger helpers: date maths and data shaping shared by components.
 * Pure functions only; all content comes from astro:content.
 */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'entries'>;
export type Study = CollectionEntry<'studies'>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The month the site was built. "Present" is measured against this. */
export const AS_OF = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const parse = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return { y, mo };
};

export const monthIndex = (m: string) => {
  const { y, mo } = parse(m);
  return y * 12 + (mo - 1);
};

/** "Aug 2020" */
export const fmtMonth = (m: string | null | undefined, long = false) => {
  if (!m) return 'Present';
  const { y, mo } = parse(m);
  return `${(long ? MONTHS_LONG : MONTHS)[mo - 1]} ${y}`;
};

export const fmtYear = (m: string | null | undefined) => (m ? String(parse(m).y) : 'now');

/** Inclusive month count, matching LinkedIn ("Aug 2020 – Feb 2024" = 43). */
export const months = (start: string, end: string | null) => monthIndex(end ?? AS_OF) - monthIndex(start) + 1;

/** "3 yr 7 mo" */
export const fmtDuration = (n: number) => {
  const y = Math.floor(n / 12);
  const m = n % 12;
  return [y ? `${y} yr` : '', m ? `${m} mo` : ''].filter(Boolean).join(' ') || '1 mo';
};

/** "2020–24", "2023", "2026–" */
export const fmtSpan = (start: string, end: string | null) => {
  const a = parse(start).y;
  if (!end) return `${a}–`;
  const b = parse(end).y;
  return a === b ? `${a}` : `${a}–${String(b).slice(2)}`;
};

export async function getProfile() {
  const p = await getEntry('profile', 'main');
  if (!p) throw new Error('src/content/profile.yaml must contain an entry with id: main');
  return p.data;
}

/** Published entries, oldest first, with a ledger number attached. */
export async function getEntries() {
  const all = (await getCollection('entries', (e) => e.data.status === 'published')).sort(
    (a, b) => monthIndex(a.data.start) - monthIndex(b.data.start) || a.data.role.localeCompare(b.data.role),
  );
  return all.map((e, i) => ({ ...e, no: String(i + 1).padStart(2, '0') }));
}

export type NumberedEntry = Awaited<ReturnType<typeof getEntries>>[number];

export async function getStudies() {
  return (await getCollection('studies')).sort((a, b) => a.data.order - b.data.order);
}

export async function getChapters() {
  return (await getCollection('chapters')).sort((a, b) => a.data.order - b.data.order);
}

/** The first year anything was recorded: the ledger's opening date. */
export async function ledgerOpened() {
  const s = await getStudies();
  const e = await getEntries();
  const starts = [...s.map((x) => x.data.start).filter(Boolean), ...e.map((x) => x.data.start)] as string[];
  return starts.sort((a, b) => monthIndex(a) - monthIndex(b))[0];
}
