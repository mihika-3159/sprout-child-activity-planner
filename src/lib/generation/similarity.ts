/**
 * Title and concept similarity checking to prevent duplicate or near-duplicate
 * activities in a single plan.
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "the", "with", "for", "in", "of", "to", "on", "at", "by", "from",
  "or", "as", "is", "it", "its", "your", "my", "our", "their"
]);

export function normalizeTitleTokens(title: string): Set<string> {
  if (!title) return new Set();
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

/**
 * Computes Jaccard token similarity between two titles.
 * Returns a value between 0 (completely different) and 1 (identical meaningful tokens).
 */
export function normalizedTitleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a.toLowerCase().trim() === b.toLowerCase().trim()) return 1.0;

  const setA = normalizeTitleTokens(a);
  const setB = normalizeTitleTokens(b);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks if a candidate title already exists or is near-identical to any in the plan.
 */
export function titleExistsInPlan(
  newTitle: string,
  existingTitles: string[],
  threshold = 0.75
): boolean {
  if (!newTitle || !existingTitles || existingTitles.length === 0) return false;
  const cleanNew = newTitle.toLowerCase().trim();

  for (const existing of existingTitles) {
    if (!existing) continue;
    if (cleanNew === existing.toLowerCase().trim()) return true;
    if (normalizedTitleSimilarity(newTitle, existing) >= threshold) return true;
  }
  return false;
}
