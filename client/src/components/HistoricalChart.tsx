import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import type { CriticalPeriod, HistoricalResponse } from '../api/client';
const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const colors = ['#c95a46', '#397d55', '#bd872f', '#557ca9', '#80629b'];
export default function HistoricalChart({ data, periods }: { data: HistoricalResponse | null; periods: CriticalPeriod[] }) {
  const rows = monthNames.map((month, index) => { const row: Record<string, string | number> = { month }; data?.years.forEach(year => { row[String(year.year)] = year.months[index]?.count ?? 0; }); return row; });
  return <motion.section className="card chart-card" whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 14 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45 }}><div className="section-heading"><div><p className="eyebrow">LONG-RANGE SIGNAL</p><h2>Historical activity</h2></div><span className="chart-unit">detections / month</span></div>
    <div className="chart-legend">{data?.years.map((year, index) => <span key={year.year}><i style={{ background: colors[index % colors.length] }} />{year.year}</span>)}</div>
    <div className="chart-wrap">{data ? <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 7, right: 5, left: -19, bottom: 0 }}><CartesianGrid stroke="#dce4dc" vertical={false} /><XAxis dataKey="month" tick={{ fill: '#59665d', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#59665d', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#fffefa', border: '1px solid #cbd7cb', borderRadius: 6, color: '#18211b' }} /><>{data.years.map((year, index) => <Bar key={year.year} dataKey={String(year.year)} fill={colors[index % colors.length]} radius={[3,3,0,0]} maxBarSize={13} />)}</></BarChart></ResponsiveContainer> : <div className="loading-inline">Loading historical records…</div>}</div>
    <div className="critical-periods"><span className="critical-label">RECURRING WINDOWS</span>{periods.length ? periods.map(period => <span className="period-pill" key={period.month}><i />{period.label} <small>{period.recurrence}</small></span>) : <span className="muted">No recurring elevated window in available years.</span>}</div>
  </motion.section>;
}
