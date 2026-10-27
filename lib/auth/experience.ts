export const experiences = ["job-seeker", "enterprise"] as const;
export type Experience = (typeof experiences)[number];

export function isExperience(value: unknown): value is Experience {
  return value === "job-seeker" || value === "enterprise";
}

export function dashboardFor(experience: Experience) {
  void experience;
  return "/enterprise";
}

export function routeExperience(path: string): Experience | "either" | null {
  if (/^\/enterprise(\/|$)/.test(path)) return "enterprise";
  if (path === "/api/simulations/evaluate") return "enterprise";
  if (/^\/api\/(assessments|reports|dashboard|candidates)(\/|$)/.test(path))
    return "enterprise";
  return null;
}

// Only known product paths can be used as post-login destinations.
export function safeDestination(
  value: unknown,
  experience: Experience,
): string {
  const fallback = dashboardFor(experience);
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    value.startsWith("/api/") ||
    /[\\%?#\s]/.test(value)
  )
    return fallback;
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(value)) return fallback;
  const required = routeExperience(value);
  return experience === "enterprise" && required === "enterprise"
    ? value
    : fallback;
}
