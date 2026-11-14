import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { localDate, rangeStart, type FoodRow, type HevySet, type HevyWorkout, type Profile, type Raw, type WorkoutRow } from './data';

/**
 * Server-side Supabase client. The app token lives only in Vercel's server environment
 * (no NEXT_PUBLIC_ prefix), so it never reaches the browser.
 */
function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const token = process.env.APP_TOKEN;
  if (!url || !key || !token) throw new Error('Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / APP_TOKEN env vars');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-app-token': token } },
  });
}

export async function fetchRaw(rangeDays: number): Promise<Raw> {
  const supabase = db();
  // A day of slack on each side covers timezone differences between the server and the viewer.
  const start = rangeStart(rangeDays + 1);
  const weightStart = new Date(start);
  weightStart.setDate(weightStart.getDate() - 6); // so the 7-day average is defined from day one
  const iso = start.toISOString();

  const [settings, food, water, weight, sleep, workouts, hevy] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('food_entries').select('*').gte('eaten_at', iso).order('eaten_at', { ascending: false }).limit(5000),
    supabase.from('water_entries').select('logged_at, amount_ml').gte('logged_at', iso).limit(10000),
    supabase.from('weight_entries').select('measured_at, weight_kg').gte('measured_at', weightStart.toISOString()).order('measured_at').limit(5000),
    supabase
      .from('sleep_entries')
      .select('sleep_date, hours, score, score_duration, score_consistency, score_interruptions').gte('sleep_date', localDate(start)),
    supabase.from('workouts').select('*').gte('started_at', iso).order('started_at', { ascending: false }),
    supabase
      .from('hevy_workouts')
      .select('id, title, description, started_at, ended_at, duration_min, volume_kg, set_count')
      .gte('started_at', iso)
      .order('started_at', { ascending: false }),
  ]);
  const err = [settings, food, water, weight, sleep, workouts, hevy].find((r) => r.error)?.error;
  if (err) throw new Error(err.message);

  // Exercise detail only for the most recent sessions (shown in the lifting log).
  const recentIds = (hevy.data ?? []).slice(0, 15).map((h) => h.id);
  const sets = recentIds.length
    ? await supabase
        .from('hevy_sets')
        .select('workout_id, exercise_index, exercise_title, set_index, set_type, weight_kg, reps, distance_m, duration_s, rpe')
        .in('workout_id', recentIds)
        .order('exercise_index')
        .order('set_index')
    : { data: [], error: null };
  if (sets.error) throw new Error(sets.error.message);

  return {
    profile: (settings.data ?? { display_name: null, units: 'imperial', calorie_goal: 2200, water_goal_ml: 2500, weight_goal_kg: null }) as Profile,
    // Hide Lose It's connection test entry (the app's next sync also deletes it).
    food: ((food.data ?? []) as FoodRow[]).filter((f) => !/\btest sample\b/i.test(f.name)),
    water: water.data ?? [],
    weight: weight.data ?? [],
    sleep: sleep.data ?? [],
    workouts: (workouts.data ?? []) as WorkoutRow[],
    hevy: (hevy.data ?? []) as HevyWorkout[],
    hevySets: (sets.data ?? []) as HevySet[],
  };
}
