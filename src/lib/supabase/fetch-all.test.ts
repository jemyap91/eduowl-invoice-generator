import { describe, it, expect } from "vitest"
import { fetchAll } from "./fetch-all"

interface Row { i: number }

/** A fake PostgREST query builder that serves `total` rows, capped at 1000 per range. */
function fakeSource(total: number, failOnCall?: number) {
  const calls: Array<[number, number]> = []
  const build = () => ({
    range(from: number, to: number) {
      calls.push([from, to])
      if (failOnCall !== undefined && calls.length === failOnCall) {
        return Promise.resolve({ data: null, error: { message: "boom" } })
      }
      const rows: Row[] = []
      for (let i = from; i <= Math.min(to, total - 1); i++) rows.push({ i })
      return Promise.resolve({ data: rows, error: null })
    },
  })
  return { build, calls }
}

describe("fetchAll", () => {
  it("pages past the 1000-row cap and returns every row", async () => {
    const { build, calls } = fakeSource(2500)
    const { data, error } = await fetchAll<Row>(build)
    expect(error).toBeNull()
    expect(data).toHaveLength(2500)
    expect(data[0].i).toBe(0)
    expect(data[2499].i).toBe(2499)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it("stops when an exact multiple of the page size runs out", async () => {
    const { build, calls } = fakeSource(2000)
    const { data, error } = await fetchAll<Row>(build)
    expect(error).toBeNull()
    expect(data).toHaveLength(2000)
    expect(calls).toHaveLength(3)
  })

  it("returns the error from page 2 with the rows fetched so far", async () => {
    const { build } = fakeSource(2500, 2)
    const { data, error } = await fetchAll<Row>(build)
    expect(error).toEqual({ message: "boom" })
    expect(data).toHaveLength(1000)
    expect(data[999].i).toBe(999)
  })
})
