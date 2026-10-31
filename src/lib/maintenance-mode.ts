// Temporary maintenance mode: routes matching this pattern remain available.
export const MAINTENANCE_ALLOWED_PATH = '^/maintenance/?$';

export function isMaintenanceAllowed(pathname: string): boolean {
  return new RegExp(MAINTENANCE_ALLOWED_PATH).test(pathname);
}
