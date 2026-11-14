'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  distLabel, kgTo, kmTo, loadDashboard, localDate, mean, mlTo, round, wLabel, waterLabel,
  type Dashboard as Data,
} from '@/lib/data';
import { demoDashboard } from '@/lib/demo';
import {
  ChartCard, GoalBarChart, Legend, ScoreLineChart, StackedChart, WeightChart, activityColor, activityKey, useChartTheme,
} from './charts';

const RANGES = [
  { days: 14, label: '2W' },
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
  { days: 365, label: '1Y' },
];

const REFRESH_MS = 60_000;

export default function Dashboard({ demo = false }: { demo?: boolean }) {
  const t = useChartTheme();
  const [range, setRange] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [foodDay, setFoodDay] = useState(localDate(new Date()));

  useEffect(() => {
    if (demo) {
      setData(demoDashboard(range));
      return;
    }
    let cancelled = false;
    const load = () =>
      loadDashboard(range)
        .then((d) => {
          if (cancelled) return;
          setData(d);
          setError(null);
          setUpdated(new Date());
        })
        .catch((e) => !cancelled && setError(e.message));
    load();
    // Refresh every minute while the tab is visible, and right away when it becomes visible again.
    const id = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [range, demo]);

  const v = useMemo(() => (data ? derive(data) : null), [data]);

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>{data?.profile.display_name ? `${data.profile.display_name}'s health` : 'Health dashboard'}</h1>
          <div className="sub">
            {demo ? 'Demo data' : updated ? `Updated ${updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '\u00a0'}
          </div>
        </div>
        <div className="filters">
          <div className="seg" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.days} aria-pressed={range === r.days} onClick={() => setRange(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
          {demo ? (
            <a className="btn ghost" href="/" style={{ textDecoration: 'none' }}>
              Exit demo
            </a>
          ) : null}
        </div>
      </header>

      {error ? <div className="card err">{error}</div> : null}
      {!data || !v ? (
        error ? null : <div className="empty">Loading…</div>
      ) : (
        <>
          <section className="tiles">
            <div className="tile">
              <div className="k">Weight</div>
              <div className="v">
                {v.latestWeight != null ? round(kgTo(v.latestWeight, v.u)) : '—'} <small>{wLabel(v.u)}</small>
              </div>
              <div className="d">
                {v.weightChange != null
                  ? `${v.weightChange > 0 ? '▲ +' : v.weightChange < 0 ? '▼ ' : ''}${round(kgTo(v.weightChange, v.u))} ${wLabel(v.u)} over range`
                  : 'Not enough data'}
              </div>
            </div>
            <div className="tile">
              <div className="k">Calories · 7-day avg</div>
              <div className="v">
                {v.cal7 != null ? Math.round(v.cal7) : '—'} <small>kcal</small>
              </div>
              <div className="d">Goal {data.profile.calorie_goal ?? '—'}</div>
            </div>
            <div className="tile">
              <div className="k">Sleep · 7-day avg</div>
              <div className="v">
                {v.sleep7 != null ? round(v.sleep7) : '—'} <small>h</small>
              </div>
              <div className="d">Avg score {v.score7 != null ? Math.round(v.score7) : '—'}</div>
            </div>
            <div className="tile">
              <div className="k">Water · 7-day avg</div>
              <div className="v">
                {v.water7 != null ? round(mlTo(v.water7, v.u), 0) : '—'} <small>{waterLabel(v.u)}</small>
              </div>
              <div className="d">
                Goal {data.profile.water_goal_ml ? round(mlTo(data.profile.water_goal_ml, v.u), 0) : '—'} {waterLabel(v.u)}
              </div>
            </div>
            <div className="tile">
              <div className="k">Workouts · last 7 days</div>
              <div className="v">
                {v.workouts7} <small>sessions</small>
              </div>
              <div className="d">{Math.round(v.workoutMin7)} min total</div>
            </div>
          </section>

          <div className="grid">
            <ChartCard
              title="Weight"
              className="span-12"
              hint={`Daily weigh-ins and the 7-day rolling average (${wLabel(v.u)})`}
              legend={
                <Legend
                  items={[
                    { label: 'Weigh-in', color: t.muted, kind: 'dot' },
                    { label: '7-day avg', color: t.series[0], kind: 'line' },
                    ...(v.weightGoal != null ? [{ label: 'Goal', color: t.ref, kind: 'dash' as const }] : []),
                  ]}
                />
              }
            >
              <WeightChart data={v.weightSeries} unit={wLabel(v.u)} goal={v.weightGoal} t={t} />
            </ChartCard>

            <ChartCard
              title="Calories"
              hint="Daily total vs goal (kcal)"
              legend={data.profile.calorie_goal ? <Legend items={[{ label: 'Goal', color: t.ref, kind: 'dash' }]} /> : null}
            >
              <GoalBarChart data={data.days} dataKey="calories" color={t.series[1]} unit="kcal" goal={data.profile.calorie_goal} t={t} />
            </ChartCard>

            <ChartCard
              title="Macros"
              hint="Grams per day"
              legend={
                <Legend
                  items={[
                    { label: 'Protein', color: t.series[0] },
                    { label: 'Carbs', color: t.series[1] },
                    { label: 'Fat', color: t.series[2] },
                  ]}
                />
              }
            >
              <StackedChart
                data={data.days}
                keys={['protein', 'carbs', 'fat']}
                names={['Protein', 'Carbs', 'Fat']}
                colors={[t.series[0], t.series[1], t.series[2]]}
                unit="g"
                t={t}
              />
            </ChartCard>

            <ChartCard title="Sleep duration" hint="Hours asleep per night">
              <GoalBarChart data={data.days} dataKey="sleepHours" color={t.series[6]} unit="h" goal={8} t={t} digits={1} />
            </ChartCard>

            <ChartCard title="Sleep score" hint="0–100, as entered in the app">
              <ScoreLineChart data={data.days} dataKey="sleepScore" color={t.series[6]} t={t} />
            </ChartCard>

            <ChartCard
              title="Water"
              hint={`Daily intake vs goal (${waterLabel(v.u)})`}
              legend={data.profile.water_goal_ml ? <Legend items={[{ label: 'Goal', color: t.ref, kind: 'dash' }]} /> : null}
            >
              <GoalBarChart
                data={v.waterSeries}
                dataKey="water"
                color={t.series[0]}
                unit={waterLabel(v.u)}
                goal={data.profile.water_goal_ml ? round(mlTo(data.profile.water_goal_ml, v.u), 0) : null}
                t={t}
              />
            </ChartCard>

            <ChartCard
              title="Training volume"
              hint="Minutes per week by activity"
              legend={<Legend items={v.activityKeys.map((a) => ({ label: cap(a), color: activityColor(t, a) }))} />}
            >
              {v.activityKeys.length ? (
                <StackedChart
                  data={v.weekSeries}
                  keys={v.activityKeys}
                  names={v.activityKeys.map(cap)}
                  colors={v.activityKeys.map((a) => activityColor(t, a))}
                  unit="min"
                  t={t}
                />
              ) : (
                <div className="empty">No workouts in this range.</div>
              )}
            </ChartCard>

            <section className="card span-6">
              <h2>Recent workouts</h2>
              <p className="hint">Including those imported from Apple Health</p>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Activity</th>
                      <th>Min</th>
                      <th>{distLabel(v.u)}</th>
                      <th>kcal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workouts.slice(0, 50).map((w) => (
                      <tr key={w.id} title={w.notes ?? undefined}>
                        <td>{new Date(w.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                        <td className="cap">{w.activity_type}</td>
                        <td>{Math.round(w.duration_min)}</td>
                        <td>{w.distance_km ? round(kmTo(Number(w.distance_km), v.u), 2) : '—'}</td>
                        <td>{w.calories ? Math.round(Number(w.calories)) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.workouts.length ? <div className="empty">No workouts yet.</div> : null}
              </div>
            </section>

            <section className="card span-6">
              <div className="card-head">
                <h2>Food log</h2>
                <input type="date" value={foodDay} max={localDate(new Date())} onChange={(e) => setFoodDay(e.target.value)} aria-label="Day" />
              </div>
              <FoodLog data={data} day={foodDay} />
            </section>

            <section className="card span-6">
              <h2>AI insights</h2>
              <p className="hint">Generated weekly from the last 30 days of data</p>
              {data.insights.length ? (
                data.insights.slice(0, 2).map((i) => (
                  <div key={i.id} style={{ marginBottom: 16 }}>
                    <div className="insight-date">{new Date(i.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
                    <div className="insight">{i.content}</div>
                  </div>
                ))
              ) : (
                <div className="empty">No insights yet.</div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function FoodLog({ data, day }: { data: Data; day: string }) {
  const rows = data.food.filter((f) => localDate(new Date(f.eaten_at)) === day).reverse();
  const total = rows.reduce((a, r) => a + Number(r.calories), 0);
  if (!rows.length) return <div className="empty">Nothing logged{day < data.days[0].date ? ' (outside selected range)' : ''}.</div>;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Meal</th>
            <th>Food</th>
            <th>kcal</th>
            <th>P / C / F</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id}>
              <td className="cap">{f.meal}</td>
              <td>
                {f.name}
                {f.serving_desc ? <div className="sub">{`${Number(f.servings)} × ${f.serving_desc}`}</div> : null}
              </td>
              <td>{Math.round(Number(f.calories))}</td>
              <td>
                {[f.protein_g, f.carbs_g, f.fat_g].map((x) => (x != null ? Math.round(Number(x)) : '–')).join(' / ')}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>
              <b>Total</b>
            </td>
            <td>
              <b>{Math.round(total)}</b>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function derive(data: Data) {
  const u = data.profile.units;
  const last7 = data.days.slice(-7);
  const weights = data.days.filter((d) => d.weightKg != null);
  const firstAvg = data.days.find((d) => d.weightAvgKg != null)?.weightAvgKg ?? null;
  const lastAvg = [...data.days].reverse().find((d) => d.weightAvgKg != null)?.weightAvgKg ?? null;

  // Fold activity types into the fixed set so colors stay stable.
  const activityKeys = [...new Set(data.activities.map(activityKey))];
  const weekSeries = data.weeks.map((w) => {
    const row: Record<string, number | string> = { label: w.label };
    for (const [k, val] of Object.entries(w)) {
      if (k === 'week' || k === 'label') continue;
      const key = activityKey(k);
      row[key] = Number(row[key] ?? 0) + Number(val);
    }
    return row;
  });

  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  const recentWorkouts = data.workouts.filter((w) => new Date(w.started_at) >= since7);

  return {
    u,
    latestWeight: weights.at(-1)?.weightKg ?? null,
    weightChange: firstAvg != null && lastAvg != null && weights.length > 1 ? lastAvg - firstAvg : null,
    weightGoal: data.profile.weight_goal_kg ? round(kgTo(Number(data.profile.weight_goal_kg), u)) : null,
    weightSeries: data.days.map((d) => ({
      label: d.label,
      weight: d.weightKg != null ? round(kgTo(d.weightKg, u)) : null,
      avg: d.weightAvgKg != null ? round(kgTo(d.weightAvgKg, u)) : null,
    })),
    waterSeries: data.days.map((d) => ({ label: d.label, water: d.waterMl != null ? round(mlTo(d.waterMl, u), 0) : null })),
    cal7: mean(last7.map((d) => d.calories)),
    sleep7: mean(last7.map((d) => d.sleepHours)),
    score7: mean(last7.map((d) => d.sleepScore)),
    water7: mean(last7.map((d) => d.waterMl)),
    workouts7: recentWorkouts.length,
    workoutMin7: recentWorkouts.reduce((a, w) => a + Number(w.duration_min), 0),
    activityKeys,
    weekSeries,
  };
}
