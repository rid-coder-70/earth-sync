import type { Day } from '../api/client';
import { motion } from 'framer-motion';
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export default function ActivityCalendar({ year, month, days, selectedDate, loading, onSelect, onMonth }: { year: number; month: number; days: Day[]; selectedDate: string; loading: boolean; onSelect: (date: string) => void; onMonth: (year: number, month: number) => void }) {
  const firstOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const title = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
  return <motion.section className="card calendar-card" whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 14 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45 }}>
    <div className="section-heading"><div><p className="eyebrow">DAILY INTENSITY</p><h2>Activity calendar</h2>{loading && <span className="muted">Updating calendar…</span>}</div><div className="month-arrows"><button onClick={() => onMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)} aria-label="Previous month">‹</button><strong>{title} {year}</strong><button onClick={() => onMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)} aria-label="Next month">›</button></div></div>
    <div className="calendar-grid">{weekdays.map((day, index) => <span className="weekday" key={`${day}-${index}`}>{day}</span>)}{Array.from({ length: firstOffset }, (_, i) => <span key={`empty-${i}`} />)}{days.map(day => <motion.button key={day.date} title={`${day.date}: ${day.count} detections · ${day.activity}`} onClick={() => onSelect(day.date)} className={`day-cell level-${day.activity} ${selectedDate === day.date ? 'selected' : ''}`} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}>{Number(day.date.slice(-2))}{day.activity === 'unusual' && <i />}</motion.button>)}</div>
    <div className="calendar-legend"><span><i className="level-low" />Low</span><span><i className="level-medium" />Moderate</span><span><i className="level-high" />High</span><span><i className="level-unusual" />Unusual</span></div>
  </motion.section>;
}
