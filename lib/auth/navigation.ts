// Only the project creation route may be used as a post-login destination.
export function projectLoginPath(destination = '/new-project') {
  return `/login?next=${encodeURIComponent(destination)}`;
}
export function safeProjectDestination(value: string | null, fallback = '/home') {
  if (!value) return fallback;
  try {
    const url = new URL(value, 'http://local');
    if (!value.startsWith('/') || url.origin !== 'http://local' || url.pathname !== '/new-project')
      return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
