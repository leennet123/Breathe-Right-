import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { SensitivityProfile } from './src/shared/airTypes.ts';
import { generateGroundedAdvice } from './server/advisorService.ts';
import { getAirQualityReport, searchCities } from './server/airService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '64kb' }));

const ProfileSchema = z.enum([
  'general',
  'outdoor_athlete',
  'asthma_respiratory',
  'child_older_adult',
]);

const GeocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
});

const AirQualityQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  name: z.string().trim().min(1).max(120).default('Selected Location'),
  profile: ProfileSchema.default('general'),
  refresh: z.enum(['0', '1', 'true', 'false']).optional(),
});

const AssistantBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location_name: z.string().trim().min(1).max(120).default('Selected Location'),
  profile: ProfileSchema.default('general'),
  question: z.string().trim().min(3).max(500),
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/geocode', async (req, res) => {
  const parsed = GeocodeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid city search query (min 2 characters).' });
    return;
  }
  try {
    const matches = await searchCities(parsed.data.q);
    res.json(matches);
  } catch {
    res.status(502).json({ error: 'Geocoding service is temporarily unavailable.' });
  }
});

app.get('/api/air-quality', async (req, res) => {
  const parsed = AirQualityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid coordinates or sensitivity profile.' });
    return;
  }
  const { lat, lon, name, profile, refresh } = parsed.data;
  const bypassCache = refresh === '1' || refresh === 'true';

  try {
    const report = await getAirQualityReport(
      lat,
      lon,
      name,
      profile as SensitivityProfile,
      bypassCache,
    );
    res.json(report);
  } catch {
    res.status(502).json({ error: 'Air quality data feed is temporarily unavailable.' });
  }
});

app.get('/api/commute-window', async (req, res) => {
  const parsed = AirQualityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid coordinates or sensitivity profile.' });
    return;
  }
  const { lat, lon, name, profile } = parsed.data;

  try {
    const report = await getAirQualityReport(lat, lon, name, profile as SensitivityProfile);
    res.json({
      location_name: report.location_name,
      observed_at: report.observed_at,
      best_window_24h: report.best_window_24h,
      peak_hour_24h: report.peak_hour_24h,
      guidance: report.guidance,
    });
  } catch {
    res.status(502).json({ error: 'Air quality data feed is temporarily unavailable.' });
  }
});

app.post('/api/assistant', async (req, res) => {
  const parsed = AssistantBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please provide a valid question (3–500 characters) and location.' });
    return;
  }

  const { latitude, longitude, location_name, profile, question } = parsed.data;
  try {
    const report = await getAirQualityReport(
      latitude,
      longitude,
      location_name,
      profile as SensitivityProfile,
    );
    const advice = await generateGroundedAdvice(report, question);
    res.json(advice);
  } catch {
    res.status(502).json({ error: 'Unable to load live air metrics for the assistant.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BreatheRight Urban running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
