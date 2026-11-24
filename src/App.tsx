import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fetchAirQuality, searchCities } from './api.ts';
import { AqiBadge } from './components/AqiBadge.tsx';
import { AssistantPanel } from './components/AssistantPanel.tsx';
import { HourlyChart } from './components/HourlyChart.tsx';
import {
  PRESET_CITIES,
  PROFILE_OPTIONS,
  type AirQualityReport,
  type GeoLocation,
  type SensitivityProfile,
} from './shared/airTypes.ts';

function getRiskVisual(riskLevel: string) {
  const lower = riskLevel.toLowerCase();
  if (lower.includes('high')) {
    return {
      className: 'text-red-800',
      Icon: ShieldAlert,
    };
  }
  if (lower.includes('caution') || lower.includes('moderate') || lower.includes('watch')) {
    return {
      className: 'text-amber-800',
      Icon: AlertTriangle,
    };
  }
  if (lower === 'low') {
    return {
      className: 'text-emerald-800',
      Icon: CheckCircle2,
    };
  }
  return {
    className: 'text-slate-800',
    Icon: CircleDot,
  };
}

function parseCoordinateInput(raw: string): GeoLocation | null {
  const match = raw
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number.parseFloat(match[1]);
  const lon = Number.parseFloat(match[2]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }
  return {
    name: `Custom Coordinates (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
    latitude: lat,
    longitude: lon,
  };
}

export default function App() {
  const [selectedCity, setSelectedCity] = useState<GeoLocation>(PRESET_CITIES[0]);
  const [profile, setProfile] = useState<SensitivityProfile>('general');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<GeoLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [report, setReport] = useState<AirQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState('');

  const loadAirQuality = useCallback(
    async (city: GeoLocation, activeProfile: SensitivityProfile, forceRefresh = false) => {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await fetchAirQuality(
          city.latitude,
          city.longitude,
          city.name,
          activeProfile,
          forceRefresh,
        );
        setReport(data);
        setLiveStatus(
          `Updated air quality for ${data.location_name}: ${data.us_aqi} US AQI, ${data.category}.`,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load air quality data. Please retry.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadAirQuality(selectedCity, profile, false);
  }, [selectedCity, profile, loadAirQuality]);

  async function handleCitySearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed.length < 2) return;

    // Direct lat, lon coordinate input support
    const coords = parseCoordinateInput(trimmed);
    if (coords) {
      setSelectedCity(coords);
      setSearchResults([]);
      setError(null);
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const matches = await searchCities(trimmed);
      setSearchResults(matches);
      if (matches.length === 1) {
        const match = matches[0];
        const label = [match.name, match.admin1, match.country]
          .filter(Boolean)
          .join(', ');
        setSelectedCity({ ...match, name: label });
        setSearchResults([]);
      } else if (matches.length === 0) {
        setLiveStatus(`No cities found matching ${trimmed}.`);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'City search is temporarily unavailable.',
      );
    } finally {
      setSearching(false);
    }
  }

  const riskVisual = report ? getRiskVisual(report.guidance.risk_level) : null;
  const RiskIcon = riskVisual?.Icon ?? CheckCircle2;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded-sm"
          >
            BreatheRight Urban
          </a>

          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#snapshot"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Snapshot
            </a>
            <a
              href="#guidance"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Guidance
            </a>
            <a
              href="#forecast"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              24h Forecast
            </a>
            <a
              href="#assistant"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Assistant
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              disabled={loading || refreshing}
              onClick={() => void loadAirQuality(selectedCity, profile, true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{refreshing ? 'Refreshing' : 'Refresh Data'}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        {/* Location & Profile Controls */}
        <section
          aria-label="Location and sensitivity profile controls"
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-6 space-y-2">
              <label
                htmlFor="city-search"
                className="block text-xs font-semibold text-slate-600"
              >
                City or Coordinates (lat, lon)
              </label>
              <form onSubmit={handleCitySearch} className="flex gap-2">
                <input
                  id="city-search"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search city (e.g. Pune, Tokyo) or 12.97, 77.59"
                  className="flex-1 min-w-0 px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                />
                <button
                  type="submit"
                  disabled={searching || searchInput.trim().length < 2}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{searching ? 'Searching' : 'Search'}</span>
                </button>
              </form>
            </div>

            <div className="lg:col-span-6 space-y-2">
              <span
                id="profile-group-label"
                className="block text-xs font-semibold text-slate-600"
              >
                Sensitivity Profile
              </span>
              <div
                role="group"
                aria-labelledby="profile-group-label"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg"
              >
                {PROFILE_OPTIONS.map((opt) => {
                  const active = profile === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setProfile(opt.value)}
                      className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {searchResults.length > 0 && (
            <ul
              aria-label="Matching cities"
              className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden"
            >
              {searchResults.map((city, idx) => {
                const label = [city.name, city.admin1, city.country]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <li key={`${city.latitude}-${city.longitude}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCity({ ...city, name: label });
                        setSearchResults([]);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm bg-white hover:bg-slate-50 flex items-center justify-between gap-4 cursor-pointer"
                    >
                      <span className="font-medium text-slate-900">{label}</span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                        {city.latitude.toFixed(2)}, {city.longitude.toFixed(2)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1">
              Urban hubs:
            </span>
            {PRESET_CITIES.map((city) => {
              const active = selectedCity.name === city.name;
              return (
                <button
                  key={city.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedCity(city);
                    setSearchResults([]);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {city.name}
                </button>
              );
            })}
          </div>
        </section>

        <div className="sr-only" aria-live="polite">
          {liveStatus}
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-900 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
          >
            <span className="text-sm font-medium">{error}</span>
            <button
              type="button"
              onClick={() => void loadAirQuality(selectedCity, profile, true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-red-900 bg-white border border-red-300 rounded-md hover:bg-red-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !report && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 h-72 animate-pulse" />
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 h-72 animate-pulse" />
          </div>
        )}

        {report && (
          <>
            {/* Primary Snapshot + Guidance Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <article
                id="snapshot"
                className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                      {report.location_name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                      <span>
                        {report.latitude.toFixed(2)}°, {report.longitude.toFixed(2)}°
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{report.timezone}</span>
                      <span aria-hidden="true">·</span>
                      <span>Observed {report.observed_at.replace('T', ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-700 pt-2">
                      <span className="text-slate-500">Dominant pollutant: </span>
                      <strong className="font-semibold text-slate-900">
                        {report.dominant_pollutant}
                      </strong>
                    </p>
                  </div>

                  <AqiBadge
                    aqi={report.us_aqi}
                    category={report.category}
                    tier={report.severity_tier}
                  />
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-slate-200 pt-5 gap-6">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">PM2.5</dt>
                    <dd className="mt-1 font-mono tabular-nums">
                      <span className="text-xl font-semibold text-slate-900">
                        {report.pollutants.pm2_5 !== null
                          ? report.pollutants.pm2_5.toFixed(1)
                          : '—'}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">µg/m³</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">PM10</dt>
                    <dd className="mt-1 font-mono tabular-nums">
                      <span className="text-xl font-semibold text-slate-900">
                        {report.pollutants.pm10 !== null
                          ? report.pollutants.pm10.toFixed(1)
                          : '—'}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">µg/m³</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">NO₂</dt>
                    <dd className="mt-1 font-mono tabular-nums">
                      <span className="text-xl font-semibold text-slate-900">
                        {report.pollutants.nitrogen_dioxide !== null
                          ? report.pollutants.nitrogen_dioxide.toFixed(1)
                          : '—'}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">µg/m³</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">O₃</dt>
                    <dd className="mt-1 font-mono tabular-nums">
                      <span className="text-xl font-semibold text-slate-900">
                        {report.pollutants.ozone !== null
                          ? report.pollutants.ozone.toFixed(1)
                          : '—'}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">µg/m³</span>
                    </dd>
                  </div>
                </dl>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span>Source: {report.data_source}</span>
                  {report.ground_station && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Nearest station: {report.ground_station.station_name}
                        {report.ground_station.distance_km !== null
                          ? ` (${report.ground_station.distance_km} km)`
                          : ''}
                      </span>
                    </>
                  )}
                  {report.from_cache && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Cached (5m TTL)</span>
                    </>
                  )}
                </div>
              </article>

              <article
                id="guidance"
                className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Profile Health Guidance
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${riskVisual?.className}`}
                    >
                      <RiskIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{report.guidance.risk_level} Risk</span>
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    {report.guidance.headline}
                  </p>

                  <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
                    {report.guidance.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-2.5">
                  {report.best_window_24h && (
                    <div>
                      <div className="text-xs font-semibold text-emerald-800">
                        24-Hour Best Outdoor Window
                      </div>
                      <p className="text-sm text-slate-800 mt-0.5 font-mono tabular-nums">
                        {report.best_window_24h.summary}
                      </p>
                    </div>
                  )}

                  {report.peak_hour_24h && (
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      Peak forecast hour: {report.peak_hour_24h.time.slice(11, 16)} (
                      {report.peak_hour_24h.us_aqi} US AQI · {report.peak_hour_24h.category})
                    </div>
                  )}
                </div>
              </article>
            </div>

            {/* 24-Hour Safe Window & Exposure Forecast */}
            <section
              id="forecast"
              className="bg-white border border-slate-200 rounded-xl p-6"
              aria-labelledby="forecast-heading"
            >
              <div className="mb-4">
                <h2 id="forecast-heading" className="text-lg font-semibold text-slate-900">
                  Next 24 Hours Exposure Forecast
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Local-time hourly US EPA AQI trajectory from current hour through +24h.
                </p>
              </div>
              <HourlyChart
                hourly={report.hourly_24h}
                bestWindow={report.best_window_24h}
              />
            </section>

            {/* Grounded AI Air Assistant */}
            <AssistantPanel report={report} profile={profile} />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            BreatheRight Urban · Deterministic US EPA AQI risk engine &amp; grounded outdoor planner
          </span>
          <span>
            Informational guidance based on modeled air quality forecasts; not medical advice.
          </span>
        </div>
      </footer>
    </div>
  );
}
