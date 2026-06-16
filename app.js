/* ============================================
   是男人就来单挑 - Game Logic (v4 - Bug Fixed & Optimized)
   ============================================ */

// ==================== CLOUD API ====================
const API_BASE = ''; // Cloudflare 国内不可用,改用 URL 分享

// ==================== URL 分享功能 ====================
function encodeTeamForShare(teamData) {
  const json = JSON.stringify({
    ovr: teamData.ovr,
    grade: teamData.grade,
    tier: teamData.tier,
    record: teamData.record,
    roster: teamData.roster.map(p => ({ name: p.name, rating: p.rating, position: p.position, era: p.era, team: p.team }))
  });
  // 使用现代 Base64 编码替代废弃的 escape()
  const bytes = new TextEncoder().encode(json);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64;
}

function decodeTeamFromShare(encoded) {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
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
    console.error('API call failed:', e);
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

// ==================== MVP HIGHLIGHT ====================
const MVP_HIGHLIGHTS = {
  blowout: [
    '{player}全场狂砍{pts}分{reb}篮板{ast}助攻,统治攻防两端!他的突破如入无人之境,对手只能望球兴叹。关键时刻更是连得{clutch}分彻底杀死比赛,毫无争议的系列赛MVP!',
    '{player}打出了统治级表现,场均{pts}分{reb}篮板{ast}助攻的全面数据让对手无从招架。无论是内线强攻还是外线投射,他都展现出一代巨星的风采,带领球队轻松取胜!',
    '这场系列赛完全属于{player}!他以场均{pts}分的火力输出打爆了对位防守,{reb}个篮板更是筑起了坚不可摧的屏障。队友们都说:把球给他就行了!',
  ],
  medium: [
    '{player}在本系列赛中表现抢眼,场均贡献{pts}分{reb}篮板{ast}助攻。他在关键第{keyGame}节的出色发挥成为比赛转折点,那波{streak}分的连续得分直接改变了比赛走向,堪称系列赛最大功臣!',
    '系列赛中场均{pts}分{reb}篮板{ast}助攻,{player}用稳定的表现帮助球队锁定胜局。尤其是最后一节的冷静发挥,连续命中关键投篮,展现了一颗大心脏!',
    '{player}在攻防两端都有上佳表现,场均{pts}分{reb}篮板的数据虽不炸裂但足够稳定。更重要的是他在关键时刻的冷静处理,几次精妙的助攻直接帮助球队拿下比赛!',
  ],
  close: [
    '🔥决胜时刻!{player}在最后关头挺身而出,全场砍下{pts}分{reb}篮板{ast}助攻。第{keyGame}节那记关键{clutchPlay}至今让人热血沸腾,他就是为关键球而生的球员!MVP实至名归!',
    '系列赛战至最后一刻,{player}用场均{pts}分{reb}篮板{ast}助攻的表现证明了谁才是场上领袖。最让人难忘的是他在最后关头的冷静,那球处理堪称教科书级别!',
    '在如此焦灼的系列赛中,{player}扛起了整支球队!场均{pts}分的输出加上关键时刻的{clutch}分连续得分,他用行动诠释了什么叫"关键先生"!',
  ],
  buzzer: [
    '🔥绝杀英雄!最后0.8秒{player}接球就投,三分命中!全场{pts}分{reb}篮板{ast}助攻的数据配上这记绝杀,他就是今晚唯一的MVP!整个球馆都为他沸腾了!',
    '压哨绝杀!{player}后撤步三分出手--球进了!全场{pts}分的他完成了最伟大的表演!从开场到终场,他一直在用实力告诉所有人:这就是我的舞台!MVP!',
  ],
};

function selectMVP(winningSlots) {
  // 确保 winningSlots 是对象
  if (!winningSlots || typeof winningSlots !== 'object') {
    console.error('Invalid winningSlots in selectMVP');
    return null;
  }
  const players = Object.values(winningSlots).filter(Boolean);
  if (players.length === 0) return null;
  const sorted = [...players].sort((a, b) => {
    const scoreA = (a.pts||0) + (a.reb||0)*0.8 + (a.ast||0)*0.6 + (a.stl||0)*0.5 + (a.blk||0)*0.5;
    const scoreB = (b.pts||0) + (b.reb||0)*0.8 + (b.ast||0)*0.6 + (b.stl||0)*0.5 + (b.blk||0)*0.5;
    return scoreB - scoreA;
  });
  return sorted[0];
}

function generateMVPHighlight(mvp, games) {
  if (!mvp || typeof mvp !== 'object') return '本场比赛表现出色的球员获得了MVP称号!';
  // 确保 games 是数组
  if (!games || !Array.isArray(games) || games.length === 0) {
    return mvp.name ? (mvp.name + ' 表现出色，获得MVP！') : '本场比赛表现出色的球员获得了MVP称号!';
  }
  const diff = Math.abs(games[games.length-1].myPts - games[games.length-1].cpuPts);
  const myWin = challengeState.myWins >= 4;
  const winnerGames = games.filter(g => myWin ? g.myWin : !g.myWin);

  const avgPts = Math.round(games.reduce((sum, g) => sum + (Math.random()*5 + mvp.pts*0.8), 0) / games.length);
  const avgReb = Math.round((mvp.reb||8) + (Math.random()-0.5)*3);
  const avgAst = Math.round((mvp.ast||6) + (Math.random()-0.5)*3);
  const clutchPts = Math.max(Math.round(avgPts * 0.35), 6);
  const keyGame = Math.min(winnerGames.length, games.length);

  let template;
  const lastGame = games[games.length - 1];
  const lastDiff = Math.abs(lastGame.myPts - lastGame.cpuPts);
  if (lastDiff <= 3 && Math.random() < 0.3) {
    template = MVP_HIGHLIGHTS.buzzer[Math.floor(Math.random() * MVP_HIGHLIGHTS.buzzer.length)];
  } else if (lastDiff < 10) {
    template = MVP_HIGHLIGHTS.close[Math.floor(Math.random() * MVP_HIGHLIGHTS.close.length)];
  } else if (lastDiff < 25) {
    template = MVP_HIGHLIGHTS.medium[Math.floor(Math.random() * MVP_HIGHLIGHTS.medium.length)];
  } else {
    template = MVP_HIGHLIGHTS.blowout[Math.floor(Math.random() * MVP_HIGHLIGHTS.blowout.length)];
  }

  const clutchPlays = ['中投命中', '三分远投', '突破上篮', '暴扣得分', '后仰跳投', '罚球线跳投'];

  return template
    .replaceAll('{player}', mvp.name)
    .replaceAll('{pts}', avgPts)
    .replaceAll('{reb}', avgReb)
    .replaceAll('{ast}', avgAst)
    .replaceAll('{clutch}', clutchPts)
    .replaceAll('{keyGame}', keyGame)
    .replaceAll('{streak}', Math.max(Math.round(avgPts * 0.4), 5))
    .replaceAll('{clutchPlay}', clutchPlays[Math.floor(Math.random() * clutchPlays.length)]);
}

function showMVPModal(mvp, highlight) {
  if (!mvp || typeof mvp !== 'object') {
    console.error('Invalid MVP data in showMVPModal');
    return;
  }
  const overlay = document.getElementById('mvpOverlay');
  const mvpName = document.getElementById('mvpPlayerName');
  const mvpTeam = document.getElementById('mvpPlayerTeam');
  const mvpText = document.getElementById('mvpHighlight');
  const mvpClose = document.getElementById('mvpCloseBtn');

  const playerName = mvp.name.split('-').pop();
  const colors = TEAM_COLORS[mvp.team] || ['#333', '#555'];

  mvpName.textContent = playerName;
  mvpTeam.textContent = `${teamCN(mvp.team)} · ${mvp.decade}`;
  mvpText.textContent = highlight;

  // Set background gradient
  const bgGrad = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  mvpName.parentElement.style.background = bgGrad;

  overlay.classList.add('show');

  mvpClose.onclick = () => overlay.classList.remove('show');
}

// ==================== GAME REPORTS ====================
const REPORT_TEMPLATES = {
  blowout: [
    '第{gameNum}节,{winner}的{star}统治全场,拿下{pts}分{reb}篮板{ast}助攻。{loser}毫无还手之力,{score}轻松拿下!',
    '{winner}从开场就压制{loser},{star}里突外投不可阻挡。{score},一场毫无悬念的胜利!',
    '{star}狂砍{pts}分{reb}篮板,{winner}把{loser}打花了!{score},碾压局!',
  ],
  medium: [
    '第{gameNum}节,{winner}的{star}发挥出色,贡献{pts}分{reb}篮板{ast}助攻。{loser}努力追赶但差距渐大,{score}落败!',
    '{winner}在{star}带领下稳扎稳打,第三节拉开比分。{score},{loser}追分未果!',
    '{star}手感火热,连中三记三分。{winner}建立两位数优势,{score}收下比赛!',
  ],
  close: [
    '关键时刻{star}命中准绝杀!{winner}以{score}险胜{loser},太刺激了!',
    '最后十秒{star}突破上篮命中反超!{winner}{score}惊险拿下第{gameNum}节!',
    '比分胶着到最后,{star}一记干拔三分锁定胜局!{score},{winner}拿下关键一役!',
    '{loser}一度领先分,但{star}末节独得{endPts}分完成逆转!{score},大逆转!',
  ],
  buzzer: [
    '🔥绝杀!最后0.8秒{star}接球就投,三分命中!{winner}{score}绝杀{loser}!全场沸腾!',
    '🔥压哨绝杀!{star}后撤步三分出手--进了!{winner}{score}绝杀!太疯狂了!',
  ],
};

function generateGameReport(g) {
  // 确保 g 是对象
  if (!g || typeof g !== 'object') {
    console.error('Invalid game data in generateGameReport');
    return '比赛数据异常';
  }
  // Ensure required properties exist
  if (typeof g.myPts !== 'number' || typeof g.cpuPts !== 'number') {
    console.error('Missing scores in generateGameReport');
    return '比分数据异常';
  }
  const diff = Math.abs(g.myPts - g.cpuPts);
  const winner = g.myWin ? '你' : '对手';
  const loser = g.myWin ? '对手' : '你';
  const score = `${g.myPts}-${g.cpuPts}`;
  
  // 获取获胜方的球队数据，优先使用 challengeState 中的真实数据
  let winnerTeam = null;
  let winnerSlots = null;
  
  if (challengeState) {
    winnerSlots = g.myWin ? challengeState.mySlots : challengeState.cpuSlots;
  }
  
  // 如果 challengeState 中没有，尝试使用 g 中的数据
  if (!winnerSlots && g.myTeam) {
    winnerTeam = g.myTeam;
  }
  
  const star = getStarPlayer(winnerSlots || winnerTeam);

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
    .replaceAll('{gameNum}', g.num)
    .replaceAll('{winner}', winner)
    .replaceAll('{loser}', loser)
    .replaceAll('{star}', star.name)
    .replaceAll('{score}', score)
    .replaceAll('{pts}', star.pts)
    .replaceAll('{reb}', star.reb)
    .replaceAll('{ast}', star.ast)
    .replaceAll('{endPts}', Math.max(Math.round(star.pts * 0.4), 8));

  if (g.isClincher) {
    const sWins = g.myWins, cWins = g.cpuWins;
    const winSide = g.myWin ? '你' : '对手';
    const loseSide = g.myWins + g.cpuWins - 4;
    report += ` 系列赛${winSide}4-${loseSide}拿下总冠军！`;
  }

  return report;
}

function getStarPlayer(team) {
  // 确保 team 是对象
  if (!team || typeof team !== 'object') {
    console.error('Invalid team in getStarPlayer');
    return { name: '某球员', pts: 25, reb: 8, ast: 6 };
  }
  
  // 如果传入的是 slots 对象（带位置键），提取球员数组
  let players = [];
  if (team.PG || team.SG || team.SF || team.PF || team.C) {
    // 这是 slots 对象，按位置提取
    players = POS_ORDER.map(pos => team[pos]).filter(Boolean);
  } else {
    // 普通对象，直接取 values
    players = Object.values(team).filter(Boolean);
  }
  
  if (players.length === 0) {
    console.error('No players in team for getStarPlayer');
    return { name: '某球员', pts: 25, reb: 8, ast: 6 };
  }
  
  // 过滤掉 name 为 '某球员' 的占位符，优先使用真实球员
  const realPlayers = players.filter(p => p.name && p.name !== '某球员');
  const targetPlayers = realPlayers.length > 0 ? realPlayers : players;
  
  // 按综合数据排序（pts + reb*0.8 + ast*0.6）
  const sorted = [...targetPlayers].sort((a, b) => {
    const scoreA = (a.pts||0) + (a.reb||0)*0.8 + (a.ast||0)*0.6;
    const scoreB = (b.pts||0) + (b.reb||0)*0.8 + (b.ast||0)*0.6;
    return scoreB - scoreA;
  });
  
  const s = sorted[0];
  
  // 确保返回真实球员名，如果没有名字则使用位置+编号
  let playerName = s.name;
  if (!playerName || playerName === '某球员') {
    // 尝试使用 enName
    playerName = s.enName || s.player || '球员';
  }
  
  return {
    name: playerName,
    pts: Math.round((s.pts||25) + (Math.random()-0.5)*10),
    reb: Math.round((s.reb||8) + (Math.random()-0.5)*4),
    ast: Math.round((s.ast||6) + (Math.random()-0.5)*4),
  };
}

// ==================== NBA DATA ====================
let NBA_DATA = null;

(function loadData() {
  // Ensure NBA_DATA_RAW is available globally
  if (typeof NBA_DATA_RAW === 'undefined' || !NBA_DATA_RAW || !Array.isArray(NBA_DATA_RAW)) {
    console.error('NBA_DATA_RAW not loaded or invalid');
    document.addEventListener('DOMContentLoaded', () => {
      const app = document.querySelector('.app-container');
      if (app) {
        app.innerHTML = `
          <div style="text-align:center;padding:40px;color:#fff;">
            <div style="font-size:48px;margin-bottom:20px;">😅</div>
            <div style="font-size:18px;margin-bottom:12px;">数据加载失败</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:24px;">
              球员数据未能正确加载,请刷新页面重试
            </div>
            <button class="btn-3d orange" onclick="location.reload()">🔄 刷新页面</button>
          </div>
        `;
      }
    });
    return;
  }

  try {
    if (!NBA_DATA_RAW || NBA_DATA_RAW.length === 0) {
      console.error('NBA_DATA_RAW is empty');
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
  } catch (e) {
    console.error('Failed to parse NBA_DATA_RAW:', e);
    document.addEventListener('DOMContentLoaded', () => {
      const app = document.querySelector('.app-container');
      if (app) {
        app.innerHTML = `
          <div style="text-align:center;padding:40px;color:#fff;">
            <div style="font-size:48px;margin-bottom:20px;">😅</div>
            <div style="font-size:18px;margin-bottom:12px;">数据解析失败</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.5);">
              球员数据格式错误,请检查数据文件
            </div>
          </div>
        `;
      }
    });
  }
})();

// ==================== CONSTANTS ====================
const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
const MAX_ROUNDS = 5;
const STAT_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk'];

const ALLOWED_ERAS = ['1980s', '1990s', '2000s', '2010s', '2020s'];

const ERA_BENCHMARKS = {
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

// ==================== GAME STATE ====================
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
let challengeState = null;

// ==================== HELPERS ====================
function teamCN(abbr) { return TEAM_CN[abbr] || abbr; }
function isNum(v) { return typeof v === 'number' && !Number.isNaN(v); }
function getPositions(posStr) {
  if (!posStr) return [];
  return posStr.split('/').map(p => p.trim()).filter(p => POS_ORDER.includes(p));
}

// ==================== PARTICLES ====================
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) {
    console.error('particles-canvas not found');
    return;
  }
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];
  let animationId = null;
  let isVisible = true;

  document.addEventListener('visibilitychange', () => {
    isVisible = document.visibilityState === 'visible';
    if (isVisible && !animationId) {
      draw();
    }
  });

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
    if (!isVisible) {
      animationId = null;
      return;
    }
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
    animationId = requestAnimationFrame(draw);
  }
  draw();
}

// ==================== SCREEN MANAGEMENT ====================
function showScreen(id) {
  // 确保 id 有效
  if (!id) {
    console.error('Invalid id in showScreen');
    return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ==================== GAME INIT ====================
function startGame() {
  closePoster();
  // 确保 game 对象初始化
  game = {
    round: 0, roster: [],
    slots: { PG: null, SG: null, SF: null, PF: null, C: null },
    usedDecades: [], usedCombos: [],
    skipTeam: 1, skipDecade: 1,
    currentTeam: null, currentDecade: null, spun: false,
    wins: 0, losses: 0, grade: '', tier: '',
  };
  pendingPick = null; moveState = null;
  challengeState = null;
  showScreen('screen-game');
  renderRosterBar();
  nextRound();
}

// ==================== ROSTER BAR ====================
function renderRosterBar() {
  const bar = document.getElementById('rosterBar');
  if (!bar) {
    console.error('rosterBar not found');
    return;
  }
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

// ==================== ROUND PROGRESSION ====================
function nextRound() {
  // 确保 game 对象存在
  if (!game || !game.slots) {
    console.error('No game state in nextRound');
    startGame();
    return;
  }
  if (game.round >= MAX_ROUNDS) { runSimulation(); return; }
  game.spun = false;
  game.currentTeam = null;
  game.currentDecade = null;

  document.getElementById('roundLabel').textContent = `第${game.round + 1} / ${MAX_ROUNDS} 轮`;
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

// ==================== SLOT MACHINE ====================
function spinSlot() {
  // 确保 NBA_DATA 已加载
  if (!NBA_DATA || Object.keys(NBA_DATA).length === 0) {
    console.error('NBA_DATA not loaded');
    return;
  }
  if (game.spun) return;
  // 确保 NBA_DATA 已加载
  if (!NBA_DATA || Object.keys(NBA_DATA).length === 0) {
    console.error('NBA_DATA not loaded in spinSlot');
    document.getElementById('playerHint').textContent = '数据加载中，请稍候...';
    return;
  }
  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = true;
  spinBtn.textContent = '🎰 转动中...';

  const teamReel = document.getElementById('teamReel');
  const decadeReel = document.getElementById('decadeReel');
  const teamText = document.getElementById('teamReelText');
  const decadeText = document.getElementById('decadeReelText');

  teamReel.classList.add('spinning');
  decadeReel.classList.add('spinning');

  const allDecades = Object.keys(NBA_DATA || {}).filter(d => ALLOWED_ERAS.includes(d));
  let spinCount = 0;

  const spinInterval = setInterval(() => {
    const randDecade = allDecades[Math.floor(Math.random() * allDecades.length)];
    const decadeTeams = Object.keys((NBA_DATA || {})[randDecade] || {});
    // 老虎机滚动效果：2010s/2020s 金霸王概率 10%
    const isBoostEra = randDecade === '2010s' || randDecade === '2020s';
    const randTeam = isBoostEra && decadeTeams.includes('金霸王') && Math.random() < 0.1
      ? '金霸王'
      : decadeTeams[Math.floor(Math.random() * decadeTeams.length)];
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
      spinBtn.textContent = '✅锁定';

      document.getElementById('skipTeamBtn').disabled = game.skipTeam <= 0;
      document.getElementById('skipDecadeBtn').disabled = game.skipDecade <= 0;

      setTimeout(() => showPlayers(result.team, result.decade), 800);
    }
  }, 80);
}

function getSlotResult() {
  // 确保 game 存在
  if (!game) {
    console.error('No game state in getSlotResult');
    return { team: 'LAL', decade: '2020s' };
  }
  const usedSet = new Set(game.usedCombos);
  const allCombos = [];

  for (const decade of Object.keys(NBA_DATA || {}).filter(d => ALLOWED_ERAS.includes(d))) {
    for (const team of Object.keys((NBA_DATA || {})[decade] || {})) {
      const combo = decade + '|' + team;
      if (!usedSet.has(combo)) {
        allCombos.push({ team, decade });
      }
    }
  }

  if (allCombos.length === 0) {
    game.usedCombos = [];
    for (const decade of Object.keys(NBA_DATA || {}).filter(d => ALLOWED_ERAS.includes(d))) {
      for (const team of Object.keys((NBA_DATA || {})[decade] || {})) {
        allCombos.push({ team, decade });
      }
    }
  }

  // 先随机选年代
  const decades = [...new Set(allCombos.map(c => c.decade))];
  const selectedDecade = decades[Math.floor(Math.random() * decades.length)];

  // 获取该年代所有可用球队
  const decadeTeams = allCombos.filter(c => c.decade === selectedDecade);
  
  // 确保 decadeTeams 不为空
  if (decadeTeams.length === 0) {
    console.error('No teams found for decade:', selectedDecade);
    return allCombos[0] || { team: 'LAL', decade: '2020s' };
  }
  
  const jinbaTeams = decadeTeams.filter(c => c.team === '金霸王');
  const otherTeams = decadeTeams.filter(c => c.team !== '金霸王');

  // 2010s 和 2020s 金霸王概率 10%
  const isBoostEra = selectedDecade === '2010s' || selectedDecade === '2020s';

  if (isBoostEra && jinbaTeams.length > 0 && otherTeams.length > 0) {
    return Math.random() < 0.1
      ? jinbaTeams[Math.floor(Math.random() * jinbaTeams.length)]
      : otherTeams[Math.floor(Math.random() * otherTeams.length)];
  }

  // 其他年代或金霸王不可用，均匀随机
  return decadeTeams[Math.floor(Math.random() * decadeTeams.length)];
}

// ==================== SKIP ====================
function directSkip(type) {
  if (pendingPick) { pendingPick = null; renderRosterBar(); }
  // 确保 game 状态存在
  if (!game || !game.currentDecade || !game.currentTeam) {
    console.error('No game state in directSkip');
    return;
  }
  document.getElementById('spinBtn').disabled = true;

  if (type === 'team' && game.skipTeam > 0) {
    game.skipTeam--;
    const decadeTeams = Object.keys(NBA_DATA[game.currentDecade] || {});
    const otherTeams = decadeTeams.filter(t => t !== game.currentTeam);
    // 确保有其他球队可选
    if (otherTeams.length === 0 && decadeTeams.length > 0) {
      console.error('Only one team in this decade, cannot skip');
      document.getElementById('playerHint').textContent = '该年代只有一支球队,无法跳过';
      game.skipTeam++;
      document.getElementById('skipTeamBtn').disabled = game.skipTeam <= 0;
      return;
    }

    if (otherTeams.length === 0) {
      document.getElementById('playerHint').textContent = '该年代只有一支球队,无法跳过';
      game.skipTeam++;
      document.getElementById('skipTeamBtn').disabled = game.skipTeam <= 0;
      return;
    }

    const finalTeam = otherTeams[Math.floor(Math.random() * otherTeams.length)];

    animateReel('teamReelText', decadeTeams, teamCN, () => {
      game.currentTeam = finalTeam;
      document.getElementById('teamReelText').textContent = teamCN(finalTeam);
      document.getElementById('teamReel').style.borderColor = 'var(--green)';
      finishSkip();
    });
  } else if (type === 'decade' && game.skipDecade > 0) {
    game.skipDecade--;
    const teamName = game.currentTeam;
    const teamDecades = Object.keys(NBA_DATA || {}).filter(d => ALLOWED_ERAS.includes(d) && (NBA_DATA || {})[d] && (NBA_DATA || {})[d][teamName]);

    if (teamDecades.length <= 1) {
      document.getElementById('playerHint').textContent = '该球队只有一个年代,无法跳过';
      game.skipDecade++;
      document.getElementById('skipDecadeBtn').disabled = game.skipDecade <= 0;
      return;
    }

    const otherDecades = teamDecades.filter(d => d !== game.currentDecade);
    const finalDecade = otherDecades.length > 0
      ? otherDecades[Math.floor(Math.random() * otherDecades.length)]
      : teamDecades[0];

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
  
  // 确保 pool 不为空
  if (!pool || pool.length === 0) {
    console.error('Empty pool for animation:', elementId);
    callback();
    return;
  }
  
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
  // 确保不重复添加相同的组合
  const combo = game.currentDecade + '|' + game.currentTeam;
  if (!game.usedCombos.includes(combo)) {
    game.usedCombos.push(combo);
  }
  renderRosterBar();
  document.getElementById('skipTeamBtn').disabled = game.skipTeam <= 0;
  document.getElementById('skipDecadeBtn').disabled = game.skipDecade <= 0;
  document.getElementById('playerHint').textContent = `${teamCN(game.currentTeam)} · ${game.currentDecade} (已跳过)`;
  showPlayers(game.currentTeam, game.currentDecade);
}

// ==================== PLAYER SELECTION ====================
function setFilterTab(tab) {
  // 确保 tab 有效
  if (!tab) {
    console.error('Invalid tab in setFilterTab');
    return;
  }
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
  if (!grid) {
    console.error('playerGrid not found');
    return;
  }
  if (_filterTab === 'all') {
    // 确保 NBA_DATA 已加载
    if (!NBA_DATA || !NBA_DATA[decade] || !NBA_DATA[decade][team]) {
      console.error('No data for team/decade:', team, decade);
      grid.innerHTML = '<div class="no-players"><div class="icon">😅</div><p>该球队年代暂无数据</p></div>';
      return;
    }
    const players = NBA_DATA[decade] ? (NBA_DATA[decade][team] || []) : [];
    let all = [...players];
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
    document.getElementById('playerHint').textContent = '该位置没有可用球员，请尝试其他筛选或跳过';
    // 自动显示全部球员作为fallback
    if (_topPool && _topPool.length > 0) {
      display = [..._topPool].sort(() => Math.random() - 0.5);
    }
    if (!display || display.length === 0) return;
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
  // 确保 team 和 decade 有效
  if (!team || !decade) {
    console.error('Invalid team or decade in showPlayers:', team, decade);
    return;
  }
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
  try { 
    const posData = el.dataset.positions;
    if (posData) {
      positions = JSON.parse(decodeURIComponent(posData));
    }
  } catch(e) { 
    console.error('Failed to parse positions:', e);
    positions = getPositions(pos); 
  }
  if (!positions || positions.length === 0) positions = getPositions(pos);
  // 确保 positions 是数组
  if (!Array.isArray(positions)) positions = [positions].filter(Boolean);

  const emptyEligible = positions.filter(p => !game.slots[p]);
  if (emptyEligible.length === 0) {
    el.classList.remove('selected');
    document.getElementById('playerHint').textContent = `⚠️ ${name} 的可选位置(${positions.join('/')}) 已满!`;
    return;
  }

  pendingPick = { name, pos, pts, reb, ast, stl, blk, positions };
  document.getElementById('playerHint').textContent = `点击上方闪烁的方框将 ${name} 放入 (${emptyEligible.join('/')})`;
  renderRosterBar();
}

function onEmptySlotClick(pos) {
  // 确保 pos 有效
  if (!pos || !POS_ORDER.includes(pos)) {
    console.error('Invalid pos in onEmptySlotClick:', pos);
    return;
  }
  if (pendingPick && pendingPick.positions.includes(pos)) {
    confirmDraftWith({ ...pendingPick, assignedPos: pos });
  } else if (moveState && moveState.targetPositions.includes(pos)) {
    const player = moveState.player;
    game.slots[pos] = player;
    game.slots[moveState.currentPos] = null;
    player.assignedPos = pos;
    moveState = null;
    renderRosterBar();
    document.getElementById('playerHint').textContent = `已移动${player.name} 到${pos}`;
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
  document.getElementById('playerHint').textContent = `点击闪烁的方框移动${player.name.split('-').pop()}`;
  renderRosterBar();
}

function confirmDraftWith(pick) {
  pendingPick = null; moveState = null;
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));

  // 确保 pick 和 game.slots 存在
  if (!pick || !pick.assignedPos || !game || !game.slots) {
    console.error('Invalid pick or game state in confirmDraftWith');
    return;
  }

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
  document.getElementById('playerHint').textContent = `✅${pick.name} 到${pick.assignedPos} 已选入!`;

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

// ==================== RATING CALCULATION ====================
function playerRating(p) {
  // 确保 p 是对象
  if (!p || typeof p !== 'object') {
    console.error('Invalid player in playerRating');
    return 50;
  }
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

  // 确保 game.slots 存在
  if (!game.slots || !game.slots.PG) {
    console.error('No game slots in runSimulation');
    game.slots = generateRandomTeam();
  }

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

  // Save to history
  saveToHistory();

  // Show share link area
  if (API_BASE) {
    const area = document.getElementById('shareLinkArea');
    area.style.display = 'block';
    document.getElementById('shareLinkUrl').textContent = '保存到云端后显示...';
    const rosterList = POS_ORDER.map(pos => {
      const p = game.slots[pos];
      return p ? { name: p.name, pos: p.pos, positions: p.positions || [p.pos], team: p.team, era: p.decade, pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl || 0, blk: p.blk || 0, assignedPos: pos, rating: playerRating(p) } : null;
    });
    const teamData = { ovr: result.ovr, grade: result.grade, tier: result.tier, record: `${result.wins}-${result.losses}`, roster: rosterList };
    const shareUrl = generateShareLink(teamData);
    document.getElementById('shareLinkUrl').textContent = shareUrl;
  }

  if (result.wins >= 80) launchConfetti();
}

// ==================== HISTORY ====================
function getHistory() {
  try {
    const data = localStorage.getItem('duel_history');
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) { 
    console.error('Failed to parse history:', e);
    return []; 
  }
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

  try {
    const data = JSON.stringify(history);
    if (data.length > 4 * 1024 * 1024) {
      while (history.length > 10) {
        history.pop();
        const trimmed = JSON.stringify(history);
        if (trimmed.length <= 4 * 1024 * 1024) break;
      }
    }
    localStorage.setItem('duel_history', JSON.stringify(history));
    localStorage.setItem('duel_lastGame', JSON.stringify({
      ...game, slots: game.slots, ovr: result.ovr,
    }));
  } catch (e) {
    console.error('localStorage save failed:', e);
    // 尝试清理旧数据后再保存
    try {
      localStorage.removeItem('duel_history');
      while (history.length > 5) history.pop();
      localStorage.setItem('duel_history', JSON.stringify(history));
    } catch (e2) {
      console.error('Failed to save even trimmed history:', e2);
    }
  }

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
  if (!list) {
    console.error('historyList not found');
    return;
  }

  if (history.length === 0) {
    list.innerHTML = '<div class="no-players"><div class="icon">📋</div><p>暂无历史战绩,先去组队吧!</p></div>';
    return;
  }

  list.innerHTML = history.map((h, i) => {
    const roster = h.slots || h.roster || {};
    const rosterHtml = Object.values(roster).filter(Boolean).map(p =>
      `<span class="pos-badge" style="background:linear-gradient(135deg,var(--btn-orange),var(--orange-light));color:#fff;">${p.name.split('-').pop()}</span>`
    ).join('');
    const sharedBadge = h.shared ? '<span class="pos-badge" style="background:linear-gradient(135deg,var(--btn-red),var(--red-light));color:#fff;font-size:10px;"> 分享</span>' : '';
    const challengeBtn = `<button class="btn-3d" style="font-size:11px;padding:4px 12px;background:linear-gradient(135deg,var(--btn-red),var(--red-light));margin-top:6px;" onclick="challengeFromHistory(${i})">⚔️ 挑战</button>`;
    return `<div class="history-item">
      <div class="history-header">
        <span class="history-record">${h.record}</span>
        <span class="history-grade" style="color:${TEAM_GRADE_BANDS.find(b => b.grade === h.grade)?.color || '#fff'}">${h.grade}</span>
        <span class="history-tier">${h.tier}</span>
        ${sharedBadge}
      </div>
      <div class="history-roster">${rosterHtml}</div>
      <div class="history-date">${h.date}</div>
      ${challengeBtn}
    </div>`;
  }).join('');
}

function challengeFromHistory(index) {
  // 确保 index 有效
  if (index === undefined || index === null || index < 0) {
    console.error('Invalid index in challengeFromHistory:', index);
    return;
  }
  const history = getHistory();
  const target = history[index];
  if (!target || !target.slots) return;

  if (!game.slots || !POS_ORDER.every(pos => game.slots[pos])) {
    window._pendingChallengeOpponent = {
      slots: target.slots,
      result: { record: target.record, grade: target.grade, tier: target.tier, ovr: target.ovr },
    };
    alert('你还没有创建队伍!先去组队,然后再回来挑战这个队伍!');
    showScreen('screen-game');
    return;
  }

  startChallengeAgainst({
    slots: target.slots,
    result: { record: target.record, grade: target.grade, tier: target.tier, ovr: target.ovr },
  });
}

// ==================== SHARE ====================
async function shareResult() {
  const result = calcRecord(game.slots);
  const rosterList = POS_ORDER.map(pos => {
    const p = game.slots[pos];
    return p ? { name: p.name, pos: p.pos, positions: p.positions || [p.pos], team: p.team, era: p.decade, pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl || 0, blk: p.blk || 0, assignedPos: pos, rating: playerRating(p) } : null;
  });
  const teamData = { ovr: result.ovr, grade: result.grade, tier: result.tier, record: `${result.wins}-${result.losses}`, roster: rosterList };
  const shareUrl = generateShareLink(teamData);

  const shareText = `是男人就来单挑!\n\n${game.wins}-${game.losses} ${game.grade} · ${game.tier}\n\n阵容:${POS_ORDER.map(pos => {
    const p = game.slots[pos];
    return p ? `${p.name.split('-').pop()}(${pos})` : '';
  }).filter(Boolean).join(' | ')}\n\n${shareUrl ? '挑战链接:' + shareUrl + '\n\n' : ''}是男人就来单挑,敢来挑战吗?`;

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
    alert(`战绩已复制!分享链接已生成!\n\n${shareUrl}`);
  }).catch(() => {
    alert('复制失败,请手动复制');
  });
}

function copyShareLink() {
  const url = document.getElementById('shareLinkUrl').textContent;
  if (!url) {
    console.error('No share URL to copy');
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('链接已复制!'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = url; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    alert('链接已复制!');
  }
}

/* ========== 金霸王挑战 ========== */
function challengeJinbaKing() {
  // 生成金霸王最强阵容
  const jinbaSlots = generateJinbaKingTeam();
  const jinbaResult = calcRecord(jinbaSlots);
  
  // 金霸王球队综合评分减30
  jinbaResult.ovr = Math.max(0, jinbaResult.ovr - 30);
  jinbaResult.wins = Math.max(0, jinbaResult.wins - 25);
  jinbaResult.losses = 82 - jinbaResult.wins;

  // 如果用户没有创建队伍，直接开始挑战（用随机队伍）
  if (!game.slots || !POS_ORDER.every(pos => game.slots[pos])) {
    const randomSlots = generateRandomTeam();
    game.slots = randomSlots;
    game.roster = Object.values(randomSlots).filter(Boolean);
    const myResult = calcRecord(game.slots);
    startChallengeDirect(game.slots, myResult, jinbaSlots, jinbaResult, '金霸王');
    return;
  }

  // 用户已有队伍，弹出选择：创建新队伍 vs 用当前队伍挑战
  showJinbaTeamChoice(jinbaSlots, jinbaResult);
}

function showJinbaTeamChoice(jinbaSlots, jinbaResult) {
  let overlay = document.getElementById('jinbaChoiceOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'jinbaChoiceOverlay';
    overlay.className = 'poster-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="poster-content" style="max-width:400px;text-align:center;">
      <div class="poster-title" style="font-size:22px;">👑 挑战金霸王</div>
      <div style="font-size:16px;color:var(--text-secondary);margin:16px 0;">
        检测到您已有队伍<br>请选择挑战方式
      </div>
      <div style="display:flex;gap:12px;justify-content:center;margin:20px 0;">
        <button class="btn-3d orange" onclick="startJinbaWithCurrentTeam()">🏀 用当前队伍挑战</button>
        <button class="btn-3d dark" onclick="startJinbaWithNewTeam()">🔄 创建新队伍挑战</button>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.4);">
        当前队伍: ${POS_ORDER.map(pos => game.slots[pos]?.name?.split('-').pop() || '').filter(Boolean).join(' | ')}
      </div>
    </div>
  `;
  overlay.classList.add('show');
  
  // 保存到全局供回调使用
  window._jinbaSlots = jinbaSlots;
  window._jinbaResult = jinbaResult;
}

function startJinbaWithCurrentTeam() {
  const overlay = document.getElementById('jinbaChoiceOverlay');
  if (overlay) overlay.classList.remove('show');
  
  const jinbaSlots = window._jinbaSlots;
  const jinbaResult = window._jinbaResult;
  const myResult = calcRecord(game.slots);
  startChallengeDirect(game.slots, myResult, jinbaSlots, jinbaResult, '金霸王');
}

function startJinbaWithNewTeam() {
  const overlay = document.getElementById('jinbaChoiceOverlay');
  if (overlay) overlay.classList.remove('show');
  
  const jinbaSlots = window._jinbaSlots;
  const jinbaResult = window._jinbaResult;
  
  // 创建新队伍
  startGame();
  // 等待游戏初始化后自动挑战
  window._pendingJinbaChallenge = { jinbaSlots, jinbaResult };
}

// 在 nextRound 结束后检查是否有待处理的金霸王挑战
function checkPendingJinbaChallenge() {
  if (window._pendingJinbaChallenge && game.round >= MAX_ROUNDS) {
    const { jinbaSlots, jinbaResult } = window._pendingJinbaChallenge;
    window._pendingJinbaChallenge = null;
    const myResult = calcRecord(game.slots);
    startChallengeDirect(game.slots, myResult, jinbaSlots, jinbaResult, '金霸王');
  }
}

function generateJinbaKingTeam() {
  const slots = { PG: null, SG: null, SF: null, PF: null, C: null };

  // 获取金霸王所有球员
  const jinbaPlayers = [];
  for (const decade of Object.keys(NBA_DATA || {}).filter(d => ALLOWED_ERAS.includes(d))) {
    const players = (NBA_DATA || {})[decade]?.['金霸王'] || [];
    for (const p of players) {
      jinbaPlayers.push({
        ...p,
        decade,
        team: '金霸王',
        positions: p.positions?.length ? p.positions : (p.pos ? p.pos.split('/') : []),
      });
    }
  }

  // 如果没有金霸王球员，使用默认阵容
  if (jinbaPlayers.length === 0) {
    console.error('No 金霸王 players found, using default team');
    return generateRandomTeam();
  }

  // 去重：按球员名称去重，保留每个球员只出现一次
  const uniquePlayers = [];
  const seenNames = new Set();
  for (const p of jinbaPlayers) {
    const nameKey = p.name || p.enName;
    if (!seenNames.has(nameKey)) {
      seenNames.add(nameKey);
      uniquePlayers.push(p);
    }
  }

  // 按评分排序，选每个位置最强的
  const posMap = { PG: [], SG: [], SF: [], PF: [], C: [] };
  for (const p of uniquePlayers) {
    for (const pos of p.positions) {
      if (posMap[pos]) {
        posMap[pos].push(p);
      }
    }
  }

  // 已选球员集合，防止跨位置重复
  const selectedPlayers = new Set();

  for (const pos of POS_ORDER) {
    const candidates = posMap[pos].filter(p => !selectedPlayers.has(p.name || p.enName));
    
    if (candidates && candidates.length > 0) {
      // 按综合评分排序（pts + reb + ast）
      candidates.sort((a, b) => {
        const scoreA = (a.stats?.pts || 0) + (a.stats?.reb || 0) + (a.stats?.ast || 0);
        const scoreB = (b.stats?.pts || 0) + (b.stats?.reb || 0) + (b.stats?.ast || 0);
        return scoreB - scoreA;
      });
      const best = candidates[0];
      selectedPlayers.add(best.name || best.enName);
      slots[pos] = {
        name: best.name,
        enName: best.enName || best.name,
        pos: best.pos,
        positions: best.positions,
        team: '金霸王',
        decade: best.decade,
        pts: best.stats?.pts || 0,
        reb: best.stats?.reb || 0,
        ast: best.stats?.ast || 0,
        stl: best.stats?.stl || 0,
        blk: best.stats?.blk || 0,
        assignedPos: pos,
      };
    } else {
      // 如果该位置没有球员，从其他位置找最佳球员（未选过的）
      const allCandidates = Object.values(posMap).flat().filter(p => !selectedPlayers.has(p.name || p.enName));
      if (allCandidates.length > 0) {
        allCandidates.sort((a, b) => {
          const scoreA = (a.stats?.pts || 0) + (a.stats?.reb || 0) + (a.stats?.ast || 0);
          const scoreB = (b.stats?.pts || 0) + (b.stats?.reb || 0) + (b.stats?.ast || 0);
          return scoreB - scoreA;
        });
        const best = allCandidates[0];
        selectedPlayers.add(best.name || best.enName);
        slots[pos] = {
          name: best.name,
          enName: best.enName || best.name,
          pos: best.pos,
          positions: best.positions,
          team: '金霸王',
          decade: best.decade,
          pts: best.stats?.pts || 0,
          reb: best.stats?.reb || 0,
          ast: best.stats?.ast || 0,
          stl: best.stats?.stl || 0,
          blk: best.stats?.blk || 0,
          assignedPos: pos,
        };
      }
    }
  }

  return slots;
}

function startChallengeDirect(mySlots, myResult, cpuSlots, cpuResult, cpuName) {
  // 确保 slots 不为空
  if (!mySlots || !cpuSlots) {
    console.error('Empty slots in startChallengeDirect');
    return;
  }

  challengeState = {
    mySlots: { ...mySlots },
    myResult,
    cpuSlots: { ...cpuSlots },
    cpuResult,
    myWins: 0,
    cpuWins: 0,
    games: [],
    currentGame: 0,
    isSharedOpponent: false,
    cpuName: cpuName || '对手',
  };

  showScreen('screen-challenge');
  renderChallengeVS(cpuResult, cpuName);
  renderChallengeGames();
  setTimeout(simulateNextGame, 500);
}

// ==================== CHALLENGE MODE ====================
function openTeamSelect() {
  showScreen('screen-select');
  renderTeamSelect();
}

async function renderTeamSelect() {
  const list = document.getElementById('teamSelectList');
  if (!list) {
    console.error('teamSelectList not found');
    return;
  }
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
      console.error('Failed to load cloud teams:', e);
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
    list.innerHTML = '<div class="no-players"><div class="icon"></div><p>暂无历史球队,先去组队吧!</p></div>';
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
  // 确保 teamId 有效
  if (!teamId) {
    console.error('Invalid teamId in selectChallengeTeam');
    return;
  }
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
  // 确保 cpuSlots 存在
  if (!cpuSlots || typeof cpuSlots !== 'object') {
    console.error('Invalid cpuSlots in startChallengeWithTeam');
    return;
  }
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
    cpuName: '对手',
  };

  renderChallengeVS(cpuResult, '对手队伍');
  renderChallengeGames();
  setTimeout(simulateNextGame, 500);
}

// ==================== SHARE LINK HANDLING ====================
function handleShareLink() {
  const params = new URLSearchParams(window.location.search);
  const teamData = params.get('team');
  if (!teamData) return false;

  let decoded;
  try {
    decoded = decodeTeamFromShare(teamData);
  } catch (e) {
    console.error('Failed to decode share link:', e);
    return false;
  }
  if (decoded?.roster) {
    const slots = {};
    for (const pos of POS_ORDER) {
      const p = decoded.roster[pos] || decoded.roster.find(r => r.assignedPos === pos);
      if (p) {
        slots[pos] = {
          name: p.name, enName: p.enName || p.name,
          pos: p.pos || pos, positions: p.positions || [pos],
          team: p.team || '', decade: p.era || p.decade || '',
          pts: p.pts || 0, reb: p.reb || 0, ast: p.ast || 0,
          stl: p.stl || 0, blk: p.blk || 0, assignedPos: pos,
          rating: p.rating || playerRating(p),
        };
      }
    }
    const result = calcRecord(slots);
    window._sharedChallengeTeam = decoded.roster;
    window._sharedChallengeInfo = { ...decoded, ...result };

    saveSharedTeamToHistory(decoded, result, slots);
    showShareChallengeModal(decoded, result);
  }
  return true;
}

function saveSharedTeamToHistory(decoded, result, slots) {
  // 确保 decoded 存在
  if (!decoded || typeof decoded !== 'object') {
    console.error('Invalid decoded data in saveSharedTeamToHistory');
    return;
  }
  const history = getHistory();
  const exists = history.some(h => h.record === decoded.record && h.grade === decoded.grade && h.shared);
  if (exists) return;

  const entry = {
    id: Date.now() + Math.random(),
    record: decoded.record,
    grade: decoded.grade,
    tier: decoded.tier,
    ovr: decoded.ovr,
    slots: slots,
    date: new Date().toLocaleString('zh-CN'),
    shared: true,
    shareUrl: generateShareLink({
      ovr: result.ovr, grade: result.grade, tier: result.tier,
      record: result.record, roster: decoded.roster
    }),
  };
  history.unshift(entry);
  if (history.length > 50) history.pop();
  localStorage.setItem('duel_history', JSON.stringify(history));
}

function showShareChallengeModal(decoded, result) {
  let overlay = document.getElementById('shareLinkOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'shareLinkOverlay';
    overlay.className = 'poster-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="poster-content" style="max-width:400px;">
      <div class="poster-title" style="font-size:22px;">📬 挑战邀请</div>
      <div style="font-size:28px;font-weight:800;margin:12px 0;color:var(--orange-light);">${decoded.record}</div>
      <div style="font-size:20px;font-weight:700;color:${result.grade === 'S' ? '#a855f7' : result.grade.startsWith('A') ? '#22c55e' : '#3b82f6'};">${decoded.grade} · ${decoded.tier}</div>
      <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        ${POS_ORDER.map(pos => {
          const p = decoded.roster[pos] || decoded.roster.find(r => r.assignedPos === pos);
          if (!p) return '';
          return `<span class="pos-badge" style="font-size:11px;padding:4px 8px;">${pos}: ${p.name}</span>`;
        }).join('')}
      </div>
      <div style="margin-top:20px;display:flex;gap:12px;">
        <button class="btn-3d" style="flex:1;background:linear-gradient(135deg,var(--btn-red),var(--red-light));" onclick="acceptChallenge()">⚔️ 接受挑战</button>
        <button class="btn-3d" style="flex:1;" onclick="closeShareModal()">先创建队伍</button>
      </div>
      <div style="margin-top:12px;">
        <button class="btn-3d" style="width:100%;background:linear-gradient(135deg,var(--blue-3d),var(--blue-light));font-size:12px;" onclick="saveAndCloseShare()">💾 保存并去创建</button>
      </div>
    </div>
  `;
  overlay.classList.add('show');
}

function acceptChallenge() {
  closeShareModal();
  // 确保 window._sharedChallengeInfo 存在
  if (!window._sharedChallengeInfo) {
    console.error('No shared challenge info in acceptChallenge');
    return;
  }
  window._pendingChallengeOpponent = {
    slots: window._sharedChallengeInfo?.slots || {},
    result: window._sharedChallengeInfo || {},
  };
  if (game.slots && POS_ORDER.every(pos => game.slots[pos])) {
    startChallengeAgainst(window._pendingChallengeOpponent);
  } else {
    openTeamSelect();
  }
}

function closeShareModal() {
  const overlay = document.getElementById('shareLinkOverlay');
  if (overlay) {
    overlay.classList.remove('show');
  } else {
    console.error('shareLinkOverlay not found');
  }
}

function saveAndCloseShare() {
  try {
    closeShareModal();
  } catch (e) {
    console.error('Error in saveAndCloseShare:', e);
  }
}

function startChallengeAgainst(opponent) {
  // 确保 opponent 存在
  if (!opponent || typeof opponent !== 'object') {
    console.error('Invalid opponent in startChallengeAgainst');
    return;
  }
  const myResult = calcRecord(game.slots);
  const oppSlots = opponent.slots;
  const oppResult = opponent.result;

  challengeState = {
    mySlots: { ...game.slots },
    myResult,
    cpuSlots: { ...oppSlots },
    cpuResult: oppResult,
    myWins: 0,
    cpuWins: 0,
    games: [],
    currentGame: 0,
    isSharedOpponent: true,
    cpuName: '对手',
  };

  showScreen('screen-challenge');
  renderChallengeVS(oppResult, '对手队伍');
  renderChallengeGames();
  setTimeout(simulateNextGame, 500);
}

// ==================== RANDOM TEAM ====================
function generateRandomTeam() {
  const slots = { PG: null, SG: null, SF: null, PF: null, C: null };
  const allDecades = Object.keys(NBA_DATA || {}).filter(d => ALLOWED_ERAS.includes(d));
  const usedCombos = new Set();

  for (const pos of POS_ORDER) {
    let combo;
    let attempts = 0;
    do {
      const decade = allDecades[Math.floor(Math.random() * allDecades.length)];
      const teams = Object.keys((NBA_DATA || {})[decade] || {});
      // 过滤掉没有该位置球员的球队
      const validTeams = teams.filter(t => {
        const players = (NBA_DATA || {})[decade]?.[t] || [];
        return players.some(p => {
          const posList = p.positions?.length ? p.positions : [p.pos];
          return posList.includes(pos);
        });
      });
      
      if (validTeams.length === 0) {
        attempts++;
        continue;
      }
      
      // 2010s/2020s 金霸王概率 10%
      const isBoostEra = decade === '2010s' || decade === '2020s';
      const team = isBoostEra && validTeams.includes('金霸王') && Math.random() < 0.1
        ? '金霸王'
        : validTeams[Math.floor(Math.random() * validTeams.length)];
      combo = decade + '|' + team;
      attempts++;
    } while (usedCombos.has(combo) && attempts < 20);
    
    if (attempts >= 20 || !combo) {
      console.error('Failed to find valid combo for position:', pos);
      continue;
    }
    
    usedCombos.add(combo);

    const [decade, team] = combo.split('|');
    const players = (NBA_DATA || {})[decade]?.[team] || [];
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

function startChallenge() {
  if (window._pendingChallengeOpponent) {
    const opponent = window._pendingChallengeOpponent;
    window._pendingChallengeOpponent = null;
    startChallengeAgainst(opponent);
    return;
  }
  openTeamSelect();
}

function renderChallengeVS(cpuResult, cpuName) {
  const myDiv = document.getElementById('challengeMyTeam');
  const cpuDiv = document.getElementById('challengeCpuTeam');

  // 确保 challengeState 存在
  if (!challengeState) {
    console.error('No challengeState in renderChallengeVS');
    return;
  }
  // 确保 DOM 元素存在
  if (!myDiv || !cpuDiv) {
    console.error('Challenge DOM elements not found');
    return;
  }

  function renderMiniTeam(slots, result, isCpu) {
    const playersHtml = POS_ORDER.map(pos => {
      const p = slots[pos];
      if (!p) return '';
      const colors = TEAM_COLORS[p.team] || ['#333', '#555'];
      return `<div style="width:50px;height:50px;border-radius:8px;background:linear-gradient(135deg,${colors[0]},${colors[1]});display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 4px;border:1px solid ${colors[0]}44;">
        <span style="font-size:9px;color:#fff;">${p.name.split('-').pop()}</span>
        <span style="font-size:8px;color:rgba(255,255,255,0.7);">${pos}</span>
      </div>`;
    }).join('');
    return `<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--orange-light);">${(result.wins != null && result.losses != null) ? result.wins + '-' + result.losses : (result.record || '0-0')} ${result.grade || ''}</div>${playersHtml}`;
  }

  myDiv.innerHTML = `<div style="color:var(--blue-3d);font-size:12px;margin-bottom:4px;">你的队伍</div>${renderMiniTeam(challengeState.mySlots, challengeState.myResult)}`;
  cpuDiv.innerHTML = `<div style="color:var(--red-3d);font-size:12px;margin-bottom:4px;">${cpuName || '对手队伍'}</div>${renderMiniTeam(challengeState.cpuSlots, cpuResult, true)}`;
}

function simulateNextGame() {
  if (!challengeState) {
    console.error('No challengeState in simulateNextGame');
    return;
  }
  // 确保 challengeState 有必要的属性
  if (!challengeState.games || !challengeState.mySlots || !challengeState.cpuSlots) {
    console.error('Incomplete challengeState in simulateNextGame');
    return;
  }
  if (typeof challengeState.myWins !== 'number' || typeof challengeState.cpuWins !== 'number') {
    console.error('Invalid challengeState wins in simulateNextGame');
    challengeState.myWins = challengeState.myWins || 0;
    challengeState.cpuWins = challengeState.cpuWins || 0;
  }
  if (challengeState.myWins >= 4 || challengeState.cpuWins >= 4) {
    renderChallengeFinal();
    return;
  }

  const gameNum = challengeState.currentGame + 1;
  const myMomentum = challengeState.myWins - challengeState.cpuWins;
  const cpuMomentum = challengeState.cpuWins - challengeState.myWins;
  const isMyHome = gameNum % 2 === 1;

  // 判断是否是金霸王防守方（挑战金霸王时，挑战方胜率降低）
  const isJinbaDefender = challengeState.cpuName === '金霸王';

  const myPts = simulateGameScore(challengeState.mySlots, isMyHome, myMomentum, isJinbaDefender);
  const cpuPts = simulateGameScore(challengeState.cpuSlots, !isMyHome, cpuMomentum, false);
  const myWin = myPts > cpuPts;

  if (myWin) challengeState.myWins++;
  else challengeState.cpuWins++;

  const isClincher = challengeState.myWins >= 4 || challengeState.cpuWins >= 4;

  challengeState.games.push({
    num: gameNum,
    myPts,
    cpuPts,
    myWin,
    myWins: challengeState.myWins,
    cpuWins: challengeState.cpuWins,
    isClincher,
    isHome: isMyHome,
  });
  challengeState.currentGame++;

  renderChallengeGames();

  if (challengeState.myWins >= 4 || challengeState.cpuWins >= 4) {
    setTimeout(renderChallengeFinal, 1200);
  } else {
    setTimeout(simulateNextGame, 800);
  }
}

function simulateGameScore(slots, isHome = false, momentum = 0, isJinbaDefender = false) {
  let totalOvr = 0;
  let count = 0;
  const ratings = [];
  const posRatings = {};

  // 确保 slots 是对象
  if (!slots || typeof slots !== 'object') {
    console.error('Invalid slots in simulateGameScore');
    return 70 + Math.floor(Math.random() * 40);
  }

  for (const pos of POS_ORDER) {
    const p = slots[pos];
    if (p) {
      const r = playerRating(p);
      ratings.push(r);
      posRatings[pos] = r;
      totalOvr += r;
      count++;
    }
  }
  if (count === 0) return 70 + Math.floor(Math.random() * 40);

  const avgOvr = totalOvr / count;
  
  // 金霸王被挑战时，挑战方（myTeam）胜率降低到10%
  // 通过大幅降低挑战方得分来实现
  let baseScore = 90 + (avgOvr - 70) * 0.6;
  if (isJinbaDefender && !isHome) {
    // 挑战方得分大幅降低（胜率约10%）
    baseScore = baseScore * 0.75; // 降低25%得分
  }
  
  const variation = (Math.random() - 0.5) * 16;
  const maxRating = Math.max(...ratings);
  const starBoost = (maxRating - avgOvr) * 0.3;

  let chemistryBonus = 0;
  const guards = (posRatings['PG'] || 0) + (posRatings['SG'] || 0);
  const center = posRatings['C'] || 0;
  if (guards > 0 && center > 0) {
    const balance = Math.min(guards / 2, center) / Math.max(guards / 2, center);
    if (balance > 0.7) chemistryBonus += 3;
  }

  const hasPlaymaker = posRatings['PG'] && posRatings['PG'] > 85;
  const hasScorer = (posRatings['SG'] || posRatings['SF']) && Math.max(posRatings['SG'] || 0, posRatings['SF'] || 0) > 85;
  if (hasPlaymaker && hasScorer) chemistryBonus += 2;

  const bigMen = (posRatings['PF'] || 0) + (posRatings['C'] || 0);
  if (bigMen > 170) chemistryBonus += 2;

  const homeAdvantage = isHome ? 2 : 0;
  const momentumBonus = momentum * 1.5;

  return Math.round(Math.max(70, Math.min(140,
    baseScore + variation + starBoost + chemistryBonus + homeAdvantage + momentumBonus
  )));
}

function renderChallengeGames() {
  // 确保 challengeState 和 games 存在
  if (!challengeState || !challengeState.games) {
    console.error('No challengeState or games in renderChallengeGames');
    return;
  }
  const container = document.getElementById('challengeGames');
  const scoreDiv = document.getElementById('challengeResult');

  scoreDiv.innerHTML = `<div style="font-size:28px;font-weight:900;">
    <span style="color:var(--blue)">${challengeState.myWins}</span>
    <span style="color:var(--text-secondary);margin:0 12px;">-</span>
    <span style="color:var(--pink)">${challengeState.cpuWins}</span>
  </div>
  <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">先赢4场获胜(最多7场)</div>`;

  container.innerHTML = challengeState.games.map(g => {
    const cls = g.myWin ? 'game-win' : 'game-lose';
    const icon = g.myWin ? '✅' : '❌';
    const homeIcon = g.isHome ? '🏠' : '✈️';
    const report = generateGameReport(g);
    return `<div class="challenge-game ${cls}">
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="game-num">G${g.num} ${homeIcon}</span>
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
  const cpuName = challengeState.cpuName || '对手';

  const winningSlots = myWin ? challengeState.mySlots : challengeState.cpuSlots;
  const mvp = selectMVP(winningSlots);
  const mvpHighlight = generateMVPHighlight(mvp, challengeState.games);

  // 先保存MVP数据，再生成HTML（避免onclick引用时还未赋值）
  if (mvp) {
    window._lastMVP = mvp;
    window._lastMVPHighlight = mvpHighlight;
  }

  resultDiv.innerHTML = `
    <div style="font-size:36px;font-weight:900;margin:16px 0;color:${myWin ? 'var(--green-3d)' : 'var(--red-3d)'}">
      ${myWin ? '🏆 挑战成功!' : '💔 挑战失败'}
    </div>
    <div style="font-size:18px;color:var(--text-secondary);">
      ${myWin ? `${challengeState.myWins}-${challengeState.cpuWins} 击败${cpuName}!` : `${challengeState.myWins}-${challengeState.cpuWins} 惜败${cpuName}`}
    </div>
    ${mvp ? `<div style="margin:16px 0;padding:12px;background:rgba(243,156,18,0.1);border-radius:12px;border:1px solid var(--gold);">
      <div style="font-size:14px;color:var(--gold);font-weight:700;">🏆 系列赛MVP:${mvp.name.split('-').pop()}</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${mvpHighlight.substring(0, 80)}...</div>
      <button class="btn-3d orange" style="margin-top:8px;font-size:12px;padding:6px 16px;" onclick="showMVPModal(window._lastMVP, window._lastMVPHighlight)">📖 查看完整高光时刻</button>
    </div>` : ''}
    <div class="result-buttons-group" style="margin-top:16px;">
      <button class="btn-3d orange" onclick="startGame()">🔄 重新创建队伍</button>
      <button class="btn-3d dark" onclick="startChallenge()">⚔️ 再来一局挑战</button>
      <button class="btn-3d dark" onclick="challengeJinbaKing()">👑 再挑战金霸王</button>
      <button class="btn-3d dark" onclick="showScreen('screen-home')">🏠 首页</button>
    </div>
  `;

  if (mvp) {
    window._lastMVP = mvp;
    window._lastMVPHighlight = mvpHighlight;
    setTimeout(() => showMVPModal(mvp, mvpHighlight), 1500);
  }
}

// ==================== CONFETTI ====================
function launchConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  if (!document.body) {
    console.error('No document.body in launchConfetti');
    return;
  }
  document.body.appendChild(container);

  const colors = ['#f39c12','#e74c3c','#27ae60','#3498db','#9b59b6','#f1c40f','#e67e22','#1abc9c'];
  const shapes = ['✅', '❌', '⭐', '🔥'];

  for (let i = 0; i < 120; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    piece.style.left = Math.random() * 100 + '%';
    piece.style.color = colors[Math.floor(Math.random() * colors.length)];
    piece.style.fontSize = (Math.random() * 12 + 8) + 'px';
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    piece.style.animationDelay = (Math.random() * 2) + 's';
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 5000);
}

// ==================== POSTER ====================
function showPoster() {
  const overlay = document.getElementById('posterOverlay');
  const content = document.getElementById('posterContent');

  // 确保游戏数据存在
  if (!game.slots || !game.wins) {
    console.error('No game data for poster');
    return;
  }

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
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Canvas context not available');
    return;
  }
  const W = 600, H = 900;
  canvas.width = W * 2;
  canvas.height = H * 2;
  ctx.scale(2, 2);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, '#f39c12');
  topGrad.addColorStop(0.5, '#e67e22');
  topGrad.addColorStop(1, '#ff6b9d');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, 4);

  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏀 是男人就来单挑', W/2, 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(`${game.wins}-${game.losses}`, W/2, 140);

  const gradeColor = game.grade === 'S' ? '#a855f7' : game.grade.startsWith('A') ? '#22c55e' : game.grade === 'B' ? '#3b82f6' : game.grade === 'C' ? '#f59e0b' : '#64748b';
  ctx.fillStyle = gradeColor;
  ctx.font = 'bold 80px sans-serif';
  ctx.fillText(game.grade, W/2, 240);

  ctx.font = '20px sans-serif';
  ctx.fillText(game.tier, W/2, 280);

  const slotW = 90, slotH = 90, gap = 12;
  const startX = (W - (slotW * 3 + gap * 2)) / 2;

  let x = startX + (slotW + gap);
  let y = 330;
  ['PG', 'SG'].forEach(pos => {
    drawPlayerSlot(ctx, x, y, slotW, slotH, game.slots[pos], pos);
    x += slotW + gap;
  });

  x = startX;
  y = 440;
  ['SF', 'C', 'PF'].forEach(pos => {
    drawPlayerSlot(ctx, x, y, slotW, slotH, game.slots[pos], pos);
    x += slotW + gap;
  });

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px sans-serif';
  ctx.fillText('扫码来挑战 · 看看谁更厉害', W/2, H - 40);

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

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
  initParticles();
  handleShareLink();
});
