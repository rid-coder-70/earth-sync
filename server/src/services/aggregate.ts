import type { Detection } from '../types.js';

export const ACTIVITY_THRESHOLDS = { medium: 10, high: 35 } as const;
export const UNUSUAL_Z_SCORE = Number(process.env.UNUSUAL_Z_SCORE ?? 2);
export type ActivityLevel = 'low' | 'medium' | 'high' | 'unusual';
export interface DayAggregate { date: string; count: number; activity: ActivityLevel; }
const dayCounts = (records: Detection[]) => records.reduce<Record<string, number>>((counts, item) => { counts[item.acqDate] = (counts[item.acqDate] ?? 0) + 1; return counts; }, {});
export function activityLevel(count: number): ActivityLevel { return count >= ACTIVITY_THRESHOLDS.high ? 'high' : count >= ACTIVITY_THRESHOLDS.medium ? 'medium' : 'low'; }
export function calendarForMonth(records: Detection[], year: number, month: number): DayAggregate[] {
  const counts = dayCounts(records);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
    const count = counts[date] ?? 0;
    return { date, count, activity: activityLevel(count) };
  });
}
export function historicalForYears(records: Detection[], years: number[]) {
  const monthly = new Map<string, number>();
  for (const record of records) {
    const year = Number(record.acqDate.slice(0, 4)), month = Number(record.acqDate.slice(5, 7));
    const key = `${year}-${month}`; monthly.set(key, (monthly.get(key) ?? 0) + 1);
  }
  return years.map(year => ({ year, months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: monthly.get(`${year}-${index + 1}`) ?? 0 })) }));
}
export function unusualForDate(records: Detection[], date: string) {
  const counts = dayCounts(records), target = counts[date] ?? 0;
  const month = date.slice(5, 7);
  const baselineValues = Object.entries(counts).filter(([day]) => day.slice(5, 7) === month && day !== date).map(([, count]) => count);
  const mean = baselineValues.length ? baselineValues.reduce((sum, n) => sum + n, 0) / baselineValues.length : 0;
  const variance = baselineValues.length ? baselineValues.reduce((sum, n) => sum + (n - mean) ** 2, 0) / baselineValues.length : 0;
  const sd = Math.sqrt(variance);
  const unusual = baselineValues.length >= 3 && target > mean + UNUSUAL_Z_SCORE * sd && target > mean;
  return { date, unusual, count: target, baseline: { mean: Number(mean.toFixed(2)), standardDeviation: Number(sd.toFixed(2)), sampleDays: baselineValues.length, thresholdZScore: UNUSUAL_Z_SCORE }, explanation: unusual ? `${target} observations vs a same-month daily baseline of ${mean.toFixed(1)} (>${UNUSUAL_Z_SCORE} standard deviations).` : baselineValues.length < 3 ? 'Not enough same-month observations are cached to establish a reliable baseline.' : `${target} observations; this is not above the same-month baseline by ${UNUSUAL_Z_SCORE} standard deviations.` };
}
export function criticalPeriods(records: Detection[]) {
  const counts = dayCounts(records), byYearMonth = new Map<string, number>();
  for (const [date, count] of Object.entries(counts)) {
    const key = `${date.slice(0, 4)}-${Number(date.slice(5, 7))}`;
    byYearMonth.set(key, (byYearMonth.get(key) ?? 0) + count);
  }
  const years = [...new Set(Object.keys(counts).map(date => date.slice(0, 4)))];
  if (years.length < 2) return [];
  const monthAvgs = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const vals = years.map(year => byYearMonth.get(`${year}-${month}`) ?? 0);
    return { month, avg: vals.reduce((sum, n) => sum + n, 0) / vals.length, activeYears: vals.filter(n => n > 0).length };
  });
  const overall = monthAvgs.reduce((sum, item) => sum + item.avg, 0) / 12;
  const elevated = monthAvgs.filter(item => item.avg > overall && item.activeYears >= Math.ceil(years.length * 0.6));
  const labels = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const groups: typeof elevated[] = [];
  for (const item of elevated) {
    const current = groups[groups.length - 1];
    if (current && current[current.length - 1]!.month === item.month - 1) current.push(item);
    else groups.push([item]);
  }
  return groups.map(group => {
    const startMonth = group[0]!.month, endMonth = group[group.length - 1]!.month;
    const avg = group.reduce((sum, item) => sum + item.avg, 0) / group.length;
    const activeYears = Math.min(...group.map(item => item.activeYears));
    return { month: startMonth, label: startMonth === endMonth ? labels[startMonth - 1] : `${labels[startMonth - 1]}–${labels[endMonth - 1]}`, averageCount: Number(avg.toFixed(1)), recurrence: `${activeYears}/${years.length} years`, startMonth, endMonth };
  });
}
