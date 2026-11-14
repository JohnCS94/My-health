export type Units = 'imperial' | 'metric';

export type Profile = {
  display_name: string | null;
  units: Units;
  calorie_goal: number | null;
  water_goal_ml: number | null;
  weight_goal_kg: number | null;
};

export type FoodRow = {
  id: number;
  eaten_at: string;
  meal: string;
  name: string;
  brand: string | null;
  serving_desc: string | null;
  servings: number;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type WorkoutRow = {
  id: number;
  started_at: string;
  activity_type: string;
  duration_min: number;
  distance_km: number | null;
  calories: number | null;
  notes: string | null;
  source: string;
};

export type Day = {
  date: string; // YYYY-MM-DD
  label: string; // "Nov 3"
  calories: number | null;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number | null;
  weightKg: number | null;
  weightAvgKg: number | null; // trailing 7-day mean of logged weights
  sleepHours: number | null;
  sleepScore: number | null;
  workoutMin: number;
};

export type Week = { week: string; label: string; [activity: string]: number | string };

export type Dashboard = {
  profile: Profile;
  days: Day[];
  weeks: Week[];
  activities: string[];
  workouts: WorkoutRow[];
  food: FoodRow[];
  insights: { id: number; created_at: string; content: string; period_start: string; period_end: string }[];
};

export const localDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const label = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

export type Raw = {
  profile: Profile;
  food: FoodRow[];
  water: { logged_at: string; amount_ml: number }[];
  weight: { measured_at: string; weight_kg: number }[];
  sleep: { sleep_date: string; hours: number | null; score: number | null }[];
  workouts: WorkoutRow[];
  insights: Dashboard['insights'];
};

export function rangeStart(rangeDays: number) {
  const end = new Date();
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() - (rangeDays - 1));
}

/** Fetch raw rows from our own server route (which holds the app token) and aggregate them. */
export async function loadDashboard(rangeDays: number): Promise<Dashboard> {
  const res = await fetch(`/api/dashboard?days=${rangeDays}`, { cache: 'no-store' });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return buildDashboard(body as Raw, rangeDays);
}

/** Aggregate raw rows into per-day and per-week series. */
export function buildDashboard(raw: Raw, rangeDays: number): Dashboard {
  const end = new Date();
  const start = rangeStart(rangeDays);

  const days = new Map<string, Day>();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = localDate(d);
    days.set(key, {
      date: key,
      label: label(d),
      calories: null,
      protein: 0,
      carbs: 0,
      fat: 0,
      waterMl: null,
      weightKg: null,
      weightAvgKg: null,
      sleepHours: null,
      sleepScore: null,
      workoutMin: 0,
    });
  }

  for (const f of raw.food) {
    const day = days.get(localDate(new Date(f.eaten_at)));
    if (!day) continue;
    day.calories = (day.calories ?? 0) + Number(f.calories);
    day.protein += Number(f.protein_g ?? 0);
    day.carbs += Number(f.carbs_g ?? 0);
    day.fat += Number(f.fat_g ?? 0);
  }
  for (const w of raw.water) {
    const day = days.get(localDate(new Date(w.logged_at)));
    if (day) day.waterMl = (day.waterMl ?? 0) + w.amount_ml;
  }
  for (const s of raw.sleep) {
    const day = days.get(s.sleep_date);
    if (!day) continue;
    day.sleepHours = s.hours != null ? Number(s.hours) : null;
    day.sleepScore = s.score;
  }

  // Weight: last reading per day, plus trailing 7-day mean.
  const weightByDay = new Map<string, number>();
  for (const w of raw.weight) weightByDay.set(localDate(new Date(w.measured_at)), Number(w.weight_kg));
  for (const day of days.values()) {
    day.weightKg = weightByDay.get(day.date) ?? null;
    const [y, m, d] = day.date.split('-').map(Number);
    const window: number[] = [];
    for (let i = 0; i < 7; i++) {
      const v = weightByDay.get(localDate(new Date(y, m - 1, d - i)));
      if (v != null) window.push(v);
    }
    day.weightAvgKg = window.length ? window.reduce((a, b) => a + b, 0) / window.length : null;
  }

  // Workouts: per-day minutes and per-week minutes by activity.
  const wk = raw.workouts.filter((w) => new Date(w.started_at) >= start);
  const weeks = new Map<string, Week>();
  for (let d = weekStart(start); d <= end; d.setDate(d.getDate() + 7)) {
    weeks.set(localDate(d), { week: localDate(d), label: label(d) });
  }
  const activityTotals = new Map<string, number>();
  for (const w of wk) {
    const at = new Date(w.started_at);
    const day = days.get(localDate(at));
    if (day) day.workoutMin += Number(w.duration_min);
    const week = weeks.get(localDate(weekStart(at)));
    if (week) week[w.activity_type] = Number(week[w.activity_type] ?? 0) + Number(w.duration_min);
    activityTotals.set(w.activity_type, (activityTotals.get(w.activity_type) ?? 0) + Number(w.duration_min));
  }

  return {
    profile: raw.profile,
    days: [...days.values()],
    weeks: [...weeks.values()],
    activities: [...activityTotals.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a),
    workouts: wk,
    food: raw.food,
    insights: raw.insights,
  };
}

// ───────── units ─────────
export const kgTo = (kg: number, u: Units) => (u === 'imperial' ? kg * 2.20462 : kg);
export const mlTo = (ml: number, u: Units) => (u === 'imperial' ? ml * 0.033814 : ml);
export const kmTo = (km: number, u: Units) => (u === 'imperial' ? km * 0.621371 : km);
export const wLabel = (u: Units) => (u === 'imperial' ? 'lb' : 'kg');
export const waterLabel = (u: Units) => (u === 'imperial' ? 'oz' : 'ml');
export const distLabel = (u: Units) => (u === 'imperial' ? 'mi' : 'km');
export const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

export const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
