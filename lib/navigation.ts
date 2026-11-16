/**
 * Shared navigation helper for hashrate purchase routes.
 *
 * Implements the required auth-aware purchase entry point rule:
 * - Signed in  -> in-dashboard purchase experience (/dashboard?action=buy)
 * - Signed out -> public purchase page (/buy)
 */
export function getPurchaseHref(isAuthed: boolean): string {
  return isAuthed ? "/dashboard?action=buy" : "/buy";
}
