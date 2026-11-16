import { buildDashboard, localDate, type FoodRow, type HevySet, type HevyWorkout, type Raw, type WorkoutRow } from './data';

/** Deterministic pseudo-random so the demo looks the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Sample data for previewing the dashboard (`/?demo`) before Supabase is connected. */
export function demoDashboard(rangeDays: number) {
  const r = rng(42);
  const days = 400;
  const today = new Date();
  const food: FoodRow[] = [];
  const water: Raw['water'] = [];
  const weight: Raw['weight'] = [];
  const sleep: Raw['sleep'] = [];
  const workouts: WorkoutRow[] = [];
  const hevy: HevyWorkout[] = [];
  const hevySets: HevySet[] = [];
  let id = 1;

  // Push / pull / legs rotation with slow progression.
  const programs: [string, [string, number][]][] = [
    ['Push Day', [['Bench Press (Barbell)', 80], ['Overhead Press (Barbell)', 47.5], ['Incline Bench Press (Dumbbell)', 30], ['Triceps Pushdown', 30]]],
    ['Pull Day', [['Deadlift (Barbell)', 140], ['Pull Up', 0], ['Bent Over Row (Barbell)', 70], ['Bicep Curl (Dumbbell)', 15]]],
    ['Leg Day', [['Squat (Barbell)', 110], ['Romanian Deadlift (Barbell)', 90], ['Leg Press', 180], ['Calf Raise (Machine)', 80]]],
  ];
  let liftN = 0;

  const meals: [string, string, number, number, number, number][] = [
    ['breakfast', 'Greek yogurt with berries', 280, 22, 34, 6],
    ['breakfast', 'Oatmeal with banana', 360, 10, 68, 6],
    ['lunch', 'Chicken burrito bowl', 680, 45, 70, 22],
    ['lunch', 'Turkey sandwich', 520, 32, 52, 18],
    ['dinner', 'Salmon, rice & broccoli', 640, 42, 58, 24],
    ['dinner', 'Spaghetti bolognese', 720, 34, 88, 22],
    ['snack', 'Protein bar', 210, 20, 22, 7],
    ['snack', 'Apple & peanut butter', 270, 7, 28, 16],
  ];

  for (let i = days; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const at = (h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, Math.floor(r() * 60)).toISOString();

    if (r() > 0.15) weight.push({ measured_at: at(7), weight_kg: 88 - (days - i) * 0.012 + Math.sin(i / 5) * 0.4 + (r() - 0.5) * 0.8 });

    if (r() > 0.08) {
      for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
        const opts = meals.filter((m) => m[0] === meal);
        const m = opts[Math.floor(r() * opts.length)];
        const h = { breakfast: 8, lunch: 12, dinner: 19, snack: 15 }[meal]!;
        food.push({
          id: id++, eaten_at: at(h), meal, name: m[1], brand: null, serving_desc: '1 serving', servings: 1,
          calories: Math.round(m[2] * (0.85 + r() * 0.3)), protein_g: m[3], carbs_g: m[4], fat_g: m[5],
        });
      }
    }

    const glasses = 4 + Math.floor(r() * 6);
    for (let g = 0; g < glasses; g++) water.push({ logged_at: at(8 + g * 1.5), amount_ml: 350 });

    const hours = Math.round((6.2 + r() * 2.2) * 100) / 100;
    {
      const dur = hours >= 7 ? 50 : 50 * Math.max(0, (hours - 4) / 3) ** 1.4;
      const con = 30 * Math.min(1, Math.max(0, 1 - (r() * 110 - 30) / 120));
      const int = 20 * (0.6 + r() * 0.4);
      sleep.push({
        sleep_date: localDate(d), hours, score: Math.round(dur + con + int),
        score_duration: Math.round(dur * 10) / 10, score_consistency: Math.round(con * 10) / 10, score_interruptions: Math.round(int * 10) / 10,
      });
    }

    const dow = d.getDay();
    const plan: [string, number, number | null][] =
      dow === 2 || dow === 6 ? [['running', 35 + r() * 25, 5 + r() * 4]] : dow === 0 && r() > 0.5 ? [['cycling', 70, 28]] : [];
    if (r() > 0.6) plan.push(['walking', 30 + r() * 20, 2.5 + r()]);
    if (dow === 1 || dow === 3 || dow === 5) {
      const [title, exercises] = programs[liftN++ % programs.length];
      const progress = 1 + (days - i) / days * 0.08;
      const hid = `demo-${i}`;
      const startAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 30);
      const mins = 55 + Math.round(r() * 20);
      let vol = 0;
      let count = 0;
      exercises.forEach(([name, base], ei) => {
        hevySets.push({ workout_id: hid, exercise_index: ei, exercise_title: name, set_index: 0, set_type: 'warmup', weight_kg: base ? Math.round(base * 0.5) : null, reps: 10, distance_m: null, duration_s: null, rpe: null });
        for (let si = 1; si <= 3; si++) {
          const w = base ? Math.round((base * progress) / 2.5) * 2.5 : null;
          const reps = 8 - si + Math.round(r() * 2);
          hevySets.push({ workout_id: hid, exercise_index: ei, exercise_title: name, set_index: si, set_type: 'normal', weight_kg: w, reps, distance_m: null, duration_s: null, rpe: 7 + si * 0.5 });
          vol += (w ?? 0) * reps;
          count++;
        }
      });
      hevy.push({
        id: hid, title, description: null, started_at: startAt.toISOString(),
        ended_at: new Date(startAt.getTime() + mins * 60_000).toISOString(), duration_min: mins, volume_kg: Math.round(vol), set_count: count,
      });
    }
    for (const [type, mins, km] of plan) {
      workouts.push({
        id: id++, started_at: at(type === 'walking' ? 18 : 6), activity_type: type, duration_min: Math.round(mins),
        distance_km: km ? Math.round(km * 100) / 100 : null, calories: Math.round(mins * 9), notes: null, source: 'healthkit',
      });
    }
  }

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (rangeDays + 6));
  return buildDashboard(
    {
      profile: {
        display_name: "Demo",
        units: "imperial",
        calorie_goal: 2200,
        water_goal_ml: 2500,
        weight_goal_kg: 81.6,
      },
      food: food.reverse(),
      water,
      weight: weight.filter((w) => new Date(w.measured_at) >= start),
      sleep,
      workouts: workouts.reverse(),
      hevy: hevy.reverse(),
      latestWeightKg: weight.at(-1)?.weight_kg ?? null,
      hevySets: hevySets.filter((x) => hevy.slice(0, 15).some((h) => h.id === x.workout_id)),
    },
    rangeDays,
  );
}
