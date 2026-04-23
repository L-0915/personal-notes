// electron/utils/slugify.ts

/**
 * Convert a paper title into a filename-safe slug.
 *
 * Rules:
 *  - Lowercase
 *  - Replace non-alphanumeric runs with a single hyphen
 *  - Strip leading / trailing hyphens
 *  - Collapse consecutive hyphens
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')   // replace non-letter/number runs with hyphen
    .replace(/-{2,}/g, '-')              // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');            // strip leading/trailing hyphens
}
