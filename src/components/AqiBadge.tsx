import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ShieldAlert,
  XOctagon,
} from 'lucide-react';

interface AqiBadgeProps {
  aqi: number;
  category: string;
  tier: number;
}

const TIER_CONFIG: Record<
  number,
  {
    bgClass: string;
    textClass: string;
    borderClass: string;
    barClass: string;
    Icon: typeof CheckCircle2;
  }
> = {
  1: {
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-200',
    barClass: 'bg-emerald-600',
    Icon: CheckCircle2,
  },
  2: {
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-900',
    borderClass: 'border-amber-200',
    barClass: 'bg-amber-600',
    Icon: CircleDot,
  },
  3: {
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-900',
    borderClass: 'border-orange-200',
    barClass: 'bg-orange-600',
    Icon: AlertTriangle,
  },
  4: {
    bgClass: 'bg-red-50',
    textClass: 'text-red-900',
    borderClass: 'border-red-200',
    barClass: 'bg-red-600',
    Icon: ShieldAlert,
  },
  5: {
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-900',
    borderClass: 'border-purple-200',
    barClass: 'bg-purple-700',
    Icon: AlertOctagon,
  },
  6: {
    bgClass: 'bg-rose-950',
    textClass: 'text-rose-50',
    borderClass: 'border-rose-900',
    barClass: 'bg-rose-700',
    Icon: XOctagon,
  },
};

export function AqiBadge({ aqi, category, tier }: AqiBadgeProps) {
  const safeTier = Math.min(6, Math.max(1, tier));
  const cfg = TIER_CONFIG[safeTier];
  const Icon = cfg.Icon;

  return (
    <div
      className="flex flex-col items-start sm:items-end gap-2"
      role="status"
      aria-label={`US EPA Air Quality Index ${aqi}, ${category}, Tier ${safeTier} of 6`}
    >
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 tabular-nums">
          {aqi}
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
          US AQI
        </span>
      </div>

      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-semibold ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">{category}</span>
      </div>

      <div
        className="w-36 h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5"
        aria-hidden="true"
      >
        {[1, 2, 3, 4, 5, 6].map((segment) => (
          <span
            key={segment}
            className={`flex-1 rounded-full ${
              segment <= safeTier ? cfg.barClass : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
