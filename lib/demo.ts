import { buildDashboard, localDate, type FoodRow, type Raw, type WorkoutRow } from './data';

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
  let id = 1;

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
    sleep.push({ sleep_date: localDate(d), hours, score: r() > 0.1 ? Math.round(55 + (hours - 6) * 12 + r() * 10) : null });

    const dow = d.getDay();
    const plan: [string, number, number | null][] =
      dow === 1 || dow === 4 ? [['strength', 55, null]] : dow === 2 || dow === 6 ? [['running', 35 + r() * 25, 5 + r() * 4]] : dow === 0 && r() > 0.5 ? [['cycling', 70, 28]] : [];
    if (r() > 0.6) plan.push(['walking', 30 + r() * 20, 2.5 + r()]);
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
      insights: [
        {
          id: 1,
          created_at: today.toISOString(),
          period_start: localDate(new Date(today.getTime() - 30 * 864e5)),
          period_end: localDate(today),
          content:
            "•  Weight trend is down ~1.5 lb over the month — right on pace for a sustainable 0.5 lb/week.\n• Nights under 6.5 h of sleep were followed by ~250 kcal more eaten the next day.\n• Water averaged 75 oz, short of the 85 oz goal on 4 of 7 days. Try front-loading a bottle before lunch.\n• Great consistency: 4–5 training sessions every week.",
        },
      ],
    },
    rangeDays,
  );
}
