// Service-role callers must validate both the row owner and the object namespace.
// Reject encoded delimiters/traversal rather than normalizing an untrusted path.
export function ownedStoragePath(userId: string, path: unknown): string {
  if (!userId || typeof path !== 'string' || /[\\%?#\x00-\x1f]/.test(path)) throw new Error('STORAGE_OWNERSHIP_INVALID');
  const parts = path.split('/');
  if (parts.length < 2 || parts[0] !== userId || parts.some(part => !part || part === '.' || part === '..')) throw new Error('STORAGE_OWNERSHIP_INVALID');
  return path;
}
