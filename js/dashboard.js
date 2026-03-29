import { supabase, requireAuth } from './auth.js';
import { esc } from './utils.js';

export async function loadDashboard() {
  const session = await requireAuth();
  const userId = session.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', userId)
    .single();

  // Greeting
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const firstName = profile?.full_name?.split(' ')[0] || null;
  const greetingEl = document.getElementById('greeting');
  if (greetingEl) greetingEl.textContent = firstName ? `${timeOfDay}, ${firstName} ☕` : `${timeOfDay} ☕`;

  // Avatar
  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl && profile?.avatar_url) avatarEl.src = profile.avatar_url;

  await Promise.all([
    loadStats(userId),
    loadStreak(userId),
    loadBeans(userId),
  ]);
}

async function loadStats(userId) {
  // Home brews total
  const { count: total } = await supabase
    .from('coffee_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('log_type', 'home');

  setText('statTotal', total ?? 0);

  // This week home brews
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: thisWeek } = await supabase
    .from('coffee_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('log_type', 'home')
    .gte('created_at', weekAgo.toISOString());

  setText('statWeek', thisWeek ?? 0);

  // Avg art rating + AI high score — home only
  const { data: homeLogs } = await supabase
    .from('coffee_logs')
    .select('art_rating, ai_rating')
    .eq('user_id', userId)
    .eq('log_type', 'home');

  if (homeLogs && homeLogs.length > 0) {
    const rated = homeLogs.filter(l => l.art_rating != null);
    const avg = rated.length
      ? (rated.reduce((s, l) => s + parseFloat(l.art_rating), 0) / rated.length).toFixed(1)
      : '—';
    setText('statRating', avg);

    const aiScores = homeLogs.map(l => l.ai_rating).filter(Boolean);
    const best = aiScores.length ? Math.max(...aiScores.map(parseFloat)).toFixed(1) : '—';
    setText('statAiBest', best);
  } else {
    setText('statRating', '—');
    setText('statAiBest', '—');
  }
}

async function loadStreak(userId) {
  // Fetch all distinct brew dates (home brews only) ordered descending
  const { data: logs } = await supabase
    .from('coffee_logs')
    .select('created_at')
    .eq('user_id', userId)
    .eq('log_type', 'home')
    .order('created_at', { ascending: false });

  if (!logs || logs.length === 0) {
    setText('streakCurrent', '0');
    setText('streakBest', '0');
    const hint = document.getElementById('streakHint');
    if (hint) hint.textContent = 'Log your first home brew!';
    return;
  }

  // Build sorted unique date strings (YYYY-MM-DD in local time)
  const dateSet = new Set(logs.map(l => toDateStr(new Date(l.created_at))));
  const dates = [...dateSet].sort().reverse(); // most recent first

  // Current streak: count consecutive days from today or yesterday
  const todayStr     = toDateStr(new Date());
  const yesterdayStr = toDateStr(offsetDays(new Date(), -1));

  let current = 0;
  if (dates[0] === todayStr || dates[0] === yesterdayStr) {
    let expected = dates[0] === todayStr ? todayStr : yesterdayStr;
    for (const d of dates) {
      if (d === expected) {
        current++;
        expected = toDateStr(offsetDays(new Date(expected + 'T12:00:00'), -1));
      } else {
        break;
      }
    }
  }

  // Best streak: scan all dates
  let best = 0;
  let run  = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T12:00:00');
    const curr = new Date(dates[i]     + 'T12:00:00');
    const diff = Math.round((prev - curr) / 86400000);
    if (diff === 1) {
      run++;
    } else {
      best = Math.max(best, run);
      run  = 1;
    }
  }
  best = Math.max(best, run, current);

  setText('streakCurrent', current);
  setText('streakBest', best + ' days');

  const hint = document.getElementById('streakHint');
  if (hint) {
    if (current === 0) {
      hint.textContent = 'No active streak — brew today to start one!';
    } else if (dates[0] === todayStr) {
      hint.textContent = current >= best ? 'New personal best — keep going!' : 'Keep it up — don\'t break the streak!';
    } else {
      hint.textContent = 'Brew today to keep the streak alive!';
    }
  }
}

async function loadBeans(userId) {
  const container = document.getElementById('beansList');
  if (!container) return;

  const { data: beans } = await supabase
    .from('beans')
    .select('id, name, roast_date')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('roast_date', { ascending: false });

  if (!beans || beans.length === 0) {
    container.innerHTML = '<div class="bean-empty">No beans in rotation yet.</div>';
    return;
  }

  const today = new Date();
  container.innerHTML = beans.map(bean => {
    let daysLabel = '—';
    let ageClass  = '';
    if (bean.roast_date) {
      const days = Math.floor((today - new Date(bean.roast_date)) / 86400000);
      daysLabel = `${days}d`;
      ageClass  = days < 7 ? 'fresh' : days <= 21 ? 'peak' : 'old';
    }
    return `
      <div class="bean-row">
        <div class="bean-name">${esc(bean.name)}</div>
        <div class="bean-age ${ageClass}">${daysLabel}</div>
      </div>`;
  }).join('');
}

function toDateStr(date) {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function offsetDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
