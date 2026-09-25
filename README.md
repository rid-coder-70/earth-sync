# EARTH SYNC

A fire activity explorer that presents NASA FIRMS MODIS and VIIRS active-fire observations together, with a transparent harmonized view. This MVP organizes existing satellite observations; it does not predict fires.

## Run locally

1. Install Node.js 20 or newer.
2. From this directory, run `npm install`.
3. Copy `.env.example` to `.env` and set `FIRMS_MAP_KEY` using the free key from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/).
4. Run `npm run dev`, then open the Vite URL shown in the terminal (usually http://localhost:5173).
5. Verify with `npm test` and `npm run build`.

Without a key, the API serves clearly labeled synthetic demo observations so the full UI can be explored. Demo data is never represented as a live FIRMS result. The API key remains in the Express server and is not included in client responses.

## Features and caveats

- Request sources: `MODIS_NRT`, `MODIS_SP`, `VIIRS_SNPP_NRT`, `VIIRS_SNPP_SP`, `VIIRS_NOAA20_NRT`, and `VIIRS_NOAA21_NRT`.
- `/api/hotspots` accepts `bbox=west,south,east,north`, `start`, `end`, `sources`, and optional `dayRange` (1–5). Longer ranges are split into FIRMS-compliant chunks. Results are cached in SQLite by bbox/date/source.
- Harmonization uses a distance-based, same-day greedy clustering pass (750 m by default). A cluster can merge across a short time interval; clustering is intentionally an MVP approximation, not a physical fire perimeter.
- Calendar, historical, unusual, and critical-period endpoints aggregate observations stored by prior hotspot requests. With a key, data is populated on demand and historic coverage depends on the selected FIRMS source.
- NRT sources have a recent rolling window. For historical analysis select Standard Processing (`*_SP`) sources where available. FIRMS source availability differs; consult [data availability](https://firms.modaps.eosdis.nasa.gov/api/data_availability/) rather than assuming multi-year coverage.
- Calendar activity levels and unusual thresholds are named constants in `server/src/services/aggregate.ts`; an unusual day is compared with available same-month observations. Sparse coverage makes the result tentative.
- Bounding boxes can be adjusted by map clicks and the editable coordinate fields. The map is based on OpenStreetMap tiles.

## API

- `GET /api/health`
- `GET /api/hotspots?bbox=-125,24,-66,50&start=YYYY-MM-DD&end=YYYY-MM-DD&sources=MODIS_NRT,VIIRS_SNPP_NRT&view=all|modis|viirs|harmonized`
- `GET /api/calendar?area=west,south,east,north&year=2026&month=9`
- `GET /api/historical?area=west,south,east,north&years=2022,2023,2024,2025,2026`
- `GET /api/unusual?area=west,south,east,north&date=YYYY-MM-DD`
- `GET /api/critical-periods?area=west,south,east,north`

## Data handling

SQLite stores source observations locally and the raw CSV cache. No user accounts or personal data are collected. Treat FIRMS rate limits and source availability as external constraints; cached requests reduce repeat calls. This prototype deliberately keeps proxy and aggregation logic simple for the challenge MVP.
