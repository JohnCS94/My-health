'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Validated reference palette (dataviz skill) — light and dark steps of the same hues.
const PALETTE = {
  light: {
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    surface: '#fcfcfb',
    grid: '#e9e8e4',
    axis: '#7a7974',
    muted: '#a9a8a2',
    ref: '#52514e',
  },
  dark: {
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
    surface: '#1a1a19',
    grid: '#2a2a28',
    axis: '#8f8e86',
    muted: '#5e5d58',
    ref: '#c3c2b7',
  },
};
export type Theme = (typeof PALETTE)['light'];

export function useChartTheme(): Theme {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const forced = document.documentElement.dataset.theme;
      setDark(forced ? forced === 'dark' : mq.matches);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return dark ? PALETTE.dark : PALETTE.light;
}

/** Fixed activity → categorical slot, so a workout type keeps its color regardless of what's filtered. */
const ACTIVITY_SLOT: Record<string, number> = {
  running: 0, strength: 1, walking: 2, cycling: 3, hiit: 4, yoga: 5, swimming: 6, other: 7,
};
export const activityKey = (a: string) => (a in ACTIVITY_SLOT ? a : 'other');
export const activityColor = (t: Theme, a: string) => t.series[ACTIVITY_SLOT[activityKey(a)]];

// ───────── shared bits ─────────

type TipRow = { name: string; value: string; color?: string };
function Tip({ title, rows }: { title: string; rows: TipRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="tip">
      <div className="t">{title}</div>
      {rows.map((r) => (
        <div className="r" key={r.name}>
          <span>
            {r.color ? <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: r.color, marginRight: 6 }} /> : null}
            {r.name}
          </span>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind?: 'box' | 'line' | 'dash' | 'dot' }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}>
          <i
            className={i.kind === 'line' ? 'line' : i.kind === 'dash' ? 'dash' : undefined}
            style={i.kind === 'dash' ? { borderColor: i.color } : { background: i.color, ...(i.kind === 'dot' ? { borderRadius: 99, width: 8, height: 8 } : {}) }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({
  title, hint, legend, sub, children, className = 'span-6',
}: { title: string; hint?: string; legend?: ReactNode; sub?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h2>{title}</h2>
        {legend}
      </div>
      {hint ? <p className="hint">{hint}</p> : <div style={{ height: 10 }} />}
      {sub}
      <div className="chart">{children}</div>
    </section>
  );
}

const axisProps = (t: Theme) => ({
  stroke: t.axis,
  tick: { fill: t.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

type AnyPayload = readonly { payload?: Record<string, unknown> }[];

// ───────── charts ─────────

export function WeightChart({ data, unit, goal, t }: { data: { label: string; weight: number | null; avg: number | null }[]; unit: string; goal: number | null; t: Theme }) {
  const vals = data.flatMap((d) => [d.weight, d.avg]).filter((v): v is number => v != null);
  if (goal != null) vals.push(goal);
  const pad = 2;
  const domain = vals.length ? [Math.floor(Math.min(...vals) - pad), Math.ceil(Math.max(...vals) + pad)] : [0, 1];
  return (
    <ResponsiveContainer>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps(t)} minTickGap={24} />
        <YAxis {...axisProps(t)} domain={domain} allowDecimals={false} />
        {goal != null ? <ReferenceLine y={goal} stroke={t.ref} strokeDasharray="4 4" strokeWidth={1.5} /> : null}
        <Scatter dataKey="weight" fill={t.muted} shape={(p: { cx?: number; cy?: number }) => (p.cx == null || p.cy == null ? <g /> : <circle cx={p.cx} cy={p.cy} r={4} fill={t.muted} stroke={t.surface} strokeWidth={2} />)} isAnimationActive={false} />
        <Line dataKey="avg" stroke={t.series[0]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        <Tooltip
          cursor={{ stroke: t.axis, strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            const p = (payload as AnyPayload | undefined)?.[0]?.payload as { weight: number | null; avg: number | null } | undefined;
            if (!active || !p) return null;
            const rows: TipRow[] = [];
            if (p.weight != null) rows.push({ name: 'Weigh-in', value: `${p.weight} ${unit}`, color: t.muted });
            if (p.avg != null) rows.push({ name: '7-day avg', value: `${p.avg} ${unit}`, color: t.series[0] });
            return <Tip title={String(label)} rows={rows} />;
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function GoalBarChart({
  data, dataKey, color, unit, goal, t, digits = 0,
}: { data: Record<string, unknown>[]; dataKey: string; color: string; unit: string; goal?: number | null; t: Theme; digits?: number }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps(t)} minTickGap={24} />
        <YAxis {...axisProps(t)} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        {goal ? <ReferenceLine y={goal} stroke={t.ref} strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" /> : null}
        <Tooltip
          cursor={{ fill: t.grid, opacity: 0.6 }}
          content={({ active, payload, label }) => {
            const v = (payload as AnyPayload | undefined)?.[0]?.payload?.[dataKey] as number | null | undefined;
            if (!active || v == null) return null;
            const rows: TipRow[] = [{ name: 'Total', value: `${v.toFixed(digits)} ${unit}`, color }];
            if (goal) rows.push({ name: 'Goal', value: `${goal.toFixed(digits)} ${unit}` });
            return <Tip title={String(label)} rows={rows} />;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StackedChart({
  data, keys, colors, names, unit, t, xKey = 'label', yMax, totalLabel,
}: {
  data: Record<string, unknown>[];
  keys: string[];
  colors: string[];
  names?: string[];
  unit: string;
  t: Theme;
  xKey?: string;
  /** Fix the y-axis top (e.g. 100 for a score). */
  yMax?: number;
  /** If set, the tooltip starts with a total row under this name. */
  totalLabel?: string;
}) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps(t)} minTickGap={24} />
        <YAxis {...axisProps(t)} domain={yMax ? [0, yMax] : undefined} />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="s"
            fill={colors[i]}
            stroke={t.surface}
            strokeWidth={2}
            maxBarSize={32}
            radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
        <Tooltip
          cursor={{ fill: t.grid, opacity: 0.6 }}
          content={({ active, payload, label }) => {
            const p = (payload as AnyPayload | undefined)?.[0]?.payload;
            if (!active || !p) return null;
            const rows: TipRow[] = keys
              .map((k, i) => ({ k, i, v: Number(p[k] ?? 0) }))
              .filter((r) => r.v > 0)
              .reverse()
              .map((r) => ({ name: names?.[r.i] ?? r.k, value: `${Math.round(r.v)} ${unit}`, color: colors[r.i] }));
            if (!rows.length) return null;
            if (totalLabel) {
              const total = keys.reduce((a, k) => a + Number(p[k] ?? 0), 0);
              rows.unshift({ name: totalLabel, value: String(Math.round(total)) });
            }
            return <Tip title={String(label)} rows={rows} />;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
