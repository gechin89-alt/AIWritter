export const DEFAULT_FREE_POST_LIMIT = 3;

export function effectivePostLimit(postLimit: number | null): number {
  return postLimit ?? DEFAULT_FREE_POST_LIMIT;
}
