/**
 * Generate a URL-friendly slug from a title.
 * e.g. "Casual beginner chess" → "casual-beginner-chess"
 * Appends a short random suffix to avoid collisions.
 */
export function generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove non-word chars (except spaces and hyphens)
      .replace(/\s+/g, '-')     // spaces to hyphens
      .replace(/-+/g, '-')      // collapse multiple hyphens
      .replace(/^-|-$/g, '')    // trim leading/trailing hyphens
      .slice(0, 60);            // cap length
  
    // Append 4-char random suffix for uniqueness
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${base}-${suffix}`;
  }
  
  /**
   * Check if a string looks like a UUID (used for backwards compatibility).
   */
  export function isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }