const PAGE = 1000

/**
 * Fetch every row of a query in pages, working around PostgREST's max_rows cap.
 * `build` must return a fresh query each call (filters and order included).
 */
export async function fetchAll<T>(
  build: () => { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }> }
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return { data: rows, error: null }
}
