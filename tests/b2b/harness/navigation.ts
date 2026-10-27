export function useRouter() {
  return { push: (path: string) => location.assign(path) };
}

export function usePathname() {
  return location.pathname;
}
