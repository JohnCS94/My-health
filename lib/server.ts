import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { localDate, rangeStart, type FoodRow, type Profile, type Raw, type WorkoutRow } from './data';

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

  const [settings, food, water, weight, sleep, workouts, insights] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('food_entries').select('*').gte('eaten_at', iso).order('eaten_at', { ascending: false }).limit(5000),
    supabase.from('water_entries').select('logged_at, amount_ml').gte('logged_at', iso).limit(10000),
    supabase.from('weight_entries').select('measured_at, weight_kg').gte('measured_at', weightStart.toISOString()).order('measured_at').limit(5000),
    supabase.from('sleep_entries').select('sleep_date, hours, score').gte('sleep_date', localDate(start)),
    supabase.from('workouts').select('*').gte('started_at', iso).order('started_at', { ascending: false }),
    supabase.from('insights').select('*').order('created_at', { ascending: false }).limit(5),
  ]);
  const err = [settings, food, water, weight, sleep, workouts, insights].find((r) => r.error)?.error;
  if (err) throw new Error(err.message);

  return {
    profile: (settings.data ?? { display_name: null, units: 'imperial', calorie_goal: 2200, water_goal_ml: 2500, weight_goal_kg: null }) as Profile,
    food: (food.data ?? []) as FoodRow[],
    water: water.data ?? [],
    weight: weight.data ?? [],
    sleep: sleep.data ?? [],
    workouts: (workouts.data ?? []) as WorkoutRow[],
    insights: insights.data ?? [],
  };
}
