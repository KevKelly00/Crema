import { supabase, requireAuth } from './auth.js';

export async function loadLibrary() {
  const grid = document.getElementById('photoGrid');

  try {
    const session = await requireAuth();
    if (!session) return;
    const userId = session.user.id;

    let filter = 'all';

    async function fetchLogs() {
      grid.innerHTML = '';

      let query = supabase
        .from('coffee_logs')
        .select('id, photo_url, art_style, log_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filter === 'home') query = query.eq('log_type', 'home');
      if (filter === 'cafe') query = query.eq('log_type', 'cafe');

      const { data: logs, error } = await query;

      if (error || !logs || logs.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-icon">📷</div>
            <p>No brews here yet.</p>
          </div>`;
        return;
      }

      logs.forEach(log => {
        const item = document.createElement('div');
        item.addEventListener('click', () => window.location.href = `/log-detail.html?id=${log.id}`);

        if (log.photo_url) {
          item.className = 'photo-grid-item';
          const img = document.createElement('img');
          img.alt     = log.art_style || '';
          img.loading = 'lazy';
          img.onload  = () => img.classList.add('loaded');
          img.src     = log.photo_url;
          if (img.complete) img.classList.add('loaded');
          item.appendChild(img);
        } else {
          item.className = 'photo-grid-placeholder';
          item.textContent = log.log_type === 'cafe' ? '☕' : '☕';
        }
        grid.appendChild(item);
      });
    }

    window.setLibraryFilter = function(f) {
      filter = f;
      document.getElementById('filterAll').classList.toggle('active',  f === 'all');
      document.getElementById('filterHome').classList.toggle('active', f === 'home');
      document.getElementById('filterCafe').classList.toggle('active', f === 'cafe');
      fetchLogs();
    };

    await fetchLogs();

  } catch (err) {
    console.error('Library load error:', err);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">⚠️</div>
        <p>Couldn't load your brews.<br>Please refresh the page.</p>
      </div>`;
  }
}
