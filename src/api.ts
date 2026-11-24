import type {
  AirQualityReport,
  AssistantResponse,
  GeoLocation,
  SensitivityProfile,
} from './shared/airTypes.ts';

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export async function searchCities(query: string): Promise<GeoLocation[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to search cities.'));
  }
  return res.json() as Promise<GeoLocation[]>;
}

export async function fetchAirQuality(
  lat: number,
  lon: number,
  name: string,
  profile: SensitivityProfile,
  refresh = false,
): Promise<AirQualityReport> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    name,
    profile,
  });
  if (refresh) {
    params.set('refresh', '1');
  }
  const res = await fetch(`/api/air-quality?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to load air quality data.'));
  }
  return res.json() as Promise<AirQualityReport>;
}

export async function askAssistant(payload: {
  latitude: number;
  longitude: number;
  location_name: string;
  profile: SensitivityProfile;
  question: string;
}): Promise<AssistantResponse> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Assistant request failed.'));
  }
  return res.json() as Promise<AssistantResponse>;
}
