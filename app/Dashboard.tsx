'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  LockedError, distLabel, kgTo, kmTo, loadDashboard, localDate, mean, mlTo, round, wLabel, waterLabel,
  type Dashboard as Data,
} from '@/lib/data';
import { demoDashboard } from '@/lib/demo';
import {
  ChartCard, GoalBarChart, Legend, StackedChart, WeightChart, activityColor, activityKey, useChartTheme,
} from './charts';

const RANGES = [
  { days: 7, label: '1W' },
  { days: 14, label: '2W' },
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
  { days: 182, label: '6M' },
  { days: 365, label: '1Y' },
];

const REFRESH_MS = 60_000;

export default function Dashboard({ demo = false }: { demo?: boolean }) {
  const t = useChartTheme();
  const [range, setRange] = useState(7);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [unlockCount, setUnlockCount] = useState(0);
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
          setLocked(false);
          setUpdated(new Date());
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof LockedError) {
            setLocked(true);
            setData(null);
          } else setError(e.message);
        });
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
  }, [range, demo, unlockCount]);

  const v = useMemo(() => (data ? derive(data) : null), [data]);

  if (locked) return <Unlock onUnlocked={() => setUnlockCount((n) => n + 1)} />;

  async function lock() {
    await fetch('/api/logout', { method: 'POST' });
    setData(null);
    setLocked(true);
  }

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
          ) : (
            <button className="btn ghost" onClick={lock}>
              Lock
            </button>
          )}
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

            <ChartCard
              title="Sleep score"
              hint="Out of 100: duration 50 · bedtime consistency 30 · interruptions 20"
              legend={
                <Legend
                  items={[
                    { label: 'Duration', color: t.series[0] },
                    { label: 'Consistency', color: t.series[1] },
                    { label: 'Interruptions', color: t.series[2] },
                  ]}
                />
              }
            >
              <StackedChart
                data={data.days}
                keys={['scoreDuration', 'scoreConsistency', 'scoreInterruptions']}
                names={['Duration', 'Consistency', 'Interruptions']}
                colors={[t.series[0], t.series[1], t.series[2]]}
                unit="pts"
                t={t}
                yMax={100}
                totalLabel="Score"
              />
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

            <ChartCard
              title="Lifting volume"
              hint={`Weight × reps per week from Hevy (${wLabel(v.u)}, warm-ups excluded)`}
            >
              {data.hevy.length ? (
                <GoalBarChart data={v.liftSeries} dataKey="volume" color={activityColor(t, 'strength')} unit={wLabel(v.u)} t={t} />
              ) : (
                <div className="empty">No Hevy workouts in this range.</div>
              )}
            </ChartCard>

            <section className="card span-6">
              <h2>Lifting log</h2>
              <p className="hint">From Hevy. Tap a session to see every set</p>
              <LiftingLog data={data} u={v.u} />
            </section>

            <section className="card span-6">
              <h2>Cardio</h2>
              <p className="hint">Runs, walks, rides, swims and more from Apple Health (Strava, Apple Watch, …)</p>
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
                    {data.cardio.slice(0, 50).map((w) => (
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
                {!data.cardio.length ? <div className="empty">No cardio in this range.</div> : null}
              </div>
            </section>

            <section className="card span-6">
              <div className="card-head">
                <h2>Food log</h2>
                <input type="date" value={foodDay} max={localDate(new Date())} onChange={(e) => setFoodDay(e.target.value)} aria-label="Day" />
              </div>
              <FoodLog data={data} day={foodDay} />
            </section>

          </div>
        </>
      )}
    </div>
  );
}

function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [passphrase, setPassphrase] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    });
    setBusy(false);
    if (res.ok) return onUnlocked();
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(body.error ?? 'Something went wrong');
    setPassphrase('');
  }

  return (
    <div className="center">
      <form className="login" onSubmit={submit}>
        <h1>Health dashboard</h1>
        <div className="pass-field">
          <input
            type={show ? 'text' : 'password'}
            placeholder="Passphrase"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
          />
          <button
            type="button"
            className="pass-toggle"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide passphrase' : 'Show passphrase'}
            aria-pressed={show}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <button className="btn" disabled={busy || !passphrase}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
        {msg ? <div className="err">{msg}</div> : null}
      </form>
    </div>
  );
}

function LiftingLog({ data, u }: { data: Data; u: 'imperial' | 'metric' }) {
  if (!data.hevy.length) return <div className="empty">No Hevy workouts yet.</div>;
  const w = (kg: number) => round(kgTo(kg, u), 1);
  return (
    <div className="scroll lifts">
      {data.hevy.slice(0, 30).map((h, idx) => {
        const sets = data.hevySets.filter((s) => s.workout_id === h.id);
        const exercises = [...new Set(sets.map((s) => s.exercise_title))];
        return (
          <details key={h.id} open={idx === 0}>
            <summary>
              <span className="lift-date">{new Date(h.started_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="lift-title">{h.title ?? 'Workout'}</span>
              <span className="lift-meta">
                {Math.round(Number(h.duration_min ?? 0))} min · {h.set_count ?? 0} sets · {Math.round(kgTo(Number(h.volume_kg ?? 0), u)).toLocaleString()} {wLabel(u)}
              </span>
            </summary>
            {exercises.length ? (
              <table>
                <tbody>
                  {exercises.map((name) => {
                    const ex = sets.filter((s) => s.exercise_title === name);
                    return (
                      <tr key={name}>
                        <td style={{ width: '40%' }}>{name}</td>
                        <td>
                          {ex
                            .map((s) => {
                              const body =
                                s.reps != null
                                  ? `${s.weight_kg ? `${w(Number(s.weight_kg))}×` : ''}${s.reps}`
                                  : s.duration_s
                                    ? `${Math.round(Number(s.duration_s))}s`
                                    : s.distance_m
                                      ? `${Math.round(Number(s.distance_m))}m`
                                      : '–';
                              return s.set_type === 'warmup' ? `(${body})` : body;
                            })
                            .join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="sub" style={{ padding: '6px 0' }}>Set details are loaded for the 15 most recent sessions.</div>
            )}
          </details>
        );
      })}
      <div className="sub" style={{ marginTop: 8 }}>Weights in {wLabel(u)} · (warm-up sets in parentheses)</div>
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
  const recentWorkouts = [
    ...data.workouts.map((w) => ({ at: w.started_at, min: Number(w.duration_min) })),
    ...data.hevy.map((h) => ({ at: h.started_at, min: Number(h.duration_min ?? 0) })),
  ].filter((w) => new Date(w.at) >= since7);

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
    workoutMin7: recentWorkouts.reduce((a, w) => a + w.min, 0),
    liftSeries: data.liftWeeks.map((lw) => ({ label: lw.label, volume: lw.sessions ? Math.round(kgTo(lw.volumeKg, u)) : null })),
    activityKeys,
    weekSeries,
  };
}
