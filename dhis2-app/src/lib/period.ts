import type { PeriodType } from '../config/programmes'

export interface ParsedPeriod {
  id: string
  start: Date
  end: Date
}

function isoWeekMonday(year: number, week: number): Date {
  // ISO 8601: week 1 is the week containing the year's first Thursday, weeks
  // start on Monday. Cross-checked against Python's date.fromisocalendar in
  // period.test.ts.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Weekday = jan4.getUTCDay() || 7 // Sun=0 -> 7, so Mon=1..Sun=7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Weekday - 1))
  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return monday
}

export function parsePeriod(periodType: PeriodType, id: string): ParsedPeriod {
  if (periodType === 'Weekly') {
    const match = /^(\d{4})W(\d{1,2})$/.exec(id)
    if (!match) throw new Error(`Invalid weekly DHIS2 period: ${id}`)
    const start = isoWeekMonday(Number(match[1]), Number(match[2]))
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
    return { id, start, end }
  }
  if (periodType === 'SixMonthly') {
    const match = /^(\d{4})S([12])$/.exec(id)
    if (!match) throw new Error(`Invalid six-monthly DHIS2 period: ${id}`)
    const year = Number(match[1])
    const startMonth = match[2] === '1' ? 0 : 6
    const start = new Date(Date.UTC(year, startMonth, 1))
    const end = new Date(Date.UTC(year, startMonth + 6, 0))
    return { id, start, end }
  }
  const match = /^(\d{4})$/.exec(id)
  if (!match) throw new Error(`Invalid yearly DHIS2 period: ${id}`)
  const year = Number(match[1])
  return { id, start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)) }
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
