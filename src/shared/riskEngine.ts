import type {
  HourlyPoint,
  PeakExposure,
  ProfileGuidance,
  SafeWindow,
  SensitivityProfile,
} from './airTypes.ts';

const AQI_TIERS: readonly [number, string, number][] = [
  [50, 'Good', 1],
  [100, 'Moderate', 2],
  [150, 'Unhealthy for Sensitive Groups', 3],
  [200, 'Unhealthy', 4],
  [300, 'Very Unhealthy', 5],
  [500, 'Hazardous', 6],
];

const POLLUTANT_LABELS: Record<string, string> = {
  pm2_5: 'PM2.5 (Fine Particulates)',
  pm10: 'PM10 (Coarse Dust)',
  nitrogen_dioxide: 'NO2 (Traffic Exhaust)',
  ozone: 'O3 (Ground-Level Ozone)',
};

export function classifyUsAqi(aqi: number): { category: string; tier: number } {
  const clamped = Math.max(0, Math.round(aqi));
  for (const [upper, label, tier] of AQI_TIERS) {
    if (clamped <= upper) {
      return { category: label, tier };
    }
  }
  return { category: 'Hazardous', tier: 6 };
}

export function findDominantPollutant(
  subIndices: Record<string, number | null | undefined>,
): string {
  let topKey = 'pm2_5';
  let topValue = -1;

  for (const [key, value] of Object.entries(subIndices)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > topValue) {
      topValue = value;
      topKey = key;
    }
  }

  return POLLUTANT_LABELS[topKey] ?? topKey.toUpperCase();
}

export function buildProfileGuidance(
  aqi: number,
  dominantPollutant: string,
  profile: SensitivityProfile,
): ProfileGuidance {
  const { category, tier } = classifyUsAqi(aqi);

  if (profile === 'asthma_respiratory') {
    if (tier <= 1) {
      return {
        profile,
        risk_level: 'Low',
        headline: 'Air is clean for regular outdoor routines.',
        actions: [
          'Normal outdoor activity is safe; keep your rescue inhaler accessible as usual.',
          'Open windows for cross-ventilation if local pollen or dust triggers are absent.',
        ],
      };
    }
    if (tier === 2) {
      return {
        profile,
        risk_level: 'Elevated Caution',
        headline: `Moderate air (${aqi} US AQI); watch for airway irritation from ${dominantPollutant}.`,
        actions: [
          'Prefer lower-intensity outdoor walks over sustained high-exertion sprints.',
          'Route away from congested arterial roads where NO2 and fine particulates spike.',
          'Keep rescue medication on hand and shift indoors if coughing or chest tightness starts.',
        ],
      };
    }
    return {
      profile,
      risk_level: tier >= 4 ? 'High' : 'Moderate-High',
      headline: `${category} (${aqi} US AQI) elevates respiratory irritation risk.`,
      actions: [
        'Move exercise indoors and keep street-facing windows closed.',
        'Run a HEPA air purifier on medium or high if available.',
        'Wear a well-fitting N95/KN95 respirator for essential outdoor errands.',
      ],
    };
  }

  if (profile === 'outdoor_athlete') {
    if (tier <= 1) {
      return {
        profile,
        risk_level: 'Low',
        headline: 'Optimal conditions for high-output outdoor training.',
        actions: [
          'Clear for tempo runs, intervals, or long cycling sessions.',
          'Favor parks, trails, or waterfront paths over roadside lanes for lowest micro-exposure.',
        ],
      };
    }
    if (tier === 2) {
      return {
        profile,
        risk_level: 'Moderate',
        headline: `Moderate air (${aqi} US AQI); elevated breathing volume increases pollutant uptake.`,
        actions: [
          'Schedule hard intervals inside the lowest-AQI 3-hour forecast window.',
          'Avoid peak rush-hour traffic corridors during warm-ups and cooldowns.',
          'Shorten sessions over 60 minutes if throat irritation or fatigue appears early.',
        ],
      };
    }
    return {
      profile,
      risk_level: 'High',
      headline: `Avoid high-exertion outdoor training at ${aqi} US AQI (${category}).`,
      actions: [
        'Swap outdoor runs or rides for an indoor treadmill, stationary trainer, or gym session.',
        'If heading outside, keep pace to light walking and wait for cleaner forecast hours.',
      ],
    };
  }

  if (profile === 'child_older_adult') {
    if (tier <= 1) {
      return {
        profile,
        risk_level: 'Low',
        headline: 'Safe for outdoor play, school commutes, and walks.',
        actions: [
          'Regular outdoor play and neighborhood walks are safe.',
          'Favorable conditions to air out living spaces naturally.',
        ],
      };
    }
    if (tier === 2) {
      return {
        profile,
        risk_level: 'Watch',
        headline: `Moderate air (${aqi} US AQI); limit prolonged heavy exertion outdoors.`,
        actions: [
          'Time park visits and outdoor walks around the lowest-AQI 3-hour window.',
          'Take indoor breaks during midday ozone or evening traffic peaks.',
        ],
      };
    }
    return {
      profile,
      risk_level: 'High',
      headline: `${category} (${aqi} US AQI): minimize sustained outdoor exposure.`,
      actions: [
        'Keep outdoor trips brief and low-effort; move active play and walks indoors.',
        'Close street-facing windows and use recirculated or filtered indoor air.',
        'Use a snug N95/KF94 mask if outdoor travel cannot be deferred.',
      ],
    };
  }

  // General Public
  if (tier <= 1) {
    return {
      profile,
      risk_level: 'Low',
      headline: 'Good air quality for outdoor plans and commuting.',
      actions: [
        'No restrictions on outdoor exercise, walking, or cycling.',
        'Ideal conditions to open windows for natural indoor ventilation.',
      ],
    };
  }
  if (tier === 2) {
    return {
      profile,
      risk_level: 'Low-Moderate',
      headline: `Acceptable air (${aqi} US AQI), led by ${dominantPollutant}.`,
      actions: [
        'Most people can proceed normally; unusually sensitive individuals should pace exertion.',
        'Prefer side streets or greenways over congested roads during rush hours.',
      ],
    };
  }
  if (tier === 3) {
    return {
      profile,
      risk_level: 'Moderate-High',
      headline: `Unhealthy for sensitive groups (${aqi} US AQI).`,
      actions: [
        'Reduce prolonged or intense outdoor workouts and target the cleaner 3-hour window.',
        'Close windows if outdoor smoke, dust, or traffic odor becomes noticeable.',
      ],
    };
  }
  return {
    profile,
    risk_level: 'High',
    headline: `${category} (${aqi} US AQI): everyone may experience effects.`,
    actions: [
      'Avoid strenuous outdoor activity and keep errands brief.',
      'Keep windows shut, filter indoor air, and wear an N95/KN95 outdoors.',
    ],
  };
}

export function findBestWindow(
  hourly: HourlyPoint[],
  windowHours = 3,
): { bestWindow: SafeWindow | null; peakHour: PeakExposure | null } {
  if (!hourly.length) {
    return { bestWindow: null, peakHour: null };
  }

  let peakPoint = hourly[0];
  for (const pt of hourly) {
    if (pt.us_aqi > peakPoint.us_aqi) {
      peakPoint = pt;
    }
  }
  const peakHour: PeakExposure = {
    time: peakPoint.time,
    us_aqi: peakPoint.us_aqi,
    category: peakPoint.category,
  };

  const span = Math.min(windowHours, hourly.length);
  let bestSlice = hourly.slice(0, span);
  let bestAvg = bestSlice.reduce((sum, p) => sum + p.us_aqi, 0) / span;

  for (let idx = 1; idx <= hourly.length - span; idx++) {
    const candidate = hourly.slice(idx, idx + span);
    const avg = candidate.reduce((sum, p) => sum + p.us_aqi, 0) / span;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestSlice = candidate;
    }
  }

  const avgRounded = Math.round(bestAvg);
  const maxAqi = Math.max(...bestSlice.map((p) => p.us_aqi));
  const { category } = classifyUsAqi(avgRounded);

  const startHHMM = bestSlice[0].time.slice(11, 16);
  const endHHMM = bestSlice[bestSlice.length - 1].time.slice(11, 16);

  const bestWindow: SafeWindow = {
    start_time: bestSlice[0].time,
    end_time: bestSlice[bestSlice.length - 1].time,
    avg_aqi: avgRounded,
    max_aqi: maxAqi,
    category,
    summary: `Lowest exposure block is ${startHHMM}–${endHHMM} local time (avg ${avgRounded} AQI, peak ${maxAqi} AQI · ${category}).`,
  };

  return { bestWindow, peakHour };
}
