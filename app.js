// 是男人就来单挑 - Game Logic (v3)

const API_BASE = ''; // Cloudflare 国内不可用，改用 URL 分享

function encodeTeamForShare(teamData) {
  const json = JSON.stringify({
    ovr: teamData.ovr,
    grade: teamData.grade,
    tier: teamData.tier,
    record: teamData.record,
    roster: teamData.roster.filter(Boolean).map(p => ({
      name: p.name,
      rating: p.rating,
      pos: p.pos,
      positions: p.positions,
      assignedPos: p.assignedPos,
      era: p.era,
      team: p.team,
      pts: p.pts, reb: p.reb, ast: p.ast,
      stl: p.stl, blk: p.blk
    }))
  });
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeTeamFromShare(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to decode team:', e);
    return null;
  }
}

function generateShareLink(teamData) {
  const encoded = encodeTeamForShare(teamData);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?team=${encoded}`;
}

function getSharedTeamFromURL() {
  const params = new URLSearchParams(window.location.search);
  const teamData = params.get('team');
  if (teamData) return decodeTeamFromShare(teamData);
  return null;
}

async function apiCall(path, options = {}) {
  if (!API_BASE) return null;
  try {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    return res.json();
  } catch (e) {
    console.warn('API call failed:', e);
    return null;
  }
}

async function saveTeamToCloud(teamData) {
  return apiCall('/api/teams', {
    method: 'POST',
    body: JSON.stringify(teamData),
  });
}

async function loadAllTeams() {
  const data = await apiCall('/api/teams');
  return data?.teams || [];
}

async function loadTeamById(id) {
  const data = await apiCall('/api/teams/' + id);
  return data?.team || null;
}

async function generateReports(challengeData) {
  const data = await apiCall('/api/challenge', {
    method: 'POST',
    body: JSON.stringify(challengeData),
  });
  return data?.reports || [];
}

const REPORT_TEMPLATES = {
  blowout: [
    '第{gameNum}节，{winner}的{star}统治全场，拿下{pts}分{reb}篮板{ast}助攻。{loser}毫无还手之力，{score}轻松拿下。',
    '{winner}从开场就压制{loser}，{star}里突外投不可阻挡。{score}，一场毫无悬念的胜利。',
    '{star}狂砍{pts}分{reb}篮板，{winner}把{loser}打花了！{score}，碾压局。',
  ],
  medium: [
    '第{gameNum}节，{winner}的{star}发挥出色，贡献{pts}分{reb}篮板{ast}助攻。{loser}努力追赶但差距渐大，{score}落败。',
    '{winner}在{star}带领下稳扎稳打，第三节拉开比分。{score}，{loser}追分未果。',
    '{star}手感火热，连中三记三分。{winner}建立两位数优势，{score}收下比赛。',
  ],
  close: [
    '关键时刻{star}命中准绝杀！{winner}以{score}险胜{loser}，太刺激了！',
    '最后十秒{star}突破上篮命中反超！{winner}{score}惊险拿下第{gameNum}节。',
    '比分胶着到最后，{star}一记干拔三分锁定胜局！{score}，{winner}拿下关键一役。',
    '{loser}一度领先5分，但{star}末节独得{endPts}分完成逆转！{score}，大逆转！',
  ],
  buzzer: [
    '🔥绝杀！最后0.8秒{star}接球就投，三分命中！{winner}{score}绝杀{loser}！全场沸腾！',
    '🔥压哨绝杀！{star}后撤步三分出手——进了！{winner}{score}绝杀！太疯狂了！',
  ],
};

function generateGameReport(g) {
  const diff = Math.abs(g.myPts - g.cpuPts);
  const winner = g.myWin ? '你' : '对手';
  const loser = g.myWin ? '对手' : '你';
  const score = `${g.myPts}-${g.cpuPts}`;
  const winnerTeam = g.myWin ? g.myTeam : g.cpuTeam;
  const star = getStarPlayer(winnerTeam);

  let template;
  if (diff <= 3 && Math.random() < 0.4) {
    template = REPORT_TEMPLATES.buzzer[Math.floor(Math.random() * REPORT_TEMPLATES.buzzer.length)];
  } else if (diff < 10) {
    template = REPORT_TEMPLATES.close[Math.floor(Math.random() * REPORT_TEMPLATES.close.length)];
  } else if (diff < 25) {
    template = REPORT_TEMPLATES.medium[Math.floor(Math.random() * REPORT_TEMPLATES.medium.length)];
  } else {
    template = REPORT_TEMPLATES.blowout[Math.floor(Math.random() * REPORT_TEMPLATES.blowout.length)];
  }

  let report = template
    .replace('{gameNum}', g.num)
    .replace('{winner}', winner)
    .replace('{loser}', loser)
    .replace('{star}', star.name)
    .replace('{score}', score)
    .replace('{pts}', star.pts)
    .replace('{reb}', star.reb)
    .replace('{ast}', star.ast)
    .replace('{endPts}', Math.max(Math.round(star.pts * 0.4), 8));

  if (g.isClincher) {
    const sWins = g.myWins, cWins = g.cpuWins;
    const winSide = g.myWin ? '你' : '对手';
    const loseSide = g.myWins + g.cpuWins - 4;
    report += ` 系列赛${winSide}4-${loseSide}拿下总冠军！`;
  }

  return report;
}

function getStarPlayer(team) {
  const players = Object.values(team).filter(Boolean);
  if (players.length === 0) return { name: '某球员', pts: 25, reb: 8, ast: 6 };
  const sorted = [...players].sort((a, b) =>
    ((b.pts||0)+(b.reb||0)*0.8+(b.ast||0)*0.6) - ((a.pts||0)+(a.reb||0)*0.8+(a.ast||0)*0.6)
  );
  const s = sorted[0];
  return {
    name: s.name,
    pts: Math.round((s.pts||25) + (Math.random()-0.5)*10),
    reb: Math.round((s.reb||8) + (Math.random()-0.5)*4),
    ast: Math.round((s.ast||6) + (Math.random()-0.5)*4),
  };
}

let NBA_DATA = null;

(function loadData() {
  if (typeof NBA_DATA_RAW === 'undefined') {
    console.error('NBA_DATA_RAW not loaded');
    return;
  }
  const result = {};
  NBA_DATA_RAW.forEach(p => {
    const era = p.era;
    const team = p.team;
    if (!result[era]) result[era] = {};
    if (!result[era][team]) result[era][team] = [];
    result[era][team].push({
      name: p.cname || p.player,
      enName: p.player,
      pos: p.pos,
      positions: p.positions || [],
      stats: { pts: p.ppg, reb: p.rpg, ast: p.apg, stl: p.spg, blk: p.bpg }
    });
  });
  NBA_DATA = result;
  console.log('NBA_DATA loaded:', Object.keys(NBA_DATA).length, 'eras,',
    Object.values(NBA_DATA).reduce((sum, d) => sum + Object.keys(d).length, 0), 'teams');
})();

const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
const MAX_ROUNDS = 5;
const STAT_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk'];

const ERA_BENCHMARKS = {
  "1960s": { pts: 30, reb: 18, ast: 8, stl: 1.8, blk: 1.8 },
  "1970s": { pts: 28, reb: 13, ast: 9, stl: 2, blk: 2 },
  "1980s": { pts: 28, reb: 11, ast: 11, stl: 2.2, blk: 2 },
  "1990s": { pts: 27, reb: 11, ast: 9, stl: 2, blk: 2 },
  "2000s": { pts: 27, reb: 11, ast: 9, stl: 2, blk: 2 },
  "2010s": { pts: 28, reb: 11, ast: 9, stl: 1.8, blk: 1.8 },
  "2020s": { pts: 28, reb: 11, ast: 9, stl: 1.8, blk: 1.8 },
};

const POSITION_WEIGHTS = {
  PG: { pts: 0.4, reb: 0.1, ast: 0.35, stl: 0.1, blk: 0.05 },
  SG: { pts: 0.45, reb: 0.1, ast: 0.2, stl: 0.2, blk: 0.05 },
  SF: { pts: 0.45, reb: 0.15, ast: 0.2, stl: 0.15, blk: 0.05 },
  PF: { pts: 0.4, reb: 0.3, ast: 0.1, stl: 0.1, blk: 0.1 },
  C: { pts: 0.4, reb: 0.35, ast: 0.1, stl: 0.05, blk: 0.1 },
};

const TEAM_CN = {
  ATL: "老鹰", BKN: "篮网", BOS: "凯尔特人", CHA: "黄蜂", CHI: "公牛",
  CLE: "骑士", DAL: "独行侠", DEN: "掘金", DET: "活塞", GSW: "勇士",
  HOU: "火箭", IND: "步行者", LAC: "快船", LAL: "湖人", MEM: "灰熊",
  MIA: "热火", MIL: "雄鹿", MIN: "森林狼", NOP: "鹈鹕", NYK: "尼克斯",
  OKC: "雷霆", ORL: "魔术", PHI: "76人", PHX: "太阳", POR: "开拓者",
  SAC: "国王", SAS: "马刺", TOR: "猛龙", UTA: "爵士", WAS: "奇才",
  "金霸王": "金霸王"
};

const TEAM_COLORS = {
  "ATL": ["#b42b33","#c76169"],"BKN": ["#c6c6c6","#505050"],"BOS": ["#488a50","#223425"],
  "CHA": ["#25225a","#384a7b"],"CHI": ["#d93831","#da2f2e"],"CLE": ["#860038","#BC945C"],
  "DAL": ["#2d6ab7","#c5cdd4"],"DEN": ["#418fde","#418fde"],"DET": ["#c42e47","#254f9d"],
  "GSW": ["#eeba4b","#283f85"],"HOU": ["#ad342c","#ffffff"],"IND": ["#eac962","#142356"],
  "LAC": ["#002650","#0b3666"],"LAL": ["#f1bc4b","#50247c"],"MEM": ["#14163b","#5d75ad"],
  "MIA": ["#a32a2e","#261c22"],"MIL": ["#dcd4b4","#304c38"],"MIN": ["#b6c8d3","#244f7d"],
  "NOP": ["#ae9b6d","#ae9b6d"],"NYK": ["#d86a34","#1c399f"],"OKC": ["#4876b6","#1c233d"],
  "ORL": ["#3053ad","#3053ae"],"PHI": ["#3063b0","#2f61af"],"PHX": ["#f6ca57","#c86d36"],
  "POR": ["#ab2f32","#6a1d1f"],"SAC": ["#55277f","#3a0e63"],"SAS": ["#c7cdd4","#34393d"],
  "TOR": ["#a2a2a4","#b12a32"],"UTA": ["#15203e","#14223e"],"WAS": ["#16213d","#bd2a33"],
  "金霸王": ["#d4a017","#1a1a2e"]
};

const TEAM_GRADE_BANDS = [
  { min: 80, grade: "S", label: "完美赛季", color: "#a855f7" },
  { min: 72, grade: "A+", label: "历史级强队", color: "#22c55e" },
  { min: 62, grade: "A", label: "王朝球队", color: "#22c55e" },
  { min: 57, grade: "B", label: "有力竞争者", color: "#3b82f6" },
  { min: 50, grade: "C", label: "季后赛球队", color: "#f59e0b" },
  { min: 40, grade: "D", label: "乐透球队", color: "#64748b" },
  { min: 0, grade: "F", label: "摆烂大军", color: "#ef4444" },
];

const INTANGIBLES = new Set([
  "larry bird","tim duncan","kevin durant","magic johnson",
  "shaquille o'neal","hakeem olajuwon","bill russell","kobe bryant",
  "oscar robertson","karl malone","kevin garnett","isiah thomas",
  "tony parker","manu ginobili","draymond green","scottie pippen",
  "dennis rodman","stephen curry","nikola jokic","dirk nowitzki",
]);

let game = {
  round: 0,
  roster: [],
  slots: { PG: null, SG: null, SF: null, PF: null, C: null },
  usedDecades: [],
  usedCombos: [],
  skipTeam: 1,
  skipDecade: 1,
  currentTeam: null,
  currentDecade: null,
  spun: false,
  wins: 0,
  losses: 0,
  grade: '',
  tier: '',
};

let _filterTab = 'all';
let _topPool = [];
let pendingPick = null;
let moveState = null;

function teamCN(abbr) { return TEAM_CN[abbr] || abbr; }
function isNum(v) { return typeof v === 'number' && !Number.isNaN(v); }
function getPositions(posStr) {
  if (!posStr) return [];
  return posStr.split('/').map(p => p.trim()).filter(p => POS_ORDER.includes(p));
}

function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.1
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(243,156,18,${p.o})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startGame() {
  closePoster();
  game = {
    round: 0, roster: [],
    slots: { PG: null, SG: null, SF: null, PF: null, C: null },
    usedDecades: [], usedCombos: [],
    skipTeam: 1, skipDecade: 1,
    currentTeam: null, currentDecade: null, spun: false,
    wins: 0, losses: 0, grade: '', tier: '',
  };
  pendingPick = null; moveState = null;
  showScreen('screen-game');
  renderRosterBar();
  nextRound();
}

function renderRosterBar() {
  const bar = document.getElementById('rosterBar');
  const topRow = ['PG', 'SG'];
  const bottomRow = ['SF', 'C', 'PF'];

  function renderSlot(pos) {
    const p = game.slots[pos];
    const isTarget = !p && pendingPick && pendingPick.positions.includes(pos);
    const isMoveTarget = !p && moveState && moveState.targetPositions.includes(pos);
    const isMoveSource = p && moveState && moveState.currentPos === pos;
    let extraCls = '';
    if (isTarget || isMoveTarget) extraCls = ' highlight clickable';
    if (isMoveSource) extraCls = ' move-source clickable';

    if (p) {
      const colors = TEAM_COLORS[p.team] || ['#333', '#555'];
      const style = `background:linear-gradient(135deg,${colors[0]},${colors[1]});border-color:${colors[0]};box-shadow:0 0 12px ${colors[0]}66;`;
      return `<div class="pos-slot filled${extraCls}" style="${style}" onclick="onFilledSlotClick('${pos}')">
        <span class="slot-player-name">${p.name.split('-').pop()}</span>
        <span class="slot-team-decade">${teamCN(p.team)} · ${p.decade}</span>
      </div>`;
    }
    return `<div class="pos-slot${extraCls}" onclick="onEmptySlotClick('${pos}')">
      <span class="pos-label">${pos}</span>
    </div>`;
  }

  let html = '<div class="roster-row">';
  topRow.forEach(p => html += renderSlot(p));
  html += '</div><div class="roster-row">';
  bottomRow.forEach(p => html += renderSlot(p));
  html += '</div>';
  bar.innerHTML = html;
  document.getElementById('skipTeamCount').textContent = game.skipTeam + '次';
  document.getElementById('skipDecadeCount').textContent = game.skipDecade + '次';
}

function nextRound() {
  if (game.round >= MAX_ROUNDS) { runSimulation(); return; }
  game.spun = false;
  game.currentTeam = null;
  game.currentDecade = null;

  document.getElementById('roundLabel').textContent = `第 ${game.round + 1} / ${MAX_ROUNDS} 轮`;
  document.getElementById('spinBtn').disabled = false;
  document.getElementById('spinBtn').textContent = '🎰 随机';
  document.getElementById('skipTeamBtn').disabled = true;
  document.getElementById('skipDecadeBtn').disabled = true;
  document.getElementById('playerSection').style.display = 'none';
  document.getElementById('teamReelText').textContent = '???';
  document.getElementById('decadeReelText').textContent = '???';
  document.getElementById('teamReel').classList.remove('spinning');
  document.getElementById('decadeReel').classList.remove('spinning');
  document.getElementById('playerHint').textContent = '';

  renderRosterBar();
}

function spinSlot() {
  if (game.spun) return;
  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = true;
  spinBtn.textContent = '🎰 转动中...';

  const teamReel = document.getElementById('teamReel');
  const decadeReel = document.getElementById('decadeReel');
  const teamText = document.getElementById('teamReelText');
  const decadeText = document.getElementById('decadeReelText');

  teamReel.classList.add('spinning');
  decadeReel.classList.add('spinning');

  const allDecades = Object.keys(NBA_DATA).filter(d => d !== '1950s');
  let spinCount = 0;

  const spinInterval = setInterval(() => {
    const randDecade = allDecades[Math.floor(Math.random() * allDecades.length)];
    const decadeTeams = Object.keys(NBA_DATA[randDecade] || {});
    const randTeam = decadeTeams[Math.floor(Math.random() * decadeTeams.length)];
    teamText.textContent = teamCN(randTeam);
    decadeText.textContent = randDecade;
    spinCount++;

    if (spinCount > 20) {
      clearInterval(spinInterval);
      const result = getSlotResult();
      game.currentTeam = result.team;
      game.currentDecade = result.decade;
      game.usedCombos.push(result.decade + '|' + result.team);

      teamText.textContent = teamCN(result.team);
      decadeText.textContent = result.decade;
      teamReel.classList.remove('spinning');
      decadeReel.classList.remove('spinning');
      teamReel.style.borderColor = 'var(--green)';
      decadeReel.style.borderColor = 'var(--green)';

      game.spun = true;
      spinBtn.textContent = '✓ 锁定';

      document.getElementById('skipTeamBtn').disabled = game.skipTeam <= 0;
      document.getElementById('skipDecadeBtn').disabled = game.skipDecade <= 0;

      setTimeout(() => showPlayers(result.team, result.decade), 800);
    }
  }, 80);
}

function getSlotResult() {
  const usedSet = new Set(game.usedCombos || []);
  const allCombos = [];
  for (const decade of Object.keys(NBA_DATA).filter(d => d !== '1950s')) {
    for (const team of Object.keys(NBA_DATA[decade])) {
      if (!usedSet.has(decade + '|' + team)) {
        allCombos.push({ team, decade });
      }
    }
  }
  if (allCombos.length === 0) {
    const decades = Object.keys(NBA_DATA).filter(d => d !== '1950s');
    const d = decades[0];
    const t = Object.keys(NBA_DATA[d])[0];
    return { team: t, decade: d };
  }
  return allCombos[Math.floor(Math.random() * allCombos.length)];
}

function directSkip(type) {
  if (pendingPick) { pendingPick = null; renderRosterBar(); }
  document.getElementById('spinBtn').disabled = true;

  if (type === 'team' && game.skipTeam > 0) {
    game.skipTeam--;
    const decadeTeams = Object.keys(NBA_DATA[game.currentDecade] || {});
    const usedSet = new Set(game.usedCombos);
    const otherTeams = decadeTeams.filter(t => !usedSet.has(game.currentDecade + '|' + t));
    const finalTeam = otherTeams.length > 0
      ? otherTeams[Math.floor(Math.random() * otherTeams.length)]
      : decadeTeams.find(t => t !== game.currentTeam) || decadeTeams[0];

    animateReel('teamReelText', decadeTeams, teamCN, () => {
      game.currentTeam = finalTeam;
      document.getElementById('teamReelText').textContent = teamCN(finalTeam);
      document.getElementById('teamReel').style.borderColor = 'var(--green)';
      finishSkip();
    });
  } else if (type === 'decade' && game.skipDecade > 0) {
    game.skipDecade--;
    const teamName = game.currentTeam;
    const teamDecades = Object.keys(NBA_DATA).filter(d => d !== '1950s' && NBA_DATA[d] && NBA_DATA[d][teamName]);
    const usedSet = new Set(game.usedCombos);
    const otherDecades = teamDecades.filter(d => !usedSet.has(d + '|' + teamName));
    if (otherDecades.length === 0) { finishSkip(); return; }
    const finalDecade = otherDecades[Math.floor(Math.random() * otherDecades.length)];

    animateReel('decadeReelText', teamDecades, id => id, () => {
      game.currentDecade = finalDecade;
      document.getElementById('decadeReelText').textContent = finalDecade;
      document.getElementById('decadeReel').style.borderColor = 'var(--green)';
      finishSkip();
    });
  }
}

function animateReel(elementId, pool, formatter, callback) {
  const el = document.getElementById(elementId);
  const reel = elementId === 'teamReelText' ? document.getElementById('teamReel') : document.getElementById('decadeReel');
  reel.classList.add('spinning');
  let count = 0;
  const interval = setInterval(() => {
    el.textContent = formatter(pool[Math.floor(Math.random() * pool.length)]);
    count++;
    if (count > 15) {
      clearInterval(interval);
      reel.classList.remove('spinning');
      callback();
    }
  }, 80);
}

function finishSkip() {
  game.usedCombos.push(game.currentDecade + '|' + game.currentTeam);
  renderRosterBar();
  document.getElementById('skipTeamBtn').disabled = game.skipTeam <= 0;
  document.getElementById('skipDecadeBtn').disabled = game.skipDecade <= 0;
  document.getElementById('playerHint').textContent = `${teamCN(game.currentTeam)} · ${game.currentDecade} (已跳过)`;
  showPlayers(game.currentTeam, game.currentDecade);
}

function setFilterTab(tab) {
  _filterTab = tab;
  document.querySelectorAll('.filter-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  if (game.currentTeam && game.currentDecade) {
    renderPlayerGrid(game.currentTeam, game.currentDecade);
  }
}

function renderPlayerGrid(team, decade) {
  const grid = document.getElementById('playerGrid');
  if (_filterTab === 'all') {
    const players = NBA_DATA[decade] ? (NBA_DATA[decade][team] || []) : [];
    const draftedNames = game.roster.map(r => r.name);
    let all = players.filter(p => !draftedNames.includes(p.name));
    all.sort((a, b) => (b.stats.pts + b.stats.reb + b.stats.ast) - (a.stats.pts + a.stats.reb + a.stats.ast));
    _topPool = all.slice(0, 20);
  }

  let display = _filterTab === 'all' ? _topPool : _topPool.filter(p => {
    const posList = p.positions && p.positions.length > 0 ? p.positions : (p.pos ? p.pos.split('/') : []);
    if (_filterTab === 'g') return posList.some(pos => pos === 'PG' || pos === 'SG');
    if (_filterTab === 'f') return posList.some(pos => pos === 'SF' || pos === 'PF');
    if (_filterTab === 'c') return posList.some(pos => pos === 'C');
    return false;
  });

  if (display.length === 0) {
    grid.innerHTML = '<div class="no-players"><div class="icon">😅</div><p>该位置没有可用球员</p></div>';
    document.getElementById('playerHint').textContent = '该位置没有可用球员';
    return;
  }

  display = [...display].sort(() => Math.random() - 0.5);

  document.getElementById('playerHint').textContent = '点击球员加入阵容';
  grid.innerHTML = display.map(p => {
    const posDisplay = p.pos || '??';
    const positionsArr = p.positions && p.positions.length > 0 ? p.positions : [posDisplay];
    const posBadges = positionsArr.map(pos => `<span class="pos-badge">${pos}</span>`).join('');
    const posData = encodeURIComponent(JSON.stringify(positionsArr));
    return `<div class="player-card" data-positions="${posData}" onclick="selectPlayer(this, '${p.name.replace(/'/g, "\\'")}', '${posDisplay}', ${p.stats.pts}, ${p.stats.reb}, ${p.stats.ast}, ${p.stats.stl ?? 0}, ${p.stats.blk ?? 0})">
      <div class="player-name">${p.name}</div>
      <div class="player-positions">${posBadges}</div>
      <div class="player-team">${teamCN(team)} · ${decade}</div>
    </div>`;
  }).join('');
}

function showPlayers(team, decade) {
  document.getElementById('playerSection').style.display = 'block';
  _filterTab = 'all';
  document.querySelectorAll('.filter-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === 'all'));
  renderPlayerGrid(team, decade);
}

function selectPlayer(el, name, pos, pts, reb, ast, stl, blk) {
  if (pendingPick || moveState) { pendingPick = null; moveState = null; }
  document.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  let positions;
  try { positions = JSON.parse(decodeURIComponent(el.dataset.positions)); } catch(e) { positions = getPositions(pos); }
  if (!positions || positions.length === 0) positions = getPositions(pos);

  const emptyEligible = positions.filter(p => !game.slots[p]);
  if (emptyEligible.length === 0) {
    el.classList.remove('selected');
    document.getElementById('playerHint').textContent = `⚠️ ${name} 的可选位置 (${positions.join('/')}) 已满！`;
    return;
  }

  pendingPick = { name, pos, pts, reb, ast, stl, blk, positions };
  document.getElementById('playerHint').textContent = `点击上方闪烁的方框将 ${name} 放入 (${emptyEligible.join('/')})`;
  renderRosterBar();
}

function onEmptySlotClick(pos) {
  if (pendingPick && pendingPick.positions.includes(pos)) {
    confirmDraftWith({ ...pendingPick, assignedPos: pos });
  } else if (moveState && moveState.targetPositions.includes(pos)) {
    const player = moveState.player;
    game.slots[pos] = player;
    game.slots[moveState.currentPos] = null;
    player.assignedPos = pos;
    moveState = null;
    renderRosterBar();
    document.getElementById('playerHint').textContent = `已移动 ${player.name} 到 ${pos}`;
  } else {
    pendingPick = null; moveState = null;
    document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
    renderRosterBar();
    document.getElementById('playerHint').textContent = '点击球员加入阵容';
  }
}

function onFilledSlotClick(pos) {
  const player = game.slots[pos];
  if (!player) return;
  if (pendingPick) { pendingPick = null; renderRosterBar(); return; }
  if (moveState) {
    if (moveState.currentPos === pos) { moveState = null; renderRosterBar(); return; }
  }

  const playerPositions = player.positions || getPositions(player.pos);
  const emptyEligible = playerPositions.filter(p => p !== pos && !game.slots[p]);
  if (emptyEligible.length === 0) return;

  moveState = { player, currentPos: pos, targetPositions: emptyEligible };
  document.getElementById('playerHint').textContent = `点击闪烁的方框移动 ${player.name.split('-').pop()}`;
  renderRosterBar();
}

function confirmDraftWith(pick) {
  pendingPick = null; moveState = null;
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));

  const playerPositions = pick.positions || getPositions(pick.pos);
  game.slots[pick.assignedPos] = {
    name: pick.name, pos: pick.pos, positions: playerPositions,
    assignedPos: pick.assignedPos,
    team: game.currentTeam, decade: game.currentDecade,
    pts: pick.pts, reb: pick.reb, ast: pick.ast, stl: pick.stl, blk: pick.blk
  };
  game.roster.push(game.slots[pick.assignedPos]);
  game.usedDecades.push(game.currentDecade);
  game.round++;

  renderRosterBar();
  document.getElementById('playerSection').style.display = 'none';
  document.getElementById('spinBtn').disabled = true;
  document.getElementById('skipTeamBtn').disabled = true;
  document.getElementById('skipDecadeBtn').disabled = true;
  document.getElementById('playerHint').textContent = `✓ ${pick.name} → ${pick.assignedPos} 已选入！`;

  setTimeout(() => {
    if (game.round >= MAX_ROUNDS) {
      runSimulation();
    } else {
      document.getElementById('teamReel').style.borderColor = 'var(--gold)';
      document.getElementById('decadeReel').style.borderColor = 'var(--gold)';
      nextRound();
    }
  }, 800);
}

function playerRating(p) {
  // Custom players can have a fixed rating (e.g. 金霸王 team)
  if (isNum(p.customRating)) {
    return Math.round(p.customRating * 10) / 10;
  }
  const bench = ERA_BENCHMARKS[p.decade] || ERA_BENCHMARKS["2020s"];
  const baseKey = p.positions?.[0] || p.pos || "SF";
  const weights = { ...(POSITION_WEIGHTS[baseKey] || POSITION_WEIGHTS.SF) };

  const missing = ['stl', 'blk'].filter(k => !isNum(p[k]));
  if (missing.length > 0) {
    const kept = STAT_KEYS.filter(k => !missing.includes(k)).reduce((sum, k) => sum + weights[k], 0);
    const scale = kept > 0 ? 1 / kept : 1;
    ['pts', 'reb', 'ast'].forEach(k => { weights[k] *= scale; });
    missing.forEach(k => { weights[k] = 0; });
  }

  let n = 0;
  STAT_KEYS.forEach(k => {
    const v = p[k];
    if (isNum(v)) {
      let ratio = v / bench[k];
      if (ratio > 1) ratio = Math.pow(ratio, 1.25);
      n += weights[k] * ratio;
    }
  });

  const base = 60 + 40 * n;
  const posCount = p.positions?.length || 1;
  const versatility = (posCount - 1) * 3;
  const intangibles = INTANGIBLES.has((p.enName ?? p.name ?? '').toLowerCase()) ? 2.5 : 0;

  return Math.min(100, Math.round((base + versatility + intangibles) * 10) / 10);
}
// 别名函数：修复 getPlayerRating is not defined
// shareResult / handleShareLink / runSimulation 中调用的是 getPlayerRating，
// 实际评分逻辑在 playerRating，这里做一层转发即可。
function getPlayerRating(p) {
  return playerRating(p);
}
function calcRecord(slots) {
  const roster = ['PG', 'SG', 'SF', 'PF', 'C'].map(pos => slots[pos]).filter(Boolean);
  if (roster.length === 0) return { wins: 0, losses: 82, grade: 'F', tier: '摆烂大军', color: '#ef4444', ovr: 0 };

  const ratings = roster.map(p => playerRating(p));
  const product = ratings.reduce((a, b) => a * b, 1);
  const geoMean = Math.pow(product, 1 / ratings.length);
  const teamOvr = Math.round(geoMean * 1.1 * 10) / 10;

  let wins = Math.round(82 * Math.pow(Math.min(teamOvr / 110, 1), 2.2));
  let losses = 82 - wins;

  if (wins === 64) { wins = 65; losses = 17; }
  else if (wins === 18) { wins = 17; losses = 65; }
  if (wins === 54) { wins = 55; losses = 27; }
  else if (losses === 54) { wins = 27; losses = 55; }

  const band = TEAM_GRADE_BANDS.find(b => wins >= b.min) || TEAM_GRADE_BANDS[TEAM_GRADE_BANDS.length - 1];
  return { wins, losses, grade: band.grade, tier: band.label, color: band.color, ovr: teamOvr, ratings };
}

function runSimulation() {
  showScreen('screen-result');

  const result = calcRecord(game.slots);
  game.wins = result.wins;
  game.losses = result.losses;
  game.grade = result.grade;
  game.tier = result.tier;
  game.ovr = result.ovr;

  document.getElementById('finalRecord').textContent = `${result.wins}-${result.losses}`;
  document.getElementById('resultGrade').textContent = result.grade;
  document.getElementById('resultGrade').style.color = result.color;
  document.getElementById('resultTier').textContent = result.tier;
  document.getElementById('resultTier').style.color = result.color;

  // Render roster
  const rosterDiv = document.getElementById('rosterFinal');
  const topRow = ['PG', 'SG'];
  const bottomRow = ['SF', 'C', 'PF'];

  function renderSlot(pos) {
    const p = game.slots[pos];
    if (!p) return '';
    const colors = TEAM_COLORS[p.team] || ['#333', '#555'];
    const style = `background:linear-gradient(135deg,${colors[0]},${colors[1]});border-color:${colors[0]};`;
    return `<div class="result-slot" style="${style}">
      <span class="slot-player-name">${p.name.split('-').pop()}</span>
      <span class="slot-team-decade">${teamCN(p.team)} · ${p.decade}</span>
    </div>`;
  }

  let html = '<div class="result-row">';
  topRow.forEach(pos => html += renderSlot(pos));
  html += '</div><div class="result-row">';
  bottomRow.forEach(pos => html += renderSlot(pos));
  html += '</div>';
  rosterDiv.innerHTML = html;

  // Save to history (also pushes to cloud)
  saveToHistory();

  // Show share link area if cloud enabled
  if (API_BASE) {
    const area = document.getElementById('shareLinkArea');
    area.style.display = 'block';
    document.getElementById('shareLinkUrl').textContent = '保存到云端后显示...';
    const slotsData = {};
    for (const pos of POS_ORDER) {
      const p = game.slots[pos];
      if (p) {
        slotsData[pos] = {
          name: p.name, enName: p.enName || p.name,
          pos: p.pos, positions: p.positions || [p.pos],
          team: p.team, decade: p.decade,
          pts: p.pts, reb: p.reb, ast: p.ast,
          stl: p.stl || 0, blk: p.blk || 0, assignedPos: pos,
        };
      }
    }
    const rosterList = POS_ORDER.map(pos => {
      const p = game.slots[pos];
      return p ? { name: p.name, pos: p.pos, positions: p.positions || [p.pos], team: p.team, era: p.decade, pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl || 0, blk: p.blk || 0, assignedPos: pos, rating: getPlayerRating(p) } : null;
    });
    const teamData = { ovr: result.ovr, grade: result.grade, tier: result.tier, record: `${result.wins}-${result.losses}`, roster: rosterList };
    const shareUrl = generateShareLink(teamData);
    document.getElementById('shareLinkUrl').textContent = shareUrl;
  }

  if (result.wins >= 80) launchConfetti();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('duel_history') || '[]');
  } catch { return []; }
}

function saveToHistory() {
  const history = getHistory();
  const slotsData = {};
  for (const pos of POS_ORDER) {
    const p = game.slots[pos];
    if (p) {
      slotsData[pos] = {
        name: p.name, enName: p.enName || p.name,
        pos: p.pos, positions: p.positions || [p.pos],
        team: p.team, decade: p.decade,
        pts: p.pts, reb: p.reb, ast: p.ast,
        stl: p.stl || 0, blk: p.blk || 0,
        assignedPos: pos,
      };
    }
  }

  const result = calcRecord(game.slots);
  const entry = {
    id: Date.now(),
    record: `${result.wins}-${result.losses}`,
    grade: result.grade,
    tier: result.tier,
    ovr: result.ovr,
    slots: slotsData,
    date: new Date().toLocaleString('zh-CN'),
  };
  history.unshift(entry);
  if (history.length > 50) history.pop();
  localStorage.setItem('duel_history', JSON.stringify(history));
  localStorage.setItem('duel_lastGame', JSON.stringify({
    ...game, slots: game.slots, ovr: result.ovr,
  }));

  if (API_BASE) {
    saveTeamToCloud({
      record: entry.record,
      grade: entry.grade,
      tier: entry.tier,
      ovr: entry.ovr,
      roster: slotsData,
    }).then(res => {
      if (res?.shareUrl) console.log('Cloud saved:', res.shareUrl);
    });
  }
}

function openHistory() {
  showScreen('screen-history');
  renderHistoryList();
}

function openHistoryFromHome() {
  showScreen('screen-history');
  renderHistoryList();
}

function renderHistoryList() {
  const history = getHistory();
  const list = document.getElementById('historyList');

  if (history.length === 0) {
    list.innerHTML = '<div class="no-players"><div class="icon">📋</div><p>暂无历史战绩，先去组队吧！</p></div>';
    return;
  }

  list.innerHTML = history.map((h, i) => {
    const roster = h.slots || h.roster || {};
    const rosterHtml = Object.values(roster).filter(Boolean).map(p =>
      `<span class="pos-badge" style="background:linear-gradient(135deg,var(--btn-orange),var(--orange-light));color:#fff;">${p.name.split('-').pop()}</span>`
    ).join('');
    return `<div class="history-item">
      <div class="history-header">
        <span class="history-record">${h.record}</span>
        <span class="history-grade" style="color:${TEAM_GRADE_BANDS.find(b => b.grade === h.grade)?.color || '#fff'}">${h.grade}</span>
        <span class="history-tier">${h.tier}</span>
      </div>
      <div class="history-roster">${rosterHtml}</div>
      <div class="history-date">${h.date}</div>
    </div>`;
  }).join('');
}

async function shareResult() {
  const result = calcRecord(game.slots);
  const rosterList = POS_ORDER.map(pos => {
    const p = game.slots[pos];
    return p ? { name: p.name, pos: p.pos, positions: p.positions || [p.pos], team: p.team, era: p.decade, pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl || 0, blk: p.blk || 0, assignedPos: pos, rating: getPlayerRating(p) } : null;
  });
  const teamData = { ovr: result.ovr, grade: result.grade, tier: result.tier, record: `${result.wins}-${result.losses}`, roster: rosterList };
  const shareUrl = generateShareLink(teamData);

  const shareText = `是男人就来单挑！\n\n${game.wins}-${game.losses} ${game.grade}级 ${game.tier}\n\n阵容：${POS_ORDER.map(pos => {
    const p = game.slots[pos];
    return p ? `${p.name.split('-').pop()}(${pos})` : '';
  }).filter(Boolean).join(' | ')}\n\n${shareUrl ? '挑战链接：' + shareUrl + '\n\n' : ''}是男人就来单挑，敢来挑战吗？`;

  const copyText = () => {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(shareText);
    }
    const ta = document.createElement('textarea');
    ta.value = shareText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  };

  copyText().then(() => {
    alert(`战绩已复制！分享链接已生成 \n\n${shareUrl}`);
  }).catch(() => {
    alert('复制失败，请手动复制');
  });
}

function copyShareLink() {
  const url = document.getElementById('shareLinkUrl').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('链接已复制！'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = url; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    alert('链接已复制！');
  }
}

function openTeamSelect() {
  showScreen('screen-select');
  renderTeamSelect();
}

async function renderTeamSelect() {
  const list = document.getElementById('teamSelectList');
  list.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">加载中...</div>';

  let allTeams = [];

  const history = getHistory();
  const localTeams = history.map(h => ({
    id: 'local_' + h.id,
    record: h.record,
    grade: h.grade,
    tier: h.tier,
    roster: h.slots || {},
    date: h.date,
    source: 'local',
  }));
  allTeams = allTeams.concat(localTeams);

  if (API_BASE) {
    try {
      const cloudTeams = await loadAllTeams();
      const mapped = cloudTeams.map(t => ({ ...t, source: 'cloud' }));
      const cloudIds = new Set(mapped.map(t => t.id));
      allTeams = allTeams.filter(t => !cloudIds.has(t.id)).concat(mapped);
    } catch (e) {
      console.warn('Failed to load cloud teams:', e);
    }
  }

  const seen = new Set();
  allTeams = allTeams.filter(t => {
    const key = t.record + '|' + t.grade + '|' + JSON.stringify(Object.keys(t.roster).sort());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  allTeams.sort((a, b) => (b.date || 0) - (a.date || 0));

  if (allTeams.length === 0) {
    list.innerHTML = '<div class="no-players"><div class="icon"></div><p>暂无历史球队，先去组队吧！</p></div>';
    return;
  }

  list.innerHTML = allTeams.map(t => {
    const rosterHtml = Object.values(t.roster).filter(Boolean).map(p =>
      `<span class="pos-badge" style="background:linear-gradient(135deg,var(--btn-orange),var(--orange-light));color:#fff;font-size:10px;">${(p.name||'').split('-').pop()}</span>`
    ).join('');
    return `<div class="history-item" style="cursor:pointer;" onclick="selectChallengeTeam('${t.id}')">
      <div class="history-header">
        <span class="history-record">${t.record}</span>
        <span class="history-grade" style="color:${TEAM_GRADE_BANDS.find(b => b.grade === t.grade)?.color || '#fff'}">${t.grade}</span>
        <span class="history-tier">${t.tier}</span>
        <span style="margin-left:auto;font-size:10px;color:rgba(255,255,255,0.3);">${t.source === 'cloud' ? '☁️' : '💾'} ${t.date || ''}</span>
      </div>
      <div class="history-roster">${rosterHtml}</div>
    </div>`;
  }).join('');
}

let selectedChallengeTeam = null;

function selectChallengeTeam(teamId) {
  const history = getHistory();
  let teamSlots = null;

  if (teamId.startsWith('local_')) {
    const lid = parseInt(teamId.replace('local_', ''));
    const entry = history.find(h => h.id === lid);
    if (entry?.slots) teamSlots = entry.slots;
  } else if (API_BASE) {
    loadTeamById(teamId).then(team => {
      if (team?.roster) {
        teamSlots = team.roster;
        startChallengeWithTeam(teamSlots);
      }
    });
    return;
  }

  if (teamSlots) {
    startChallengeWithTeam(teamSlots);
  }
}

function startChallengeWithTeam(cpuSlots) {
  showScreen('screen-challenge');
  const cpuResult = calcRecord(cpuSlots);

  challengeState = {
    mySlots: { ...game.slots },
    cpuSlots,
    myResult: calcRecord(game.slots),
    cpuResult,
    games: [],
    currentGame: 0,
    myWins: 0,
    cpuWins: 0,
  };

  renderChallengeVS(cpuResult);
  renderChallengeGames();
  setTimeout(simulateNextGame, 500);
}

function handleShareLink() {
  const params = new URLSearchParams(window.location.search);
  const teamData = params.get('team');
  if (!teamData) return false;

  // 有分享链接，进入"被挑战"模式
  const decoded = decodeTeamFromShare(teamData);
  if (decoded?.roster) {
    // 将云端 roster 格式转换为本地格式（兼容 数组 / 对象 两种结构）
    const slots = {};
    for (const pos of POS_ORDER) {
      const p = Array.isArray(decoded.roster)
        ? decoded.roster.find(r => r && (r.assignedPos === pos || r.pos === pos))
        : decoded.roster[pos];
      if (p) {
        slots[pos] = {
          name: p.name, enName: p.enName || p.name,
          pos: p.pos || pos, positions: p.positions || [pos],
          team: p.team || '', decade: p.era || p.decade || '',
          pts: p.pts || 0, reb: p.reb || 0, ast: p.ast || 0,
          stl: p.stl || 0, blk: p.blk || 0, assignedPos: pos,
          rating: p.rating || getPlayerRating(p),
        };
      }
    }
    const result = calcRecord(slots);
    window._sharedChallengeTeam = decoded.roster;
    window._sharedChallengeInfo = { ...decoded, ...result };
    alert(`你收到了一个挑战！\n\n${decoded.record} ${decoded.grade} ${decoded.tier}\n\n请先创建你的队伍来应战！`);
  }
  return true;
}

function generateRandomTeam() {
  const slots = { PG: null, SG: null, SF: null, PF: null, C: null };
  const allDecades = Object.keys(NBA_DATA).filter(d => d !== '1950s');
  const usedCombos = new Set();

  for (const pos of POS_ORDER) {
    let combo;
    let attempts = 0;
    do {
      const decade = allDecades[Math.floor(Math.random() * allDecades.length)];
      const teams = Object.keys(NBA_DATA[decade] || {});
      const team = teams[Math.floor(Math.random() * teams.length)];
      combo = decade + '|' + team;
      attempts++;
    } while (usedCombos.has(combo) && attempts < 20);
    usedCombos.add(combo);

    const [decade, team] = combo.split('|');
    const players = NBA_DATA[decade]?.[team] || [];
    if (players.length === 0) continue;

    const eligible = players.filter(p => {
      const posList = p.positions?.length ? p.positions : [p.pos];
      return posList.includes(pos);
    });

    if (eligible.length > 0) {
      const chosen = eligible[Math.floor(Math.random() * eligible.length)];
      slots[pos] = {
        name: chosen.name,
        enName: chosen.enName,
        pos: chosen.pos,
        positions: chosen.positions || [chosen.pos],
        team,
        decade,
        pts: chosen.stats.pts,
        reb: chosen.stats.reb,
        ast: chosen.stats.ast,
        stl: chosen.stats.stl || 0,
        blk: chosen.stats.blk || 0,
        assignedPos: pos,
      };
    }
  }
  return slots;
}

let challengeState = null;

function startChallenge() {
  openTeamSelect();
}

function renderChallengeVS(cpuResult) {
  const myDiv = document.getElementById('challengeMyTeam');
  const cpuDiv = document.getElementById('challengeCpuTeam');

  function renderMiniTeam(slots, result) {
    const playersHtml = POS_ORDER.map(pos => {
      const p = slots[pos];
      if (!p) return '';
      const colors = TEAM_COLORS[p.team] || ['#333', '#555'];
      return `<div style="width:50px;height:50px;border-radius:8px;background:linear-gradient(135deg,${colors[0]},${colors[1]});display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 4px;border:1px solid ${colors[0]}44;">
        <span style="font-size:9px;color:#fff;">${p.name.split('-').pop()}</span>
        <span style="font-size:8px;color:rgba(255,255,255,0.7);">${pos}</span>
      </div>`;
    }).join('');
    return `<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--orange-light);">${result.wins}-${result.losses} ${result.grade}</div>${playersHtml}`;
  }

  myDiv.innerHTML = `<div style="color:var(--blue-3d);font-size:12px;margin-bottom:4px;">你的队伍</div>${renderMiniTeam(challengeState.mySlots, challengeState.myResult)}`;
  cpuDiv.innerHTML = `<div style="color:var(--red-3d);font-size:12px;margin-bottom:4px;">对手队伍</div>${renderMiniTeam(challengeState.cpuSlots, cpuResult)}`;
}

function simulateNextGame() {
  if (!challengeState) return;
  if (challengeState.myWins >= 4 || challengeState.cpuWins >= 4) {
    renderChallengeFinal();
    return;
  }

  const gameNum = challengeState.currentGame + 1;
  const myPts = simulateGameScore(challengeState.mySlots);
  const cpuPts = simulateGameScore(challengeState.cpuSlots);
  const myWin = myPts > cpuPts;

  if (myWin) challengeState.myWins++;
  else challengeState.cpuWins++;

  const totalWins = challengeState.myWins + challengeState.cpuWins;
  const isClincher = challengeState.myWins >= 4 || challengeState.cpuWins >= 4;

  challengeState.games.push({
    num: gameNum,
    myPts,
    cpuPts,
    myWin,
    myTeam: challengeState.mySlots,
    cpuTeam: challengeState.cpuSlots,
    myWins: challengeState.myWins,
    cpuWins: challengeState.cpuWins,
    isClincher,
  });
  challengeState.currentGame++;

  renderChallengeGames();

  if (challengeState.myWins >= 4 || challengeState.cpuWins >= 4) {
    setTimeout(renderChallengeFinal, 1200);
  } else {
    setTimeout(simulateNextGame, 800);
  }
}

function simulateGameScore(slots) {
  let totalOvr = 0;
  let count = 0;
  const ratings = [];

  for (const pos of POS_ORDER) {
    const p = slots[pos];
    if (p) {
      const r = playerRating(p);
      ratings.push(r);
      totalOvr += r;
      count++;
    }
  }
  if (count === 0) return 70 + Math.floor(Math.random() * 40);

  const avgOvr = totalOvr / count;
  const baseScore = 90 + (avgOvr - 70) * 0.6;
  const variation = (Math.random() - 0.5) * 30;
  const maxRating = Math.max(...ratings);
  const starBoost = (maxRating - avgOvr) * 0.3;

  return Math.round(Math.max(70, Math.min(140, baseScore + variation + starBoost)));
}

function renderChallengeGames() {
  const container = document.getElementById('challengeGames');
  const scoreDiv = document.getElementById('challengeResult');

  scoreDiv.innerHTML = `<div style="font-size:28px;font-weight:900;">
    <span style="color:var(--blue)">${challengeState.myWins}</span>
    <span style="color:var(--text-secondary);margin:0 12px;">-</span>
    <span style="color:var(--pink)">${challengeState.cpuWins}</span>
  </div>
  <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">先赢4场获胜（最多7场）</div>`;

  container.innerHTML = challengeState.games.map(g => {
    const cls = g.myWin ? 'game-win' : 'game-lose';
    const icon = g.myWin ? '✅' : '';
    const report = generateGameReport(g);
    return `<div class="challenge-game ${cls}">
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="game-num">G${g.num}</span>
          <span class="game-score">${g.myPts} - ${g.cpuPts}</span>
          <span class="game-icon">${icon}</span>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px;line-height:1.6;">${report}</div>
      </div>
    </div>`;
  }).join('');
}

function renderChallengeFinal() {
  const resultDiv = document.getElementById('challengeResult');
  const myWin = challengeState.myWins >= 4;

  resultDiv.innerHTML = `
    <div style="font-size:36px;font-weight:900;margin:16px 0;color:${myWin ? 'var(--green-3d)' : 'var(--red-3d)'}">
      ${myWin ? '🏆 挑战成功！' : '💔 挑战失败'}
    </div>
    <div style="font-size:18px;color:var(--text-secondary);">
      ${myWin ? `${challengeState.myWins}-${challengeState.cpuWins} 击败对手！` : `${challengeState.myWins}-${challengeState.cpuWins} 惜败对手`}
    </div>
    <div class="result-buttons-group" style="margin-top:16px;">
      <button class="btn-3d orange" onclick="startGame()">🔄 重新创建队伍</button>
      <button class="btn-3d dark" onclick="startChallenge()">⚔️ 再来一局挑战</button>
      <button class="btn-3d dark" onclick="showScreen('screen-home')">🏠 首页</button>
    </div>
  `;

  if (myWin) launchConfetti();
}

function launchConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#f39c12','#e74c3c','#27ae60','#3498db','#9b59b6','#f1c40f','#e67e22','#1abc9c'];
  const shapes = ['■', '●', '▲', '★'];

  for (let i = 0; i < 120; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
      piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
shapes[Math.floor(Math.random() * shapes.length)];
    piece.style.left = Math.random() * 100 + '%';
    piece.style.color = colors[Math.floor(Math.random() * colors.length)];
    piece.style.fontSize = (Math.random() * 12 + 8) + 'px';
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    piece.style.animationDelay = (Math.random() * 2) + 's';
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 5000);
}

function showPoster() {
  const overlay = document.getElementById('posterOverlay');
  const content = document.getElementById('posterContent');

  const topRow = ['PG', 'SG'];
  const bottomRow = ['SF', 'C', 'PF'];

  function renderPosterSlot(pos) {
    const p = game.slots[pos];
    if (!p) return '';
    const colors = TEAM_COLORS[p.team] || ['#333', '#555'];
    return `<div class="poster-player" style="background:linear-gradient(135deg,${colors[0]},${colors[1]});">
      <span class="slot-player-name">${p.name.split('-').pop()}</span>
      <span class="pos-label">${pos}</span>
    </div>`;
  }

  let playersHtml = '';
  topRow.forEach(pos => playersHtml += renderPosterSlot(pos));
  bottomRow.forEach(pos => playersHtml += renderPosterSlot(pos));

  content.innerHTML = `
    <div class="poster-title">🏀 是男人就来单挑</div>
    <div class="poster-record">${game.wins}-${game.losses}</div>
    <div class="poster-grade" style="color:${game.grade === 'S' ? '#a855f7' : game.grade.startsWith('A') ? '#22c55e' : game.grade === 'B' ? '#3b82f6' : game.grade === 'C' ? '#f59e0b' : '#64748b'}">${game.grade}</div>
    <div style="color:${game.grade === 'S' ? '#a855f7' : game.grade.startsWith('A') ? '#22c55e' : game.grade === 'B' ? '#3b82f6' : game.grade === 'C' ? '#f59e0b' : '#64748b'};font-size:14px;">${game.tier}</div>
    <div class="poster-roster">${playersHtml}</div>
    <div class="poster-footer">扫码来挑战 · 看看谁更厉害</div>
  `;

  overlay.classList.add('show');
}

function closePoster() {
  document.getElementById('posterOverlay').classList.remove('show');
}

function downloadPoster() {
  const canvas = document.getElementById('posterCanvas');
  const ctx = canvas.getContext('2d');
  const W = 600, H = 900;
  canvas.width = W * 2;
  canvas.height = H * 2;
  ctx.scale(2, 2);

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Top accent
  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, '#f39c12');
  topGrad.addColorStop(0.5, '#e67e22');
  topGrad.addColorStop(1, '#ff6b9d');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, 4);

  // Title
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏀 是男人就来单挑', W/2, 60);

  // Record
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(`${game.wins}-${game.losses}`, W/2, 140);

  // Grade
  const gradeColor = game.grade === 'S' ? '#a855f7' : game.grade.startsWith('A') ? '#22c55e' : game.grade === 'B' ? '#3b82f6' : game.grade === 'C' ? '#f59e0b' : '#64748b';
  ctx.fillStyle = gradeColor;
  ctx.font = 'bold 80px sans-serif';
  ctx.fillText(game.grade, W/2, 240);

  // Tier
  ctx.font = '20px sans-serif';
  ctx.fillText(game.tier, W/2, 280);

  // Roster
  const slotW = 90, slotH = 90, gap = 12;
  const startX = (W - (slotW * 3 + gap * 2)) / 2;

  // Top row (PG, SG)
  let x = startX + (slotW + gap);
  let y = 330;
  ['PG', 'SG'].forEach(pos => {
    drawPlayerSlot(ctx, x, y, slotW, slotH, game.slots[pos], pos);
    x += slotW + gap;
  });

  // Bottom row (SF, C, PF)
  x = startX;
  y = 440;
  ['SF', 'C', 'PF'].forEach(pos => {
    drawPlayerSlot(ctx, x, y, slotW, slotH, game.slots[pos], pos);
    x += slotW + gap;
  });

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px sans-serif';
  ctx.fillText('扫码来挑战 · 看看谁更厉害', W/2, H - 40);

  // Download
  const link = document.createElement('a');
  link.download = `是男人就来单挑-${game.wins}-${game.losses}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function drawPlayerSlot(ctx, x, y, w, h, player, pos) {
  if (!player) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pos, x + w/2, y + h/2 + 5);
    return;
  }

  const colors = TEAM_COLORS[player.team] || ['#333', '#555'];
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1] || colors[0]);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(player.name.split('-').pop(), x + w/2, y + h/2 - 2);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '11px sans-serif';
  ctx.fillText(pos, x + w/2, y + h/2 + 16);
}

window.addEventListener('DOMContentLoaded', () => {
  initParticles();
  // 处理分享链接
  handleShareLink();
});