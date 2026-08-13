
const state = {
  data: null,
  tab: 'people-points',
  search: '',
  dept: '',
  view: 'overview',
};

const money = (n) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(Number(n) || 0);

const num = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0);

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function denseRank(items, valueFn) {
  let rank = 0;
  let prev = null;
  return items.map((item, idx) => {
    const val = valueFn(item);
    if (idx === 0 || val !== prev) rank = idx + 1;
    prev = val;
    return { ...item, rank, value: val };
  });
}

function aggregateDepartments(people) {
  const map = new Map();
  for (const p of people) {
    const key = p.department || 'Unassigned';
    if (!map.has(key)) {
      map.set(key, { department: key, raised: 0, points: 0, participants: 0 });
    }
    const d = map.get(key);
    d.raised += toNum(p.raised);
    d.points += toNum(p.points);
    d.participants += 1;
  }
  return [...map.values()];
}

function prizeClass(prize) {
  const p = String(prize || '').toLowerCase();
  if (p.includes('gold')) return 'gold';
  if (p.includes('silver')) return 'silver';
  if (p.includes('bronze')) return 'bronze';
  if (p.includes('participation')) return 'participation';
  return 'none';
}

function medalClass(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return '';
}

function filterPeople(people) {
  const q = state.search.trim().toLowerCase();
  return people.filter((p) => {
    if (state.dept && p.department !== state.dept) return false;
    if (!q) return true;
    return [p.name, p.department, p.team, p.prize]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

function renderKpis(people, depts) {
  const raised = people.reduce((s, p) => s + toNum(p.raised), 0);
  const points = people.reduce((s, p) => s + toNum(p.points), 0);
  document.getElementById('kpiRaised').textContent = money(raised);
  document.getElementById('kpiPoints').textContent = num(points);
  document.getElementById('kpiPeople').textContent = num(people.length);
  document.getElementById('kpiDepts').textContent = num(depts.length);
  const disc = document.getElementById('totalsDisclaimer');
  if (disc) {
    disc.textContent = (state.data && state.data.disclaimer)
      || 'Total Participants and Total Funds Raised only count SAX employees in this competition below partner level.';
  }
  const partnersDisc = document.getElementById('partnersDisclaimer');
  if (partnersDisc) {
    partnersDisc.textContent = (state.data && state.data.partnersDisclaimer)
      || 'Partners are ineligible to win any prizes and are therefore not reflected in the leaderboard.';
  }
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setTxt('vKpiRaised', money(raised));
  setTxt('vKpiPoints', num(points));
  setTxt('vKpiPeople', num(people.length));
  setTxt('vKpiDepts', num(depts.length));
}

function renderPodiumPeople(people) {
  // Match announcement graphic: Top Points 1-3 with dense ranks (ties share place)
  const ranked = denseRank(
    [...people].sort((a, b) => toNum(b.points) - toNum(a.points) || toNum(b.raised) - toNum(a.raised) || a.name.localeCompare(b.name)),
    (p) => toNum(p.points)
  ).slice(0, 3);

  const el = document.getElementById('podiumPeople');
  if (!ranked.length) {
    el.innerHTML = '<div class="muted">No participants yet.</div>';
    return;
  }
  el.innerHTML = ranked.map((p) => `
    <article class="pod-card ${medalClass(p.rank)}">
      <div class="pod-rank">${p.rank}</div>
      <div class="pod-name">${escapeHtml(p.name)}</div>
      <div class="pod-sub">${escapeHtml(p.department)}${p.team ? ' · ' + escapeHtml(p.team) : ''}</div>
      <div class="pod-metric">${num(p.points)} pts<small>${money(p.raised)} raised${p.prize ? ' · ' + escapeHtml(p.prize) : ''}</small></div>
    </article>
  `).join('');
}

function renderPodiumDepts(depts) {
  const ranked = denseRank(
    [...depts].sort((a, b) => b.raised - a.raised || b.participants - a.participants || a.department.localeCompare(b.department)),
    (d) => d.raised
  ).slice(0, 3);

  const el = document.getElementById('podiumDepts');
  if (!ranked.length) {
    el.innerHTML = '<div class="muted">No department data yet.</div>';
    return;
  }
  el.innerHTML = ranked.map((d) => `
    <article class="pod-card ${medalClass(d.rank)}">
      <div class="pod-rank">${d.rank}</div>
      <div class="pod-name">${escapeHtml(d.department)}</div>
      <div class="pod-sub">${num(d.participants)} participants</div>
      <div class="pod-metric">${money(d.raised)}<small>${num(d.points)} total pts</small></div>
    </article>
  `).join('');
}

function fillDeptFilter(people) {
  const sel = document.getElementById('deptFilter');
  const current = state.dept;
  const depts = [...new Set(people.map((p) => p.department).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `<option value="">All departments</option>` + depts.map((d) => `<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`).join('');
  sel.value = current;
}

function maxOf(arr, fn) {
  return Math.max(1, ...arr.map(fn));
}

function renderTable(people, depts) {
  const thead = document.getElementById('thead');
  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  const filteredPeople = filterPeople(people);

  let rowsHtml = '';
  let headHtml = '';

  if (state.tab === 'people-raised' || state.tab === 'people-points') {
    const byPoints = state.tab === 'people-points';
    const sorted = denseRank(
      [...filteredPeople].sort((a, b) => {
        if (byPoints) {
          return toNum(b.points) - toNum(a.points) || toNum(b.raised) - toNum(a.raised) || a.name.localeCompare(b.name);
        }
        return toNum(b.raised) - toNum(a.raised) || toNum(b.points) - toNum(a.points) || a.name.localeCompare(b.name);
      }),
      (p) => byPoints ? toNum(p.points) : toNum(p.raised)
    );
    const maxVal = maxOf(sorted, (p) => byPoints ? toNum(p.points) : toNum(p.raised));
    headHtml = `
      <tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Department</th>
        <th>Team</th>
        <th>$ Raised</th>
        <th>Points</th>
        <th>Prize</th>
      </tr>`;
    rowsHtml = sorted.map((p) => {
      const primary = byPoints ? toNum(p.points) : toNum(p.raised);
      const width = Math.max(4, Math.round((primary / maxVal) * 100));
      return `
        <tr>
          <td><span class="rank-pill ${p.rank <= 3 ? 'r' + p.rank : ''}">${p.rank}</span></td>
          <td class="name-cell">${escapeHtml(p.name)}</td>
          <td class="muted">${escapeHtml(p.department || '')}</td>
          <td class="muted">${escapeHtml(p.team || '—')}</td>
          <td>
            ${!byPoints ? `<span class="bar-wrap"><span class="bar" style="width:${width}%"></span></span>` : ''}
            <span class="money">${money(p.raised)}</span>
          </td>
          <td>
            ${byPoints ? `<span class="bar-wrap"><span class="bar" style="width:${width}%"></span></span>` : ''}
            <span class="points">${num(p.points)}</span>
          </td>
          <td><span class="tier ${prizeClass(p.prize)}">${escapeHtml(p.prize || '—')}</span></td>
        </tr>`;
    }).join('');
    empty.classList.toggle('hidden', sorted.length > 0);
  } else {
    // department boards - search filters department name; dept filter still applies via people first
    const sourceDepts = aggregateDepartments(filteredPeople);
    const byParticipants = state.tab === 'dept-participants';
    const sorted = denseRank(
      [...sourceDepts].sort((a, b) => {
        if (byParticipants) {
          return b.participants - a.participants || b.raised - a.raised || a.department.localeCompare(b.department);
        }
        return b.raised - a.raised || b.participants - a.participants || a.department.localeCompare(b.department);
      }),
      (d) => byParticipants ? d.participants : d.raised
    );
    const maxVal = maxOf(sorted, (d) => byParticipants ? d.participants : d.raised);
    headHtml = `
      <tr>
        <th>Rank</th>
        <th>Department</th>
        <th>$ Raised</th>
        <th>Participants</th>
        <th>Total Points</th>
      </tr>`;
    rowsHtml = sorted.map((d) => {
      const primary = byParticipants ? d.participants : d.raised;
      const width = Math.max(4, Math.round((primary / maxVal) * 100));
      return `
        <tr>
          <td><span class="rank-pill ${d.rank <= 3 ? 'r' + d.rank : ''}">${d.rank}</span></td>
          <td class="name-cell">${escapeHtml(d.department)}</td>
          <td>
            ${!byParticipants ? `<span class="bar-wrap"><span class="bar" style="width:${width}%"></span></span>` : ''}
            <span class="money">${money(d.raised)}</span>
          </td>
          <td>
            ${byParticipants ? `<span class="bar-wrap"><span class="bar" style="width:${width}%"></span></span>` : ''}
            <span class="points">${num(d.participants)}</span>
          </td>
          <td class="points">${num(d.points)}</td>
        </tr>`;
    }).join('');
    empty.classList.toggle('hidden', sorted.length > 0);
  }

  thead.innerHTML = headHtml;
  tbody.innerHTML = rowsHtml;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll('`', '');
}


function medalBarClass(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return 'c' + ((rank - 1) % 4);
}

function renderColumnChart(el, items, valueFn, valueFmt, labelFn, metaFn) {
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="muted">No data yet.</div>';
    return;
  }
  const maxVal = Math.max(1, ...items.map((it) => toNum(valueFn(it))));
  el.classList.remove('horizontal');
  el.innerHTML = items.map((it, idx) => {
    const val = toNum(valueFn(it));
    const pct = Math.max(6, Math.round((val / maxVal) * 100));
    const rank = it.rank || (idx + 1);
    const cls = medalBarClass(rank);
    return `
      <div class="col-bar">
        <div class="bar-val">${escapeHtml(valueFmt(val))}</div>
        <div class="bar-track">
          <div class="bar-fill ${cls}" style="height:${pct}%">
            <div class="bar-rank">${rank}</div>
          </div>
        </div>
        <div class="bar-caption">
          <div class="bar-label">${escapeHtml(labelFn(it))}</div>
          <div class="bar-meta">${escapeHtml(metaFn(it))}</div>
        </div>
      </div>`;
  }).join('');
}

function renderHorizontalChart(el, items, valueFn, valueFmt, labelFn, metaFn, colorMode = 'cycle') {
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="muted">No data yet.</div>';
    return;
  }
  const maxVal = Math.max(1, ...items.map((it) => toNum(valueFn(it))));
  el.classList.add('horizontal');
  el.innerHTML = items.map((it, idx) => {
    const val = toNum(valueFn(it));
    const pct = Math.max(3, Math.round((val / maxVal) * 100));
    let cls = 'c' + (idx % 4);
    if (colorMode === 'rank' && it.rank) cls = medalBarClass(it.rank);
    if (colorMode === 'prize') cls = prizeClass(it.prize || '') === 'none' ? 'c3' : prizeClass(it.prize || '');
    return `
      <div class="h-bar">
        <div class="h-label">${escapeHtml(labelFn(it))}<span class="h-meta">${escapeHtml(metaFn(it))}</span></div>
        <div class="h-track"><div class="h-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="h-val">${escapeHtml(valueFmt(val))}</div>
      </div>`;
  }).join('');
}

function renderPrizeTiers(el, people) {
  if (!el) return;
  const buckets = { Gold: 0, Silver: 0, Bronze: 0, Participation: 0, None: 0 };
  for (const p of people) {
    const prize = String(p.prize || '').trim();
    if (!prize) buckets.None += 1;
    else if (buckets[prize] !== undefined) buckets[prize] += 1;
    else buckets.None += 1;
  }
  const order = ['Gold', 'Silver', 'Bronze', 'Participation', 'None'];
  el.innerHTML = order.map((name) => {
    const cls = name === 'None' ? 'none' : name.toLowerCase();
    const label = name === 'None' ? 'No Tier Yet' : name;
    return `
      <div class="tier-card ${cls}">
        <div class="tier-name">${label}</div>
        <div class="tier-count">${num(buckets[name])}</div>
      </div>`;
  }).join('');
}

function renderActivity(el, people) {
  if (!el) return;
  const sum = (key) => people.reduce((s, p) => s + toNum(p[key]), 0);
  const items = [
    ['Registered', sum('registered')],
    ['Teammates Recruited', sum('recruits')],
    ['Social Posts', sum('posts')],
    ['Shares / Reposts', sum('shares')],
    ['Comments / Follows', sum('comments')],
    ['Volunteered', sum('volunteered')],
  ];
  el.innerHTML = items.map(([label, val]) => `
    <div class="activity-card">
      <div class="a-label">${escapeHtml(label)}</div>
      <div class="a-val">${num(val)}</div>
    </div>`).join('');
}

function renderVisual(people, depts) {
  const byPoints = denseRank(
    [...people].sort((a, b) => toNum(b.points) - toNum(a.points) || toNum(b.raised) - toNum(a.raised) || a.name.localeCompare(b.name)),
    (p) => toNum(p.points)
  );
  const byRaised = denseRank(
    [...people].sort((a, b) => toNum(b.raised) - toNum(a.raised) || toNum(b.points) - toNum(a.points) || a.name.localeCompare(b.name)),
    (p) => toNum(p.raised)
  );
  const deptByRaised = denseRank(
    [...depts].sort((a, b) => b.raised - a.raised || b.participants - a.participants || a.department.localeCompare(b.department)),
    (d) => d.raised
  );
  const deptByPoints = denseRank(
    [...depts].sort((a, b) => b.points - a.points || b.raised - a.raised || a.department.localeCompare(b.department)),
    (d) => d.points
  );

  renderColumnChart(
    document.getElementById('chartTopPoints'),
    byPoints.slice(0, 5),
    (p) => p.points,
    num,
    (p) => p.name,
    (p) => `${p.department || ''}${p.prize ? ' · ' + p.prize : ''}`
  );
  renderColumnChart(
    document.getElementById('chartTopRaised'),
    byRaised.slice(0, 5),
    (p) => p.raised,
    money,
    (p) => p.name,
    (p) => `${p.department || ''} · ${num(p.points)} pts`
  );
  renderHorizontalChart(
    document.getElementById('chartDeptRaised'),
    deptByRaised,
    (d) => d.raised,
    money,
    (d) => d.department,
    (d) => `${num(d.participants)} participants`,
    'cycle'
  );
  renderHorizontalChart(
    document.getElementById('chartDeptPoints'),
    deptByPoints,
    (d) => d.points,
    num,
    (d) => d.department,
    (d) => `${money(d.raised)} raised`,
    'cycle'
  );
  renderHorizontalChart(
    document.getElementById('chartAllPoints'),
    byPoints,
    (p) => p.points,
    num,
    (p) => p.name,
    (p) => `${p.department || ''}${p.team ? ' · ' + p.team : ''}`,
    'rank'
  );
  renderHorizontalChart(
    document.getElementById('chartAllRaised'),
    byRaised,
    (p) => p.raised,
    money,
    (p) => p.name,
    (p) => `${num(p.points)} pts${p.prize ? ' · ' + p.prize : ''}`,
    'prize'
  );
  renderPrizeTiers(document.getElementById('chartPrizeTiers'), people);
  renderActivity(document.getElementById('chartActivity'), people);
}

function setView(view) {
  state.view = view;
  const overview = document.getElementById('view-overview');
  const visual = document.getElementById('view-visual');
  const btnO = document.getElementById('viewOverviewBtn');
  const btnV = document.getElementById('viewVisualBtn');
  const isVisual = view === 'visual';
  if (overview) {
    overview.hidden = isVisual;
    overview.classList.toggle('active', !isVisual);
  }
  if (visual) {
    visual.hidden = !isVisual;
    visual.classList.toggle('active', isVisual);
  }
  if (btnO) btnO.classList.toggle('active', !isVisual);
  if (btnV) btnV.classList.toggle('active', isVisual);
}

function renderAll() {
  if (!state.data) return;
  const people = state.data.people || [];
  const depts = aggregateDepartments(people);
  document.getElementById('title').textContent = 'INTERNAL COMPETITION';
  document.getElementById('subtitle').textContent = state.data.subtitle || 'Current Standings · Fundraising & Participation Leaderboard';
  const updated = state.data.updatedAt ? new Date(state.data.updatedAt) : null;
  document.getElementById('updated').textContent = updated
    ? `Updated ${updated.toLocaleString()}`
    : 'Updated just now';
  fillDeptFilter(people);
  renderKpis(people, depts);
  renderPodiumPeople(people);
  renderPodiumDepts(depts);
  renderTable(people, depts);
  renderVisual(people, depts);
}

async function loadData({ silent = false } = {}) {
  try {
    const res = await fetch(`data.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
    const next = await res.json();
    const prevUpdated = state.data && state.data.updatedAt;
    const nextUpdated = next && next.updatedAt;
    // Always apply first load; on polls, skip re-render when unchanged.
    if (!state.data || prevUpdated !== nextUpdated || JSON.stringify(state.data.people) !== JSON.stringify(next.people)) {
      state.data = next;
      renderAll();
    }
  } catch (err) {
    if (!silent) {
      const el = document.getElementById('updated');
      if (el) el.textContent = err.message || String(err);
    }
    // Keep showing last good data on background poll failures.
    throw err;
  }
}

function startDataPolling() {
  const REFRESH_MS = 60_000;
  setInterval(() => {
    loadData({ silent: true }).catch(() => {});
  }, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadData({ silent: true }).catch(() => {});
    }
  });
}

function bind() {
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.view || 'overview');
    });
  });
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.tab = btn.dataset.tab;
      renderAll();
    });
  });
  document.getElementById('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderAll();
  });
  document.getElementById('deptFilter').addEventListener('change', (e) => {
    state.dept = e.target.value;
    renderAll();
  });
}

bind();
loadData()
  .then(() => startDataPolling())
  .catch((err) => {
    const el = document.getElementById('updated');
    if (el) el.textContent = err.message || String(err);
  });
