import type {
  AirQualityReport,
  GeoLocation,
  GroundStationSummary,
  HourlyPoint,
  SensitivityProfile,
} from '../src/shared/airTypes.ts';
import {
  buildProfileGuidance,
  classifyUsAqi,
  findBestWindow,
  findDominantPollutant,
} from '../src/shared/riskEngine.ts';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const OPENAQ_LOCATIONS_URL = 'https://api.openaq.org/v3/locations';
const CACHE_TTL_MS = 5 * 60 * 1000;
const HTTP_TIMEOUT_MS = 8000;

interface OpenMeteoRawResponse {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  current?: {
    time?: string;
    us_aqi?: number | null;
    pm10?: number | null;
    pm2_5?: number | null;
    nitrogen_dioxide?: number | null;
    ozone?: number | null;
    us_aqi_pm2_5?: number | null;
    us_aqi_pm10?: number | null;
    us_aqi_nitrogen_dioxide?: number | null;
    us_aqi_ozone?: number | null;
  };
  hourly?: {
    time?: string[];
    us_aqi?: (number | null)[];
    pm10?: (number | null)[];
    pm2_5?: (number | null)[];
    nitrogen_dioxide?: (number | null)[];
    ozone?: (number | null)[];
  };
}

const airCache = new Map<string, { timestamp: number; data: OpenMeteoRawResponse }>();
const geoCache = new Map<string, { timestamp: number; results: GeoLocation[] }>();

function roundCoord(val: number): string {
  return val.toFixed(2);
}

export async function searchCities(query: string, count = 5): Promise<GeoLocation[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const cacheKey = `${clean.toLowerCase()}:${count}`;
  const now = Date.now();
  const cached = geoCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set('name', clean);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Geocoding service responded with ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      name: string;
      country?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  };

  const results: GeoLocation[] = (payload.results ?? []).map((item) => ({
    name: item.name,
    country: item.country ?? null,
    admin1: item.admin1 ?? null,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone ?? null,
  }));

  geoCache.set(cacheKey, { timestamp: now, results });
  return results;
}

async function fetchOpenAqNearest(
  lat: number,
  lon: number,
): Promise<GroundStationSummary | null> {
  const openAqKey = process.env.OPENAQ_API_KEY?.trim();
  if (!openAqKey) return null;

  try {
    const url = new URL(OPENAQ_LOCATIONS_URL);
    url.searchParams.set('coordinates', `${lat},${lon}`);
    url.searchParams.set('radius', '15000');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      headers: { 'X-API-Key': openAqKey },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      results?: Array<{ name?: string; distance?: number }>;
    };
    const station = payload.results?.[0];
    if (!station) return null;

    return {
      station_name: station.name ?? 'Nearby Ground Sensor',
      distance_km:
        typeof station.distance === 'number'
          ? Math.round((station.distance / 1000) * 10) / 10
          : null,
      provider: 'OpenAQ v3',
    };
  } catch {
    return null;
  }
}

async function fetchRawOpenMeteo(
  lat: number,
  lon: number,
  bypassCache = false,
): Promise<{ data: OpenMeteoRawResponse; fromCache: boolean }> {
  const key = `${roundCoord(lat)},${roundCoord(lon)}`;
  const now = Date.now();
  const cached = airCache.get(key);

  if (!bypassCache && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { data: cached.data, fromCache: true };
  }

  const url = new URL(AIR_QUALITY_URL);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set(
    'current',
    [
      'us_aqi',
      'pm10',
      'pm2_5',
      'nitrogen_dioxide',
      'ozone',
      'us_aqi_pm2_5',
      'us_aqi_pm10',
      'us_aqi_nitrogen_dioxide',
      'us_aqi_ozone',
    ].join(','),
  );
  url.searchParams.set('hourly', 'us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone');

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo Air Quality responded with ${response.status}`);
    }
    const data = (await response.json()) as OpenMeteoRawResponse;
    airCache.set(key, { timestamp: now, data });
    return { data, fromCache: false };
  } catch (err) {
    if (cached) {
      return { data: cached.data, fromCache: true };
    }
    throw err;
  }
}

function sliceNext24Hours(
  hourlyRaw: OpenMeteoRawResponse['hourly'],
  currentTime: string,
): HourlyPoint[] {
  const times = hourlyRaw?.time ?? [];
  const aqis = hourlyRaw?.us_aqi ?? [];
  const pm25s = hourlyRaw?.pm2_5 ?? [];
  const pm10s = hourlyRaw?.pm10 ?? [];
  const no2s = hourlyRaw?.nitrogen_dioxide ?? [];
  const o3s = hourlyRaw?.ozone ?? [];

  if (!times.length) return [];

  const currentHourPrefix = currentTime.slice(0, 13);
  let startIdx = times.findIndex((t) => t.slice(0, 13) >= currentHourPrefix);
  if (startIdx < 0) startIdx = 0;

  const endIdx = Math.min(startIdx + 24, times.length);
  const points: HourlyPoint[] = [];

  for (let idx = startIdx; idx < endIdx; idx++) {
    const rawAqi = aqis[idx];
    const aqiInt = typeof rawAqi === 'number' ? Math.max(0, Math.round(rawAqi)) : 0;
    const { category } = classifyUsAqi(aqiInt);
    points.push({
      time: times[idx],
      us_aqi: aqiInt,
      category,
      pm2_5: pm25s[idx] ?? null,
      pm10: pm10s[idx] ?? null,
      nitrogen_dioxide: no2s[idx] ?? null,
      ozone: o3s[idx] ?? null,
    });
  }

  return points;
}

export async function getAirQualityReport(
  lat: number,
  lon: number,
  locationName: string,
  profile: SensitivityProfile,
  bypassCache = false,
): Promise<AirQualityReport> {
  const [{ data: raw, fromCache }, station] = await Promise.all([
    fetchRawOpenMeteo(lat, lon, bypassCache),
    fetchOpenAqNearest(lat, lon),
  ]);

  const current = raw.current ?? {};
  const currentTime = current.time ?? new Date().toISOString().slice(0, 16);
  const currentAqi = typeof current.us_aqi === 'number' ? Math.max(0, Math.round(current.us_aqi)) : 0;
  const { category, tier } = classifyUsAqi(currentAqi);

  const dominant = findDominantPollutant({
    pm2_5: current.us_aqi_pm2_5,
    pm10: current.us_aqi_pm10,
    nitrogen_dioxide: current.us_aqi_nitrogen_dioxide,
    ozone: current.us_aqi_ozone,
  });

  const hourly24h = sliceNext24Hours(raw.hourly, currentTime);
  const { bestWindow, peakHour } = findBestWindow(hourly24h, 3);
  const guidance = buildProfileGuidance(currentAqi, dominant, profile);

  return {
    location_name: locationName,
    latitude: raw.latitude ?? lat,
    longitude: raw.longitude ?? lon,
    timezone: raw.timezone ?? 'UTC',
    observed_at: currentTime,
    us_aqi: currentAqi,
    category,
    severity_tier: tier,
    dominant_pollutant: dominant,
    pollutants: {
      pm2_5: current.pm2_5 ?? null,
      pm10: current.pm10 ?? null,
      nitrogen_dioxide: current.nitrogen_dioxide ?? null,
      ozone: current.ozone ?? null,
    },
    guidance,
    best_window_24h: bestWindow,
    peak_hour_24h: peakHour,
    hourly_24h: hourly24h,
    data_source: station
      ? 'Open-Meteo Air Quality (CAMS Modeled) + OpenAQ v3 Metadata'
      : 'Open-Meteo Air Quality (CAMS Modeled)',
    ground_station: station,
    from_cache: fromCache,
  };
}
