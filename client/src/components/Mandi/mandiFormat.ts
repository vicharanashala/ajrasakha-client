// Shown in place of a price the mandi did not report.
export const MISSING_PRICE = '--';

// Varieties the service sends when the mandi did not name one. They are not shown.
const GENERIC_VARIETIES = new Set(['other', 'others', 'na', 'n/a', '-']);

// Capitalises the first letter of each word, including words that start after a bracket or dash,
// e.g. "bhagta bhai ka (jalal)" becomes "Bhagta Bhai Ka (Jalal)".
export const toTitleCase = (text: string) =>
  text
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, prefix, letter) => prefix + letter.toUpperCase());

// Formats a mandi name for display and keeps the APMC abbreviation upper case.
export const formatMandiName = (name: string) => toTitleCase(name).replace(/\bApmc\b/g, 'APMC');

// Returns the variety to show beside the crop name, or null when it is generic.
export const getDisplayVariety = (variety: string | null) =>
  variety && !GENERIC_VARIETIES.has(variety.trim().toLowerCase()) ? toTitleCase(variety) : null;

// Formats a rupee amount with Indian digit grouping, e.g. 227500 becomes 2,27,500.
export const formatPriceNumber = (value: number | null) =>
  value === null ? MISSING_PRICE : Math.round(value).toLocaleString('en-IN');

// True when a unit is not per quintal, the unit the price table headers assume.
export const isNonQuintalUnit = (unit: string | null) => !!unit && !/quintal/i.test(unit);

// Formats a service date such as "2026-11-17" as a short local date, e.g. "17 Nov 2026".
// The date is built from its parts so it never shifts a day because of the time zone.
export function formatReportDate(value: string | null) {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return value;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Formats a distance in km with one decimal at most, e.g. 18.64 becomes "18.6".
export const formatDistanceNumber = (distanceKm: number) => String(Number(distanceKm.toFixed(1)));
