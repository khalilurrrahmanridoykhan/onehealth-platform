import type { WeeklyCount } from './types'

// Confirmed live: https://ourworldindata.org/grapher/weekly-covid-cases.csv
// is a real, public, directly-fetchable CSV (WHO/JHU-sourced), no auth
// needed. Columns: Entity, Code, Day, Weekly cases. Confirmed by inspecting
// real rows that "Weekly cases" is a genuine rolling 7-day sum recomputed
// for every single day (each day's value is distinct, not held constant
// for 7 days then jumping) -- so sampling every 7th day from a country's
// first available row yields non-overlapping true weekly totals, not
// double-counted overlapping windows.
export const DEFAULT_DATA_URL = 'https://ourworldindata.org/grapher/weekly-covid-cases.csv'

interface ParsedRow {
  entity: string
  day: string
  weeklyCases: number
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split('\n')
  const rows: ParsedRow[] = []
  // header: Entity,Code,Day,Weekly cases
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = line.split(',')
    if (parts.length < 4) continue
    const [entity, , day, weeklyCasesRaw] = parts
    const weeklyCases = Number(weeklyCasesRaw)
    if (!Number.isFinite(weeklyCases)) continue
    rows.push({ entity, day, weeklyCases })
  }
  return rows
}

// Samples every 7th daily row (starting from the first row for that
// country) into non-overlapping weekly buckets -- see module comment for
// why this is valid given the rolling-sum source data.
export function sampleWeekly(rows: ParsedRow[]): WeeklyCount[] {
  const weeks: WeeklyCount[] = []
  for (let i = 0; i < rows.length; i += 7) {
    weeks.push({ weekStart: rows[i].day, count: rows[i].weeklyCases })
  }
  return weeks
}

export async function fetchWeeklyCounts(country: string, url: string = DEFAULT_DATA_URL): Promise<WeeklyCount[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Data source returned ${response.status} ${response.statusText} for ${url}`)
  }
  const text = await response.text()
  const rows = parseCsv(text).filter((r) => r.entity === country)
  if (rows.length === 0) {
    throw new Error(`No rows found for country "${country}" -- check the exact "Entity" spelling used in the source CSV.`)
  }
  return sampleWeekly(rows)
}
