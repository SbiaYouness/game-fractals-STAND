// ══════════════════════════════════════
// SYSTEM & AUDIO
// ══════════════════════════════════════
const AudioContext = window.AudioContext || window.webkitAudioContext;
let actx = null;

function initAudio() {
  if (!actx) actx = new AudioContext();
  if (actx.state === 'suspended') actx.resume();
}

function playSound(type) {
  if (!actx) return;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.connect(gain);
  gain.connect(actx.destination);
  
  const now = actx.currentTime;
  if (type === 'tick') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'lock') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now); osc.stop(now + 0.2);
  } else if (type === 'win') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    osc.frequency.setValueAtTime(800, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  } else if (type === 'gameover') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 1);
    osc.start(now); osc.stop(now + 1);
  }
}

// ══════════════════════════════════════
// DATA & CONFIG
// ══════════════════════════════════════
const CONFIG = {
  duelRounds: 5,
  duelRoundTime: 40,
  soloTotalTime: 60, // 1 minute
  blindTime: 5
};

const FRACTALS = {
  tree: { 
    label: 'Binary Tree', 
    formula: 'Total Branches = 2ⁿ⁺¹ - 1',
    maxDepth: 10
  },
  snowflake: { 
    label: 'Koch Curve', 
    formula: 'Length Lₙ = L₀ · (4/3)ⁿ | dim ≈ 1.261',
    maxDepth: 6
  },
  fern: { 
    label: 'Spiral Fern', 
    formula: 'Affine IFS: f(x) = Ax + b',
    maxDepth: 9
  },
  sierpinski: { 
    label: 'Sierpinski Gasket', 
    formula: 'Area Aₙ = A₀ · (3/4)ⁿ | dim ≈ 1.585',
    maxDepth: 8
  }
};
const FRACTAL_KEYS = Object.keys(FRACTALS);

function randomLevel() {
  const type = FRACTAL_KEYS[Math.floor(Math.random() * FRACTAL_KEYS.length)];
  const isBlind = Math.random() < 0.25; // 25% chance blind
  
  let angle, depth;
  if (type === 'tree') { angle = randInt(20, 80); depth = randInt(4, 9); }
  else if (type === 'snowflake') { angle = randInt(25, 75); depth = randInt(2, 5); }
  else if (type === 'fern') { angle = randInt(30, 70); depth = randInt(4, 8); }
  else if (type === 'sierpinski') { angle = randInt(0, 90); depth = randInt(2, 7); }
  
  return { type, angle, depth, isBlind, meta: FRACTALS[type] };
}

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
let gameMode = 'solo'; // 'solo' | 'duel'
let names = ['Player 1', 'Player 2'];
let scores = [0, 0];
let currentRound = 0;
let currentLevel = null;

let timeRemaining = 0;
let timerInterval = null;
let blindTimer = null;
let roundActive = false;

let p1 = { angle: 45, depth: 5, locked: false };
let p2 = { angle: 45, depth: 5, locked: false };
const keys = {};

// ══════════════════════════════════════
// UI INIT
// ══════════════════════════════════════
function selectMode(mode) {
  gameMode = mode;
  document.getElementById('btnModeSolo').classList.toggle('active', mode === 'solo');
  document.getElementById('btnModeDuel').classList.toggle('active', mode === 'duel');
  
  const p2Group = document.getElementById('p2InputGroup');
  const soloSliders = document.getElementById('soloSliders');
  if (mode === 'solo') {
    p2Group.classList.add('hidden');
    soloSliders.classList.remove('hidden');
  } else {
    p2Group.classList.remove('hidden');
    soloSliders.classList.add('hidden');
  }
}

function startGame(btn) {
  btn.blur();
  initAudio();
  playSound('win');
  
  names[0] = document.getElementById('nameP1').value.trim() || 'Player 1';
  names[1] = document.getElementById('nameP2').value.trim() || 'Player 2';
  
  document.getElementById('scoreNameP1').textContent = names[0];
  document.getElementById('p1PanelTitle').textContent = names[0];
  
  if (gameMode === 'duel') {
    document.getElementById('scoreNameP2').textContent = names[1];
    document.getElementById('p2PanelTitle').textContent = names[1];
    document.getElementById('modeBadge').textContent = '1V1 DUEL';
    document.getElementById('scoreCardP2').style.display = 'flex';
    document.getElementById('p2Content').classList.remove('hidden');
    document.getElementById('leaderboardContent').classList.add('hidden');
  } else {
    document.getElementById('modeBadge').textContent = 'SOLO ARCADE';
    document.getElementById('scoreCardP2').style.display = 'none';
    document.getElementById('p2Content').classList.add('hidden');
    document.getElementById('leaderboardContent').classList.remove('hidden');
    renderLeaderboard();
  }

  document.getElementById('nameScreen').classList.remove('active');
  document.getElementById('gameScreen').classList.add('active');
  
  scores = [0, 0];
  document.getElementById('scoreNumP1').textContent = '0';
  document.getElementById('scoreNumP2').textContent = '0';
  currentRound = 0;
  
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
  
  if (gameMode === 'solo') startSoloGame();
  else beginDuelRound();
  
  requestAnimationFrame(renderLoop);
}

// ══════════════════════════════════════
// SOLO ARCADE MODE
// ══════════════════════════════════════
function startSoloGame() {
  timeRemaining = CONFIG.soloTotalTime;
  document.getElementById('roundChip').textContent = 'ARCADE TIMED';
  startMainTimer();
  nextSoloTarget();
}

function nextSoloTarget() {
  if (timeRemaining <= 0) return;
  currentLevel = randomLevel();
  p1 = { angle: 45, depth: 5, locked: false };
  roundActive = false;
  
  document.getElementById('p1Zone').classList.remove('locked');
  document.getElementById('p1LockMsg').style.opacity = '0';
  
  document.getElementById('targetInfo').textContent = currentLevel.meta.label;
  document.getElementById('mathFormula').textContent = currentLevel.meta.formula;
  document.getElementById('blindShield').classList.remove('active');
  
  if (currentLevel.isBlind) {
    let left = CONFIG.blindTime;
    document.getElementById('blindWarning').classList.remove('hidden');
    document.getElementById('blindCount').textContent = left;
    clearInterval(blindTimer);
    blindTimer = setInterval(() => {
      left--; document.getElementById('blindCount').textContent = left;
      if (left <= 0) {
        clearInterval(blindTimer);
        document.getElementById('blindWarning').classList.add('hidden');
        document.getElementById('blindShield').classList.add('active');
        roundActive = true;
      }
    }, 1000);
  } else {
    document.getElementById('blindWarning').classList.add('hidden');
    roundActive = true;
  }
  
  // Setup Sliders for Solo
  const minA = currentLevel.type === 'sierpinski' ? 0 : 10;
  const maxA = currentLevel.type === 'sierpinski' ? 360 : 85;
  const maxD = currentLevel.meta.maxDepth || 10;
  
  const aSlider = document.getElementById('p1AngleSlider');
  const dSlider = document.getElementById('p1DepthSlider');
  aSlider.min = minA; aSlider.max = maxA; aSlider.value = p1.angle;
  dSlider.min = 1; dSlider.max = maxD; dSlider.value = p1.depth;
}

function lockSoloRound() {
  if (p1.locked || !roundActive) return;
  p1.locked = true;
  roundActive = false;
  document.getElementById('p1Zone').classList.add('locked');
  document.getElementById('p1LockMsg').style.opacity = '1';
  document.getElementById('blindShield').classList.remove('active');
  playSound('lock');
  
  const result = computeScore(p1, currentLevel);
  let pts = 0;
  if (result.sync >= 95) pts = 300;
  else if (result.sync >= 85) pts = 100;
  else if (result.sync >= 70) pts = 50;
  
  if (pts > 0) {
    scores[0] += pts;
    document.getElementById('scoreNumP1').textContent = scores[0];
    flashFeedback(`+${pts}`);
    playSound('win');
    renderLeaderboard();
  } else {
    flashFeedback(`MISS`);
    playSound('tick');
  }
  
  setTimeout(() => {
    if (timeRemaining > 0) nextSoloTarget();
  }, 800);
}

function flashFeedback(msg) {
  const fb = document.getElementById('feedbackFlash');
  fb.textContent = msg;
  fb.classList.remove('hidden', 'animate');
  void fb.offsetWidth; // trigger reflow
  fb.classList.add('animate');
}

// ══════════════════════════════════════
// DUEL MODE
// ══════════════════════════════════════
function beginDuelRound() {
  currentLevel = randomLevel();
  p1 = { angle: 45, depth: 5, locked: false };
  p2 = { angle: 45, depth: 5, locked: false };
  roundActive = false;

  document.getElementById('roundChip').textContent = `Round ${currentRound + 1} / ${CONFIG.duelRounds}`;
  document.getElementById('targetInfo').textContent = currentLevel.meta.label;
  document.getElementById('mathFormula').textContent = currentLevel.meta.formula;
  
  document.getElementById('p1Zone').classList.remove('locked');
  document.getElementById('p2Zone').classList.remove('locked');
  document.getElementById('p1LockMsg').style.opacity = '0';
  document.getElementById('p2LockMsg').style.opacity = '0';
  document.getElementById('blindShield').classList.remove('active');

  if (currentLevel.isBlind) {
    let left = CONFIG.blindTime;
    document.getElementById('blindWarning').classList.remove('hidden');
    document.getElementById('blindCount').textContent = left;
    clearInterval(blindTimer);
    blindTimer = setInterval(() => {
      left--; document.getElementById('blindCount').textContent = left;
      if (left <= 0) {
        clearInterval(blindTimer);
        document.getElementById('blindWarning').classList.add('hidden');
        document.getElementById('blindShield').classList.add('active');
        timeRemaining = CONFIG.duelRoundTime;
        startMainTimer();
      }
    }, 1000);
  } else {
    document.getElementById('blindWarning').classList.add('hidden');
    timeRemaining = CONFIG.duelRoundTime;
    startMainTimer();
  }
}

function lockDuelPlayer(playerNum) {
  if (!roundActive) return;
  playSound('lock');
  if (playerNum === 1 && !p1.locked) {
    p1.locked = true;
    document.getElementById('p1Zone').classList.add('locked');
    document.getElementById('p1LockMsg').style.opacity = '1';
  } else if (playerNum === 2 && !p2.locked) {
    p2.locked = true;
    document.getElementById('p2Zone').classList.add('locked');
    document.getElementById('p2LockMsg').style.opacity = '1';
  }
  
  if (p1.locked && p2.locked) {
    roundActive = false;
    clearInterval(timerInterval);
    setTimeout(showDuelRoundResult, 600);
  }
}

// ══════════════════════════════════════
// SHARED TIMER
// ══════════════════════════════════════
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m.toString().padStart(2,'0')}:${sec}`;
}

function startMainTimer() {
  roundActive = true;
  clearInterval(timerInterval);
  const bar = document.getElementById('timerBar');
  const txt = document.getElementById('timerText');
  const maxTime = gameMode === 'solo' ? CONFIG.soloTotalTime : CONFIG.duelRoundTime;
  
  timerInterval = setInterval(() => {
    timeRemaining -= 0.1;
    if (timeRemaining < 0) timeRemaining = 0;
    
    const pct = (timeRemaining / maxTime) * 100;
    bar.style.width = pct + '%';
    txt.textContent = formatTime(timeRemaining);
    
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      if (gameMode === 'solo') {
        endSoloGame();
      } else {
        if (!p1.locked) lockDuelPlayer(1);
        if (!p2.locked) lockDuelPlayer(2);
      }
    }
  }, 100);
}

function endSoloGame() {
  roundActive = false;
  playSound('gameover');
  saveLeaderboard(names[0], scores[0]);
  renderLeaderboard();
  
  document.getElementById('matchWinnerName').textContent = 'Time Up!';
  document.getElementById('matchWinnerName').style.color = 'var(--accent-main)';
  document.getElementById('matchSubMsg').textContent = 'Solo Arcade Complete';
  document.getElementById('finalScoreRow').innerHTML = `
    <div class="fs-block">
      <div class="fs-name p1-text">${names[0]}</div>
      <div class="fs-val">${scores[0]} PTS</div>
    </div>
  `;
  document.getElementById('matchOverlay').classList.add('show');
}

// ══════════════════════════════════════
// SCORING & RESULTS (DUEL)
// ══════════════════════════════════════
function computeScore(guess, lvl) {
  const angleDiff = Math.abs(guess.angle - lvl.angle);
  const depthDiff = Math.abs(guess.depth - lvl.depth);
  const maxA = lvl.type === 'sierpinski' ? 180 : 75;
  
  // Harsh scoring:
  const penalty = Math.pow(angleDiff / maxA, 0.75) * 0.7 + Math.pow(depthDiff / 9, 0.75) * 0.3;
  const sync = Math.max(0, Math.round((1 - penalty * 1.5) * 100));
  
  return { angleDiff, depthDiff, sync };
}

function showDuelRoundResult() {
  document.getElementById('blindShield').classList.remove('active');
  
  const r1 = computeScore(p1, currentLevel);
  const r2 = computeScore(p2, currentLevel);

  let winner = -1;
  if (r1.sync > r2.sync) winner = 0;
  else if (r2.sync > r1.sync) winner = 1;
  
  if (winner !== -1) { scores[winner]++; playSound('win'); }
  else playSound('tick');

  document.getElementById('scoreNumP1').textContent = scores[0];
  document.getElementById('scoreNumP2').textContent = scores[1];

  const title = document.getElementById('resultTitle');
  if (winner === 0) { title.textContent = names[0] + ' Wins Round'; title.style.color = 'var(--p1-main)'; } 
  else if (winner === 1) { title.textContent = names[1] + ' Wins Round'; title.style.color = 'var(--p2-main)'; } 
  else { title.textContent = 'Draw!'; title.style.color = 'var(--text-main)'; }

  document.getElementById('resultSub').innerHTML = `Target: Angle ${Math.round(currentLevel.angle)}&deg; | Depth ${currentLevel.depth}`;
  document.getElementById('resultGrid').innerHTML = 
    makeResultCard(0, r1, winner === 0, p1) + 
    makeResultCard(1, r2, winner === 1, p2);

  document.getElementById('roundOverlay').classList.add('show');
}

function makeResultCard(idx, r, isWinner, guess) {
  const name = names[idx];
  const winCls = isWinner ? 'winner' : '';
  const ptsHtml = isWinner ? `<div class="pts-award">+1 Point</div>` : '';
  const colorClass = idx === 0 ? 'p1-text' : 'p2-text';

  return `
  <div class="res-card ${winCls}">
    <div class="res-name ${colorClass}">${name}</div>
    <div class="res-row">Angle Guess <span>${Math.round(guess.angle)}&deg;</span></div>
    <div class="res-row">Depth Guess <span>${guess.depth}</span></div>
    <div class="res-row res-sync">Sync Rating <span>${r.sync}%</span></div>
    ${ptsHtml}
  </div>`;
}

function nextRound(btn) {
  if (btn) btn.blur();
  document.getElementById('roundOverlay').classList.remove('show');
  currentRound++;
  if (currentRound >= CONFIG.duelRounds) showDuelMatchResult();
  else beginDuelRound();
}

function showDuelMatchResult() {
  playSound('gameover');
  let winnerIdx = scores[1] > scores[0] ? 1 : 0;
  let isTie = scores[0] === scores[1];
  
  const title = document.getElementById('matchWinnerName');
  if (isTie) { title.textContent = 'Tie Game'; title.style.color = 'var(--text-main)'; } 
  else { title.textContent = names[winnerIdx] + ' Wins'; title.style.color = winnerIdx === 0 ? 'var(--p1-main)' : 'var(--p2-main)'; }

  document.getElementById('matchSubMsg').textContent = 'Match Complete';
  document.getElementById('finalScoreRow').innerHTML = `
    <div class="fs-block"><div class="fs-name p1-text">${names[0]}</div><div class="fs-val">${scores[0]}</div></div>
    <div class="fs-vs">-</div>
    <div class="fs-block"><div class="fs-name p2-text">${names[1]}</div><div class="fs-val">${scores[1]}</div></div>
  `;
  document.getElementById('matchOverlay').classList.add('show');
}

function rematch(btn) {
  if (btn) btn.blur();
  document.getElementById('matchOverlay').classList.remove('show');
  scores = [0, 0];
  currentRound = 0;
  document.getElementById('scoreNumP1').textContent = '0';
  document.getElementById('scoreNumP2').textContent = '0';
  
  if (gameMode === 'solo') startSoloGame();
  else beginDuelRound();
}

function goToMenu(btn) {
  if (btn) btn.blur();
  // Hide current match overlay and game screen
  document.getElementById('matchOverlay').classList.remove('show');
  document.getElementById('gameScreen').classList.remove('active');
  
  // Show menu screen
  document.getElementById('nameScreen').classList.add('active');
  
  // Clear the input fields so new players can type their names
  document.getElementById('nameP1').value = '';
  document.getElementById('nameP2').value = '';
  
  // Stop current loops/timers
  roundActive = false;
  clearInterval(timerInterval);
  clearInterval(blindTimer);
}

// ══════════════════════════════════════
// LEADERBOARD (LOCALSTORAGE)
// ══════════════════════════════════════
function saveLeaderboard(name, score) {
  if (score <= 0) return;
  let lb = JSON.parse(localStorage.getItem('fractalLB') || '[]');
  lb.push({ name, score });
  lb.sort((a,b) => b.score - a.score);
  lb = lb.slice(0, 10);
  localStorage.setItem('fractalLB', JSON.stringify(lb));
}

function renderLeaderboard() {
  let lb = JSON.parse(localStorage.getItem('fractalLB') || '[]');
  
  if (gameMode === 'solo' && timeRemaining > 0) {
    lb.push({ name: names[0] + ' (You)', score: scores[0], isCurrent: true });
  }
  
  lb.sort((a,b) => b.score - a.score);
  lb = lb.slice(0, 10);

  const tbody = document.getElementById('lbTableBody');
  if (lb.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No records yet</td></tr>';
    return;
  }
  let html = '';
  lb.forEach((entry, i) => {
    const rowStyle = entry.isCurrent ? 'background-color: rgba(16, 185, 129, 0.2);' : '';
    const nameColor = entry.isCurrent ? 'var(--success)' : 'inherit';
    const weight = entry.isCurrent ? '700' : 'normal';
    html += `<tr style="${rowStyle}">
      <td class="lb-rank">#${i+1}</td>
      <td style="color:${nameColor}; font-weight:${weight}">${entry.name}</td>
      <td class="lb-score" style="color:${entry.isCurrent?'var(--success)':'var(--accent-main)'}">${entry.score}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function resetLeaderboard() {
  if (confirm("Are you sure you want to clear all top scores? This cannot be undone.")) {
    localStorage.removeItem('fractalLB');
    renderLeaderboard();
  }
}

// ══════════════════════════════════════
// KEYBOARD HANDLER
// ══════════════════════════════════════
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  
  if (!roundActive) return;
  if (e.repeat) return;
  
  const maxDP1 = currentLevel?.meta.maxDepth || 10;
  
  if (!p1.locked) {
    if (k === 'a') { p1.depth = Math.max(1, p1.depth - 1); playSound('tick'); }
    if (k === 'd') { p1.depth = Math.min(maxDP1, p1.depth + 1); playSound('tick'); }
    if (k === ' ') {
      if (gameMode === 'solo') lockSoloRound();
      else lockDuelPlayer(1);
    }
  }

  if (gameMode === 'duel' && !p2.locked) {
    if (k === 'arrowleft') { p2.depth = Math.max(1, p2.depth - 1); playSound('tick'); }
    if (k === 'arrowright') { p2.depth = Math.min(maxDP1, p2.depth + 1); playSound('tick'); }
    if (k === 'enter') lockDuelPlayer(2);
  }
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// SLIDERS (SOLO ONLY)
document.getElementById('p1AngleSlider').addEventListener('input', e => {
  if (p1.locked || !roundActive || gameMode !== 'solo') return;
  p1.angle = parseFloat(e.target.value);
  document.getElementById('p1AngleVal').innerHTML = Math.round(p1.angle) + '&deg;';
});
document.getElementById('p1DepthSlider').addEventListener('input', e => {
  if (p1.locked || !roundActive || gameMode !== 'solo') return;
  p1.depth = parseInt(e.target.value);
  document.getElementById('p1DepthVal').textContent = p1.depth;
});

// ══════════════════════════════════════
// RENDER LOOP
// ══════════════════════════════════════
const tCanvas = document.getElementById('targetCanvas');
const p1Canvas = document.getElementById('p1Canvas');
const p2Canvas = document.getElementById('p2Canvas');
const tCtx = tCanvas.getContext('2d');
const p1Ctx = p1Canvas.getContext('2d');
const p2Ctx = p2Canvas.getContext('2d');
let tSize = 400, pSize = 400;

function resizeCanvases() {
  tSize = setupCanvas(tCanvas);
  pSize = setupCanvas(p1Canvas);
  if (gameMode === 'duel') setupCanvas(p2Canvas);
}
function setupCanvas(c) {
  const dpr = window.devicePixelRatio || 1;
  const rect = c.parentElement.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height) - 32;
  c.width = size * dpr; c.height = size * dpr;
  c.style.width = size + 'px'; c.style.height = size + 'px';
  c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  return size;
}

let lastTime = performance.now();
function renderLoop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;
  
  if (roundActive && currentLevel) {
    const angleSpeed = 50; 
    const maxA = currentLevel.type === 'sierpinski' ? 360 : 85;
    const minA = currentLevel.type === 'sierpinski' ? 0 : 10;
    
    if (!p1.locked) {
      if (keys['w']) p1.angle += angleSpeed * dt;
      if (keys['s']) p1.angle -= angleSpeed * dt;
      p1.angle = clamp(p1.angle, minA, maxA);
      document.getElementById('p1AngleVal').innerHTML = Math.round(p1.angle) + '&deg;';
      document.getElementById('p1DepthVal').textContent = p1.depth;
      
      if (gameMode === 'solo') {
        document.getElementById('p1AngleSlider').value = p1.angle;
        document.getElementById('p1DepthSlider').value = p1.depth;
      }
    }
    if (gameMode === 'duel' && !p2.locked) {
      if (keys['arrowup']) p2.angle += angleSpeed * dt;
      if (keys['arrowdown']) p2.angle -= angleSpeed * dt;
      p2.angle = clamp(p2.angle, minA, maxA);
      document.getElementById('p2AngleVal').innerHTML = Math.round(p2.angle) + '&deg;';
      document.getElementById('p2DepthVal').textContent = p2.depth;
    }
  }

  if (currentLevel) {
    drawFractal(tCtx, tSize, currentLevel.type, currentLevel.angle, currentLevel.depth, 'target');
    drawFractal(p1Ctx, pSize, currentLevel.type, p1.angle, p1.depth, 'p1');
    if (gameMode === 'duel') {
      drawFractal(p2Ctx, pSize, currentLevel.type, p2.angle, p2.depth, 'p2');
    }
  }
  requestAnimationFrame(renderLoop);
}

// ══════════════════════════════════════
// FRACTALS
// ══════════════════════════════════════
function drawFractal(ctx, size, type, angle, depth, palette) {
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.save();
  if (type === 'sierpinski') {
    ctx.translate(size/2, size/2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.translate(-size/2, -size/2);
    drawSierpinski(ctx, size, depth, palette);
  } else {
    ctx.translate(size/2, size*0.85);
    if (type === 'tree') drawTree(ctx, size, angle, depth, palette);
    else if (type === 'snowflake') {
      ctx.restore(); ctx.save();
      ctx.translate(size/2, size/2 + size*0.1);
      drawSnowflake(ctx, size, angle, depth, palette);
    }
    else if (type === 'fern') drawFern(ctx, size, angle, depth, palette);
  }
  ctx.restore();
}

function getColor(palette) {
  if (palette === 'target') return '#a78bfa';
  if (palette === 'p1') return '#38bdf8';
  return '#fb7185';
}

function drawTree(ctx, size, angle, depth, palette) {
  ctx.strokeStyle = getColor(palette);
  _drawTreeBranch(ctx, 0, 0, -Math.PI/2, size*0.25, depth, angle*Math.PI/180, depth);
}
function _drawTreeBranch(ctx, x, y, dir, len, depth, angleRad, maxD) {
  if (depth <= 0 || len < 1) return;
  const x2 = x + Math.cos(dir)*len;
  const y2 = y + Math.sin(dir)*len;
  ctx.lineWidth = Math.max(1, (depth/maxD)*5);
  ctx.globalAlpha = 0.4 + 0.6*(depth/maxD);
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x2,y2); ctx.stroke();
  _drawTreeBranch(ctx, x2, y2, dir - angleRad, len*0.7, depth-1, angleRad, maxD);
  _drawTreeBranch(ctx, x2, y2, dir + angleRad, len*0.7, depth-1, angleRad, maxD);
}

function drawSnowflake(ctx, size, angle, depth, palette) {
  const r = size * 0.35;
  const pts = [];
  for(let i=0; i<3; i++) {
    const a = (i*120 - 90 + (angle-45)*0.5) * Math.PI/180;
    pts.push({x: r*Math.cos(a), y: r*Math.sin(a)});
  }
  ctx.strokeStyle = getColor(palette); ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for(let i=0; i<3; i++) _koch(ctx, pts[i].x, pts[i].y, pts[(i+1)%3].x, pts[(i+1)%3].y, depth);
  ctx.closePath(); ctx.stroke();
}
function _koch(ctx, x1, y1, x2, y2, d) {
  if (d <= 1) { ctx.lineTo(x2, y2); return; }
  const dx = x2-x1, dy = y2-y1;
  const len = Math.sqrt(dx*dx+dy*dy)/3;
  const ang = Math.atan2(dy,dx);
  const p1x = x1+dx/3, p1y = y1+dy/3;
  const p3x = x1+2*dx/3, p3y = y1+2*dy/3;
  const p2x = p1x + Math.cos(ang - Math.PI/3)*len;
  const p2y = p1y + Math.sin(ang - Math.PI/3)*len;
  _koch(ctx, x1,y1, p1x,p1y, d-1);
  _koch(ctx, p1x,p1y, p2x,p2y, d-1);
  _koch(ctx, p2x,p2y, p3x,p3y, d-1);
  _koch(ctx, p3x,p3y, x2,y2, d-1);
}

function drawFern(ctx, size, angle, depth, palette) {
  ctx.strokeStyle = getColor(palette);
  _drawFern(ctx, 0, 0, -Math.PI/2, size*0.25, depth, angle*Math.PI/180, depth);
}
function _drawFern(ctx, x, y, dir, len, depth, angleRad, maxD) {
  if (depth <= 0 || len < 1.5) return;
  const x2 = x + Math.cos(dir)*len;
  const y2 = y + Math.sin(dir)*len;
  ctx.lineWidth = Math.max(0.5, (depth/maxD)*4);
  ctx.globalAlpha = 0.4 + 0.6*(depth/maxD);
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x2,y2); ctx.stroke();
  _drawFern(ctx, x2, y2, dir, len*0.7, depth-1, angleRad, maxD);
  if (depth > 1) {
    _drawFern(ctx, x2, y2, dir - angleRad, len*0.5, depth-2, angleRad, maxD);
    _drawFern(ctx, x2, y2, dir + angleRad, len*0.5, depth-2, angleRad, maxD);
  }
}

function drawSierpinski(ctx, size, depth, palette) {
  const margin = size * 0.15;
  const w = size - margin*2;
  const h = w * Math.sqrt(3)/2;
  const cx = size/2; const cy = size/2 + h/4;
  const p1 = { x: cx, y: cy - h*2/3 };
  const p2 = { x: cx - w/2, y: cy + h/3 };
  const p3 = { x: cx + w/2, y: cy + h/3 };
  ctx.fillStyle = getColor(palette); ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  _sierpinskiCut(ctx, p1, p2, p3, depth);
  ctx.globalCompositeOperation = 'source-over';
}
function _sierpinskiCut(ctx, p1, p2, p3, depth) {
  if (depth <= 1) return;
  const m1 = { x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2 };
  const m2 = { x: (p2.x+p3.x)/2, y: (p2.y+p3.y)/2 };
  const m3 = { x: (p3.x+p1.x)/2, y: (p3.y+p1.y)/2 };
  ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.lineTo(m3.x, m3.y); ctx.closePath(); ctx.fill();
  _sierpinskiCut(ctx, p1, m1, m3, depth-1);
  _sierpinskiCut(ctx, m1, p2, m2, depth-1);
  _sierpinskiCut(ctx, m3, m2, p3, depth-1);
}
