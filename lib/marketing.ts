export const marketingLinks = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-job-seekers", label: "For candidates" },
  { href: "/for-enterprises", label: "For hiring teams" },
] as const;

export function isMarketingPage(path: string) {
  return marketingLinks.some(({ href }) => href === path);
}
