import { useState } from 'react';
import type { HourlyPoint, SafeWindow } from '../shared/airTypes.ts';

interface HourlyChartProps {
  hourly: HourlyPoint[];
  bestWindow: SafeWindow | null;
}

function getBarColor(aqi: number): string {
  if (aqi <= 50) return '#059669';
  if (aqi <= 100) return '#d97706';
  if (aqi <= 150) return '#ea580c';
  if (aqi <= 200) return '#dc2626';
  if (aqi <= 300) return '#7e22ce';
  return '#881337';
}

export function HourlyChart({ hourly, bestWindow }: HourlyChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!hourly.length) {
    return (
      <p className="text-sm text-slate-500 py-6">
        Hourly forecast data is currently unavailable for this location.
      </p>
    );
  }

  const maxAqi = Math.max(120, ...hourly.map((h) => h.us_aqi));
  const chartHeight = 160;
  const baselineY = 182;
  const slotWidth = 720 / hourly.length;

  const activePoint = activeIndex !== null ? hourly[activeIndex] ?? null : null;

  const yForValue = (val: number) => {
    const clamped = Math.min(maxAqi, Math.max(0, val));
    return baselineY - (clamped / maxAqi) * chartHeight;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs font-mono tabular-nums text-slate-600 min-h-[1.25rem]">
          {activePoint ? (
            <span>
              <strong className="text-slate-900">{activePoint.time.slice(11, 16)}</strong>
              {' · '}
              <strong className="text-slate-900">{activePoint.us_aqi} US AQI</strong>
              {` (${activePoint.category})`}
              {activePoint.pm2_5 !== null ? ` · PM2.5 ${activePoint.pm2_5.toFixed(1)} µg/m³` : ''}
              {activePoint.ozone !== null ? ` · O₃ ${activePoint.ozone.toFixed(1)} µg/m³` : ''}
            </span>
          ) : bestWindow ? (
            <span>
              Shaded green band marks the lowest-exposure 3h block:{' '}
              <strong className="text-slate-900">
                {bestWindow.start_time.slice(11, 16)}–{bestWindow.end_time.slice(11, 16)}
              </strong>{' '}
              (avg {bestWindow.avg_aqi} AQI)
            </span>
          ) : (
            <span>Hover or focus any hourly bar to inspect concentrations.</span>
          )}
        </div>

        <div
          className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0"
          role="group"
          aria-label="Forecast display mode"
        >
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            aria-pressed={viewMode === 'chart'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'chart'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hourly Table
          </button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox="0 0 760 212"
            className="w-full min-w-[540px] h-auto block select-none"
            role="img"
            aria-label="24-hour US AQI forecast bar chart with lowest-exposure window highlighted"
          >
            {/* Reference threshold lines */}
            {[50, 100, 150].map((threshold) => {
              if (threshold > maxAqi) return null;
              const y = yForValue(threshold);
              return (
                <g key={threshold}>
                  <line
                    x1="34"
                    x2="754"
                    y1={y}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x="28"
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fill="#64748b"
                  >
                    {threshold}
                  </text>
                </g>
              );
            })}

            <line x1="34" x2="754" y1={baselineY} y2={baselineY} stroke="#cbd5e1" strokeWidth="1" />

            {hourly.map((pt, idx) => {
              const xBase = 36 + idx * slotWidth;
              const barW = Math.max(8, slotWidth - 6);
              const barX = xBase + 3;
              const barH = Math.max(6, (pt.us_aqi / maxAqi) * chartHeight);
              const barY = baselineY - barH;

              const inSafeWindow =
                bestWindow !== null &&
                pt.time >= bestWindow.start_time &&
                pt.time <= bestWindow.end_time;
              const isSelected = activeIndex === idx;

              return (
                <g
                  key={pt.time}
                  tabIndex={0}
                  role="button"
                  aria-label={`${pt.time.slice(11, 16)}: ${pt.us_aqi} US AQI, ${pt.category}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(idx)}
                  onBlur={() => setActiveIndex(null)}
                  className="cursor-pointer outline-none"
                >
                  {inSafeWindow && (
                    <rect
                      x={xBase}
                      y={16}
                      width={slotWidth}
                      height={baselineY - 16}
                      fill="#ecfdf5"
                    />
                  )}
                  <rect
                    x={barX}
                    y={barY}
                    width={barW}
                    height={barH}
                    rx="3"
                    fill={getBarColor(pt.us_aqi)}
                    opacity={activeIndex !== null && !isSelected ? 0.45 : 1}
                  />
                  {idx % 3 === 0 && (
                    <text
                      x={barX + barW / 2}
                      y={200}
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      fill="#475569"
                    >
                      {pt.time.slice(11, 16)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-2.5 px-3">Local Time</th>
                <th className="py-2.5 px-3 text-right">US AQI</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">PM2.5 (µg/m³)</th>
                <th className="py-2.5 px-3 text-right">O₃ (µg/m³)</th>
                <th className="py-2.5 px-3">Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hourly.map((pt) => {
                const inSafeWindow =
                  bestWindow !== null &&
                  pt.time >= bestWindow.start_time &&
                  pt.time <= bestWindow.end_time;
                return (
                  <tr
                    key={pt.time}
                    className={inSafeWindow ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}
                  >
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-900">
                      {pt.time.slice(11, 16)}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-right font-semibold text-slate-900">
                      {pt.us_aqi}
                    </td>
                    <td className="py-2 px-3 text-slate-700">{pt.category}</td>
                    <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-700">
                      {pt.pm2_5 !== null ? pt.pm2_5.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-700">
                      {pt.ozone !== null ? pt.ozone.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-3 text-xs font-medium text-emerald-800">
                      {inSafeWindow ? 'Best 3h window' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
