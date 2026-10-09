export const QUESTION_ID_PAGE_SIZE = 500;

/** Reservoir sampling gives every eligible ID the same chance, without
 * fetching the entire bank's question text or exceeding API page limits.
 * A failed page rejects the whole sample rather than favouring earlier rows. */
export async function sampleQuestionIds(
  fetchPage: (from: number, to: number) => Promise<readonly { id: string }[]>,
  limit: number,
  randomIndex: (exclusiveMax: number) => number,
): Promise<string[]> {
  if (!Number.isFinite(limit) || limit < 1) return [];
  const size = Math.min(300, Math.floor(limit));
  const selected: string[] = [];
  let seen = 0;

  for (let from = 0; ; from += QUESTION_ID_PAGE_SIZE) {
    const rows = await fetchPage(from, from + QUESTION_ID_PAGE_SIZE - 1);
    for (const row of rows) {
      seen += 1;
      if (selected.length < size) selected.push(row.id);
      else {
        const slot = randomIndex(seen);
        if (slot < size) selected[slot] = row.id;
      }
    }
    if (rows.length < QUESTION_ID_PAGE_SIZE) return selected;
  }
}
