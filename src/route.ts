/**
 * Hash routes, so browser Back and Forward work without any server configuration:
 *   #/                 the level select screen
 *   #/contact/<id>     a contact
 *   #/practice         free practice
 */
export type Route = { view: 'levels' } | { view: 'contact'; id: string } | { view: 'practice' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (path === 'practice') return { view: 'practice' };
  const contact = /^contact\/([\w-]+)$/.exec(path);
  if (contact) return { view: 'contact', id: contact[1] };
  return { view: 'levels' };
}

export function routeHash(route: Route): string {
  switch (route.view) {
    case 'contact':
      return `#/contact/${route.id}`;
    case 'practice':
      return '#/practice';
    default:
      return '#/';
  }
}

export function sameRoute(a: Route, b: Route): boolean {
  return routeHash(a) === routeHash(b);
}
