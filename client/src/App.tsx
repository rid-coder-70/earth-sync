import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { api, type CalendarResponse, type CriticalPeriod, type Detection, type HistoricalResponse, type SourceId, type UnusualResponse, type ViewMode } from './api/client';
import FireMap from './components/FireMap';
import ActivityCalendar from './components/ActivityCalendar';
import HistoricalChart from './components/HistoricalChart';
import fireEarth from './asstes/fire-earth.jpg';
const SOURCES: SourceId[] = ['MODIS_NRT', 'VIIRS_SNPP_NRT'];
const introVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12 } } };
const introItemVariants = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const dateValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const initialDate = dateValue(new Date());
function ErrorLine({ message, onRetry, sampleFallback = false }: { message?: string; onRetry?: () => void; sampleFallback?: boolean }) {
  if (!message) return null;
  const firsUnavailable = message.startsWith('NASA FIRMS request failed:');
  const title = firsUnavailable ? 'NASA FIRMS is temporarily unavailable' : 'Could not load this data';
  const summary = firsUnavailable
    ? sampleFallback ? 'Showing clearly labeled sample observations until the server can reach NASA.' : 'Some NASA sources failed. Available cached observations remain on the map.'
    : 'Check the API connection and retry the request.';
  return <div className="error-line" role="alert"><span className="error-mark" aria-hidden="true">!</span><div className="error-copy"><strong>{title}</strong><span>{summary}</span><details><summary>Technical details</summary><p>{message}</p></details></div>{onRetry && <button className="error-retry" type="button" onClick={onRetry}>Retry</button>}</div>;
}
function SignalLoader({ label }: { label: string }) { return <div className="signal-loader" role="status" aria-live="polite"><span className="signal-spinner" aria-hidden="true" /><span>{label}</span></div>; }
export default function App() {
  const [bbox, setBbox] = useState('-125,24,-66,50');
  const [bboxDraft, setBboxDraft] = useState(bbox);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [dayRange, setDayRange] = useState(1);
  const [view, setView] = useState<ViewMode>('harmonized');
  const [calendarCursor, setCalendarCursor] = useState({ year: Number(initialDate.slice(0, 4)), month: Number(initialDate.slice(5, 7)) });
  const [hotspots, setHotspots] = useState<Awaited<ReturnType<typeof api.hotspots>> | null>(null);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [historical, setHistorical] = useState<HistoricalResponse | null>(null);
  const [unusual, setUnusual] = useState<UnusualResponse | null>(null);
  const [critical, setCritical] = useState<CriticalPeriod[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingUnusual, setLoadingUnusual] = useState(false);
  const [error, setError] = useState('');
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({});
  const [sourceFilter, setSourceFilter] = useState<'all' | 'MODIS' | 'VIIRS'>('all');
  const endDate = selectedDate;
  const startDate = useMemo(() => { const date = new Date(`${endDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - dayRange + 1); return date.toISOString().slice(0, 10); }, [endDate, dayRange]);

  const loadMap = useCallback(async () => {
    setLoadingMap(true); setError('');
    try { setHotspots(await api.hotspots({ bbox, start: startDate, end: endDate, sources: SOURCES, view })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load observations.'); }
    finally { setLoadingMap(false); }
  }, [bbox, startDate, endDate, view]);
  useEffect(() => { void loadMap(); }, [loadMap]);
  useEffect(() => {
    let active = true; setLoadingCalendar(true);
    const failed = (key: string, e: unknown) => { if (active) setPanelErrors(old => ({ ...old, [key]: e instanceof Error ? e.message : 'Could not load this panel.' })); };
    void api.calendar(bbox, calendarCursor.year, calendarCursor.month).then(value => { if (active) setCalendar(value); }).catch(e => failed('calendar', e)).finally(() => { if (active) setLoadingCalendar(false); });
    void api.historical(bbox).then(value => { if (active) setHistorical(value); }).catch(e => failed('historical', e));
    void api.criticalPeriods(bbox).then(value => { if (active) setCritical(value.periods); }).catch(e => failed('critical', e));
    return () => { active = false; };
  }, [bbox, calendarCursor]);
  useEffect(() => {
    let active = true;
    setLoadingUnusual(true);
    setPanelErrors(old => { const next = { ...old }; delete next.unusual; return next; });
    void api.unusual(bbox, selectedDate).then(value => { if (active) setUnusual(value); }).catch(e => { if (active) setPanelErrors(old => ({ ...old, unusual: e instanceof Error ? e.message : 'Could not load activity status.' })); }).finally(() => { if (active) setLoadingUnusual(false); });
    return () => { active = false; };
  }, [bbox, selectedDate]);

  const markers: (Detection | NonNullable<typeof hotspots>['harmonized'][number])[] = useMemo(() => {
    if (!hotspots) return [];
    const points = view === 'harmonized' ? hotspots.harmonized : hotspots.records.filter(point => view === 'modis' ? point.sensor === 'MODIS' : point.sensor === 'VIIRS');
    return sourceFilter === 'all' || view !== 'harmonized' ? points : points.filter(point => 'sources' in point && point.sources.includes(sourceFilter));
  }, [hotspots, view, sourceFilter]);
  const onMapLocation = useCallback((latitude: number, longitude: number) => {
    const halfLat = 5, halfLon = 7;
    const centerLon = Math.min(180 - halfLon, Math.max(-180 + halfLon, longitude));
    const centerLat = Math.min(90 - halfLat, Math.max(-90 + halfLat, latitude));
    const next = `${(centerLon - halfLon).toFixed(2)},${(centerLat - halfLat).toFixed(2)},${(centerLon + halfLon).toFixed(2)},${(centerLat + halfLat).toFixed(2)}`;
    setBbox(next); setBboxDraft(next);
  }, []);
  const handleBboxSubmit = (event: FormEvent) => { event.preventDefault(); setBbox(bboxDraft.trim()); };
  const chooseDate = (date: string) => { setSelectedDate(date); setCalendarCursor({ year: Number(date.slice(0,4)), month: Number(date.slice(5,7)) }); };
  const selectedCount = view === 'harmonized' ? hotspots?.totals.harmonized : sourceFilter === 'all' ? hotspots?.totals[view] : markers.length;
  const status = loadingMap ? 'Syncing satellites…' : error ? 'Update failed' : 'Live observations';

  return <MotionConfig reducedMotion="user"><main className="app-shell">
    <motion.header className="topbar" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}><a className="brand" href="#top"><span className="brand-mark"><span /></span><span>Fire<span className="brand-light">-Dna</span><small>FIRE ACTIVITY EXPLORER</small></span></a><nav><a className="nav-active" href="#explorer">Explorer</a><a href="#activity">Activity</a><a href="#history">History</a></nav><div className="top-status"><span className={`status-dot ${loadingMap ? 'working' : error ? 'down' : ''}`} />{status}<span className="status-separator" />NASA FIRMS</div></motion.header>
    <motion.section className="hero" id="top" initial="hidden" animate="visible" variants={introVariants}><motion.div className="hero-copy"><motion.div className="hero-kicker" variants={introItemVariants}><span /> EARTH OBSERVATION · ACTIVE FIRE</motion.div><motion.h1 variants={introItemVariants}>One planet.<br /><em>Every signal.</em></motion.h1><motion.p variants={introItemVariants}>Bringing MODIS and VIIRS fire observations into focus. Explore, compare, and understand a changing planet.</motion.p><motion.div className="hero-footnote" variants={introItemVariants}><span className="hero-note-main"><span className="orbit-icon">◎</span>Harmonized satellite observations</span><span className="hero-divider" /><span className="hero-note-secondary">No forecasts. Just the facts.</span></motion.div></motion.div><div className="hero-visual"><motion.img src={fireEarth} alt="Earth from space with active fires glowing across its surface" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }} /></div></motion.section>
    {hotspots?.demoMode && <div className="demo-notice"><span>i</span> {hotspots.errors.length ? 'NASA FIRMS is unreachable, so clearly labeled synthetic sample observations are shown. Check server internet access and refresh to retry.' : 'DEMO MODE — synthetic sample data is shown. Add a FIRMS MAP_KEY on the server for real NASA observations.'}</div>}
    <section className="explorer-section" id="explorer"><div className="section-title"><div><p className="eyebrow">01 / OBSERVE</p><h2>Fire activity explorer</h2><p className="section-subtitle">Satellite detections, harmonized into a clearer picture.</p></div><div className="source-legend"><span><i className="legend-modis" />MODIS</span><span><i className="legend-viirs" />VIIRS</span><span><i className="legend-harmonized" />Harmonized</span></div></div>
      <div className="control-bar"><div className="control-group"><label htmlFor="date-input">OBSERVATION DATE</label><input id="date-input" type="date" value={selectedDate} onChange={event => chooseDate(event.target.value)} /></div><div className="control-group"><label htmlFor="range-select">WINDOW</label><select id="range-select" value={dayRange} onChange={event => setDayRange(Number(event.target.value))}><option value={1}>1 day</option><option value={3}>3 days</option><option value={5}>5 days</option></select></div><form className="control-group area-control" onSubmit={handleBboxSubmit}><label htmlFor="bbox-input">AREA · WEST, SOUTH, EAST, NORTH</label><div className="input-with-button"><input id="bbox-input" value={bboxDraft} onChange={event => setBboxDraft(event.target.value)} /><button type="submit" aria-label="Apply area">↗</button></div></form><div className="control-group"><label htmlFor="sensor-filter">SENSOR FILTER</label><select id="sensor-filter" value={sourceFilter} onChange={event => setSourceFilter(event.target.value as 'all' | 'MODIS' | 'VIIRS')}><option value="all">Both sensors</option><option value="MODIS">MODIS only</option><option value="VIIRS">VIIRS only</option></select></div><div className="control-group view-control"><label>VIEW MODE</label><div className="segmented"><button className={view === 'modis' ? 'active' : ''} onClick={() => setView('modis')}>MODIS</button><button className={view === 'viirs' ? 'active' : ''} onClick={() => setView('viirs')}>VIIRS</button><button className={view === 'harmonized' ? 'active' : ''} onClick={() => setView('harmonized')}>MERGED</button></div></div></div>
      <ErrorLine message={loadingMap ? undefined : error || (hotspots?.errors.length ? `NASA FIRMS request failed: ${hotspots.errors.join('; ')}` : undefined)} onRetry={() => void loadMap()} sampleFallback={Boolean(hotspots?.demoMode && hotspots.errors.length)} />
      <div className="map-card"><div className="map-header"><div><span className="live-indicator" /> <b>FIRE DETECTION MAP</b><span className="map-date">{startDate === endDate ? endDate : `${startDate} — ${endDate}`}</span></div><div className="map-tools"><span>{loadingMap ? 'UPDATING' : `${selectedCount ?? 0} ${view === 'harmonized' ? 'CLUSTERS' : 'POINTS'}`}</span><button onClick={() => void loadMap()} title="Refresh observations">↻</button></div></div><div className="map-canvas"><FireMap points={markers} mode={view} onLocation={onMapLocation} selectedDate={selectedDate} />{loadingMap && <div className="map-loading"><SignalLoader label="Syncing satellite signals…" /></div>}</div><div className="map-footer"><div><span>●</span> {view === 'harmonized' ? 'Nearby detections combined within 750 m' : `Raw ${view.toUpperCase()} observations`}</div><div>Click map to explore a nearby area <span className="footer-chevron">↗</span></div></div></div>
      <div className="metrics-row"><div className="metric-card"><span className="metric-icon orange">◉</span><div><span className="metric-label">MODIS DETECTIONS</span><strong>{hotspots?.totals.modis ?? '—'}</strong></div><small>1 km resolution</small></div><div className="metric-card"><span className="metric-icon mint">✣</span><div><span className="metric-label">VIIRS DETECTIONS</span><strong>{hotspots?.totals.viirs ?? '—'}</strong></div><small>375 m resolution</small></div><div className="metric-card"><span className="metric-icon violet">◎</span><div><span className="metric-label">HARMONIZED CLUSTERS</span><strong>{hotspots?.totals.harmonized ?? '—'}</strong></div><small>Deduplicated signals</small></div><div className="metric-card overlap-card"><span className="overlap-number">{hotspots?.totals.modis && hotspots?.totals.viirs ? Math.round((1 - (hotspots.totals.harmonized / (hotspots.totals.modis + hotspots.totals.viirs))) * 100) : 0}%</span><div><span className="metric-label">OVERLAP REDUCED</span><small>Combined detections<br />are not unique fires</small></div></div></div>
    </section>
    <section className="insights-grid" id="activity"><ActivityCalendar year={calendarCursor.year} month={calendarCursor.month} days={calendar?.days ?? []} selectedDate={selectedDate} loading={loadingCalendar} onSelect={chooseDate} onMonth={(year, month) => setCalendarCursor({ year, month })} />
      <div className="card selected-card"><p className="eyebrow">SELECTED DAY</p><h2>{new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</h2>{loadingUnusual ? <SignalLoader label="Checking fire activity against its historical baseline…" /> : panelErrors.unusual ? <ErrorLine message={panelErrors.unusual} /> : unusual?.unusual ? <div className="unusual-badge"><span>!</span><div><b>Unusual fire activity detected</b><small>{unusual.explanation}</small></div></div> : <div className="normal-status"><span>✓</span><div><b>{unusual?.count ?? 0} observations in selected area</b><small>{unusual?.explanation ?? 'Checking historical activity…'}</small></div></div>}<div className="day-detail"><div><span>DATE</span><b>{selectedDate}</b></div><div><span>BASELINE DAYS</span><b>{unusual?.baseline.sampleDays ?? '—'}</b></div><div><span>ACTIVITY LEVEL</span><b className={`level-text ${calendar?.days.find(day => day.date === selectedDate)?.activity ?? 'low'}`}>{calendar?.days.find(day => day.date === selectedDate)?.activity ?? '—'}</b></div></div><p className="fine-print">Activity flags compare cached observations for this area and time of year. Sparse satellite coverage can limit confidence.</p></div>
    </section>
    <section id="history" className="history-section"><HistoricalChart data={historical} periods={critical} /><div className="history-note"><span>↗</span><div><b>Reading the record</b><p>Past activity is a lens, not a forecast. Historical coverage depends on source availability and what has been cached for this area.</p></div></div><ErrorLine message={panelErrors.historical ?? panelErrors.critical ?? panelErrors.calendar} /></section>
    <footer className="footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><span /></span><span>Fire<span className="brand-light">-Dna</span><small>FIRE ACTIVITY EXPLORER</small></span></a><span>MODIS + VIIRS · NASA FIRMS <span className="footer-separator">/</span> Built for a more connected view of our planet</span><a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">DATA SOURCE ↗</a></footer>
  </main></MotionConfig>;
}
