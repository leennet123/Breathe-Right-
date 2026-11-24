export type SensitivityProfile =
  | 'general'
  | 'outdoor_athlete'
  | 'asthma_respiratory'
  | 'child_older_adult';

export interface GeoLocation {
  name: string;
  country?: string | null;
  admin1?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string | null;
}

export interface PollutantSnapshot {
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
}

export interface HourlyPoint {
  time: string;
  us_aqi: number;
  category: string;
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
}

export interface SafeWindow {
  start_time: string;
  end_time: string;
  avg_aqi: number;
  max_aqi: number;
  category: string;
  summary: string;
}

export interface PeakExposure {
  time: string;
  us_aqi: number;
  category: string;
}

export interface ProfileGuidance {
  profile: SensitivityProfile;
  risk_level: string;
  headline: string;
  actions: string[];
}

export interface GroundStationSummary {
  station_name: string;
  distance_km: number | null;
  provider: string;
}

export interface AirQualityReport {
  location_name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  observed_at: string;
  us_aqi: number;
  category: string;
  severity_tier: number;
  dominant_pollutant: string;
  pollutants: PollutantSnapshot;
  guidance: ProfileGuidance;
  best_window_24h: SafeWindow | null;
  peak_hour_24h: PeakExposure | null;
  hourly_24h: HourlyPoint[];
  data_source: string;
  ground_station: GroundStationSummary | null;
  from_cache: boolean;
}

export interface AssistantResponse {
  answer: string;
  recommended_actions: string[];
  cited_metrics: string[];
  mode: string;
  notice?: string | null;
  disclaimer: string;
}

export const PRESET_CITIES: GeoLocation[] = [
  { name: 'Bengaluru, India', country: 'India', latitude: 12.9716, longitude: 77.5946 },
  { name: 'New Delhi, India', country: 'India', latitude: 28.6139, longitude: 77.209 },
  { name: 'Mumbai, India', country: 'India', latitude: 19.076, longitude: 72.8777 },
  { name: 'London, UK', country: 'United Kingdom', latitude: 51.5072, longitude: -0.1276 },
  { name: 'New York, USA', country: 'United States', latitude: 40.7128, longitude: -74.006 },
  { name: 'Tokyo, Japan', country: 'Japan', latitude: 35.6762, longitude: 139.6503 },
];

export const PROFILE_OPTIONS: { value: SensitivityProfile; label: string; shortLabel: string }[] = [
  { value: 'general', label: 'General Public', shortLabel: 'General' },
  { value: 'outdoor_athlete', label: 'Outdoor Runner / Cyclist', shortLabel: 'Runner / Cyclist' },
  { value: 'asthma_respiratory', label: 'Asthma / Respiratory', shortLabel: 'Asthma / Resp.' },
  { value: 'child_older_adult', label: 'Child / Older Adult', shortLabel: 'Child / Senior' },
];
