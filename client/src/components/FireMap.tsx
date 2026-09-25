import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { Cluster, Detection } from '../api/client';
function MapResize() {
  const map = useMap();
  useEffect(() => {
    const resize = () => map.invalidateSize({ pan: false });
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    window.addEventListener('resize', resize);
    resize();
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, [map]);
  return null;
}
function MapClick({ onLocation }: { onLocation: (latitude: number, longitude: number) => void }) { useMapEvents({ click(event) { onLocation(event.latlng.lat, event.latlng.lng); } }); return null; }
export default function FireMap({ points, mode, onLocation, selectedDate }: { points: (Detection | Cluster)[]; mode: string; onLocation: (latitude: number, longitude: number) => void; selectedDate: string }) {
  const center = useMemo<[number, number]>(() => points.length ? [points[0]!.latitude, points[0]!.longitude] : [38.5, -120.4], [points]);
  return <MapContainer center={center} zoom={points.length ? 5 : 4} scrollWheelZoom className="fire-map">
    <MapResize />
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <MapClick onLocation={onLocation} />
    {points.map((point, index) => {
      const confidence = point.confidence ?? 0, color = confidence >= 80 ? '#ff705f' : confidence >= 50 ? '#f3c46b' : '#55d8d0';
      const count = 'detectionCount' in point ? point.detectionCount : 1;
      return <CircleMarker key={point.id ?? index} center={[point.latitude, point.longitude]} radius={Math.min(5 + count, 12)} pathOptions={{ color, fillColor: color, fillOpacity: 0.78, weight: 1.5 }}>
        <Tooltip direction="top" offset={[0, -5]}>
          <strong>{'sources' in point ? `${point.sources.join(' + ')} harmonized` : `${point.sensor} detection`}</strong><br />
          {'date' in point ? point.date : point.acqDate} · {'startTime' in point ? point.startTime : point.acqTime}<br />
          Confidence: {point.confidence ?? '—'} · FRP: {point.frp ?? '—'} MW
          {'detectionCount' in point && <><br />{point.detectionCount} detections combined</>}
        </Tooltip>
      </CircleMarker>;
    })}
    <div className="map-attribution"><span className="map-dot" /> {mode === 'harmonized' ? 'Harmonized cluster' : `${mode.toUpperCase()} detection`} · {selectedDate}</div>
  </MapContainer>;
}
