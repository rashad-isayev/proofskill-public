import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Turns stored data keys (camelCase or snake_case) into readable labels:
// "firstResponseMinutes" → "First response minutes", "csat_score" → "CSAT score".
const acronyms = new Set([
  "csat",
  "sla",
  "nps",
  "kpi",
  "roi",
  "ctr",
  "cpc",
  "cpa",
  "aov",
  "arr",
  "mrr",
  "id",
  "url",
]);
export function humanizeKey(key: string) {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (acronyms.has(w) ? w.toUpperCase() : w));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Internal keys for hidden findings ("investigation_2", "event_1") carry no meaning for readers.
export const isInternalKey = (key: string) =>
  /^(investigation|event)_\d+$/.test(key);
