import { addMonths, addWeeks, isBefore, isEqual, startOfDay, format } from 'date-fns'

export interface SessionDate {
  date: string // YYYY-MM-DD
  dayOfWeek: number
}

/**
 * Generate session dates for a recurring series.
 * @param dayOfWeek 0=Sunday, 1=Monday, ..., 6=Saturday
 * @param startDate First possible date
 * @param endDate Last possible date (if null, generate 3 months ahead)
 */
export function generateSessionDates(
  dayOfWeek: number,
  startDate: Date,
  endDate: Date | null
): SessionDate[] {
  const hasExplicitEnd = !!endDate
  const end = endDate || addMonths(startDate, 6) // 6 months
  const dates: SessionDate[] = []

  // Find first occurrence of dayOfWeek on or after startDate
  let current = startOfDay(startDate)
  while (current.getDay() !== dayOfWeek) {
    current = new Date(current.getTime() + 86400000) // add 1 day
  }

  while (isBefore(current, end) || (hasExplicitEnd && isEqual(current, end))) {
    dates.push({
      date: format(current, 'yyyy-MM-dd'),
      dayOfWeek
    })
    current = addWeeks(current, 1)
  }

  return dates
}
