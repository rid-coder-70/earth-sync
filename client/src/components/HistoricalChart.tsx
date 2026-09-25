import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CriticalPeriod, HistoricalResponse } from '../api/client';
const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const colors = ['#ff705f', '#55d8d0', '#f3c46b', '#8fb8ff', '#b59bff'];
export default function HistoricalChart({ data, periods }: { data: HistoricalResponse | null; periods: CriticalPeriod[] }) {
  const rows = monthNames.map((month, index) => { const row: Record<string, string | number> = { month }; data?.years.forEach(year => { row[String(year.year)] = year.months[index]?.count ?? 0; }); return row; });
  return <section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">LONG-RANGE SIGNAL</p><h2>Historical activity</h2></div><span className="chart-unit">detections / month</span></div>
    <div className="chart-legend">{data?.years.map((year, index) => <span key={year.year}><i style={{ background: colors[index % colors.length] }} />{year.year}</span>)}</div>
    <div className="chart-wrap">{data ? <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 7, right: 5, left: -19, bottom: 0 }}><CartesianGrid stroke="#293149" vertical={false} /><XAxis dataKey="month" tick={{ fill: '#929bb7', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#929bb7', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#171e31', border: '1px solid #455174', borderRadius: 10, color: '#f0f1fb' }} /><>{data.years.map((year, index) => <Bar key={year.year} dataKey={String(year.year)} fill={colors[index % colors.length]} radius={[3,3,0,0]} maxBarSize={13} />)}</></BarChart></ResponsiveContainer> : <div className="loading-inline">Loading historical records…</div>}</div>
    <div className="critical-periods"><span className="critical-label">RECURRING WINDOWS</span>{periods.length ? periods.map(period => <span className="period-pill" key={period.month}><i />{period.label} <small>{period.recurrence}</small></span>) : <span className="muted">No recurring elevated window in available years.</span>}</div>
  </section>;
}
