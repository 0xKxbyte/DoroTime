'use strict';

/* ============================================================
   DoroTime — main.js
   Estado simples (idle, focus, paused, rest, completed) +
   timer, tema, áudio e configurações, tudo salvo em localStorage.
   ============================================================ */

// ---------- Constantes ----------
const STORAGE_KEYS = {
  NAME: 'doroTime_name',
  SETTINGS: 'doroTime_settings',
  STATS: 'doroTime_stats'
};

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  restMinutes: 5,
  soundOn: true,
  volume: 70,
  theme: 'light'
};

// ---------- Elementos ----------
const el = {
  onboardingScreen: document.getElementById('screen-onboarding'),
  homeScreen: document.getElementById('screen-home'),
  formOnboarding: document.getElementById('form-onboarding'),
  inputName: document.getElementById('input-name'),
  greetingName: document.getElementById('text-greeting-name'),

  phaseBadge: document.getElementById('phase-badge'),
  ringProgress: document.getElementById('ring-progress'),
  timerDisplay: document.getElementById('timer-display'),
  timerSub: document.getElementById('timer-sub'),
  sessionMeta: document.getElementById('session-meta'),

  controlsIdle: document.getElementById('controls-idle'),
  controlsRunning: document.getElementById('controls-running'),
  controlsPaused: document.getElementById('controls-paused'),
  controlsCompleted: document.getElementById('controls-completed'),

  btnStart: document.getElementById('btn-start'),
  btnPause: document.getElementById('btn-pause'),
  btnStopRunning: document.getElementById('btn-stop-running'),
  btnResume: document.getElementById('btn-resume'),
  btnRestart: document.getElementById('btn-restart'),
  btnStopPaused: document.getElementById('btn-stop-paused'),
  btnNewSession: document.getElementById('btn-new-session'),

  durationSection: document.getElementById('duration-section'),
  chipsFocus: document.getElementById('chips-focus'),
  chipsRest: document.getElementById('chips-rest'),
  customFocusWrap: document.getElementById('custom-focus-wrap'),
  customRestWrap: document.getElementById('custom-rest-wrap'),
  inputCustomFocus: document.getElementById('input-custom-focus'),
  inputCustomRest: document.getElementById('input-custom-rest'),

  statSessions: document.getElementById('stat-sessions'),
  statMinutes: document.getElementById('stat-minutes'),

  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  modalSettings: document.getElementById('modal-settings'),
  formSettings: document.getElementById('form-settings'),
  inputSettingsName: document.getElementById('input-settings-name'),
  inputSettingsSound: document.getElementById('input-settings-sound'),
  inputSettingsVolume: document.getElementById('input-settings-volume'),
  settingsThemeGroup: document.getElementById('settings-theme-group'),
  settingsDefaultFocus: document.getElementById('settings-default-focus'),
  settingsDefaultRest: document.getElementById('settings-default-rest'),

  audioAlarm: document.getElementById('audio-alarm')
};

// ---------- Estado da aplicação ----------
const state = {
  mode: 'idle',          // idle | focus | paused | rest | completed
  pausedFromMode: null,  // 'focus' | 'rest' — para onde "Continuar" volta
  focusMinutes: DEFAULT_SETTINGS.focusMinutes,
  restMinutes: DEFAULT_SETTINGS.restMinutes,
  totalSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
  remainingSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
  intervalId: null
};

let settings = { ...DEFAULT_SETTINGS };

// ============================================================
// Local Storage
// ============================================================
function loadName() {
  return localStorage.getItem(STORAGE_KEYS.NAME);
}

function saveName(name) {
  localStorage.setItem(STORAGE_KEYS.NAME, name);
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadStats() {
  const raw = localStorage.getItem(STORAGE_KEYS.STATS);
  const empty = { date: todayKey(), sessions: 0, minutes: 0 };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    // novo dia: zera as estatísticas
    if (parsed.date !== todayKey()) return empty;
    return parsed;
  } catch (e) {
    return empty;
  }
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

function renderStats() {
  const stats = loadStats();
  el.statSessions.textContent = stats.sessions;
  el.statMinutes.textContent = `${stats.minutes} min`;
}

function registerCompletedSession(focusMinutes) {
  const stats = loadStats();
  stats.sessions += 1;
  stats.minutes += focusMinutes;
  saveStats(stats);
  renderStats();
}

// ============================================================
// Theme
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  el.settingsThemeGroup.querySelectorAll('button').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === theme));
  });
}

// ============================================================
// Audio — toca um arquivo em assets/audio/alarm.mp3 quando existir;
// caso contrário, gera um alarme simples com a Web Audio API.
// ============================================================
let audioCtx = null;

function playAudioFile() {
  return new Promise((resolve, reject) => {
    el.audioAlarm.volume = settings.volume / 100;
    el.audioAlarm.currentTime = 0;
    el.audioAlarm.play().then(resolve).catch(reject);
  });
}

function playGeneratedChime() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  const now = audioCtx.currentTime;
  const gainMax = Math.max(0, Math.min(1, settings.volume / 100)) * 0.3;

  // duas notas curtas, como um "toc-toc" de notificação
  [523.25, 783.99].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.22;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(gainMax, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

function playAlarm() {
  if (!settings.soundOn) return;
  playAudioFile().catch(() => playGeneratedChime());
}

// ============================================================
// Timer
// ============================================================
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  el.timerDisplay.textContent = formatTime(state.remainingSeconds);
}

function updateProgress() {
  const fraction = state.totalSeconds > 0 ? state.remainingSeconds / state.totalSeconds : 0;
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  el.ringProgress.style.strokeDashoffset = offset.toFixed(2);
}

function setPhaseBadge(text, className) {
  el.phaseBadge.textContent = text;
  el.phaseBadge.className = 'phase-badge' + (className ? ` ${className}` : '');
}

function showControls(name) {
  el.controlsIdle.hidden = name !== 'idle';
  el.controlsRunning.hidden = name !== 'running';
  el.controlsPaused.hidden = name !== 'paused';
  el.controlsCompleted.hidden = name !== 'completed';
}

function tick() {
  state.remainingSeconds -= 1;
  updateTimerDisplay();
  updateProgress();

  if (state.remainingSeconds <= 0) {
    clearInterval(state.intervalId);
    state.intervalId = null;
    if (state.mode === 'focus') {
      finishFocus();
    } else if (state.mode === 'rest') {
      finishRest();
    }
  }
}

function startInterval() {
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = setInterval(tick, 1000);
}

function startFocus(minutes) {
  state.mode = 'focus';
  state.totalSeconds = minutes * 60;
  state.remainingSeconds = state.totalSeconds;

  el.durationSection.hidden = true;
  el.ringProgress.classList.remove('rest');
  setPhaseBadge('Estudando');
  el.timerSub.textContent = 'Foco';
  showControls('running');

  updateTimerDisplay();
  updateProgress();
  startInterval();
}

function startRest(minutes) {
  state.mode = 'rest';
  state.totalSeconds = minutes * 60;
  state.remainingSeconds = state.totalSeconds;

  el.ringProgress.classList.add('rest');
  setPhaseBadge('Descansando', 'rest');
  el.timerSub.textContent = 'Descanso';
  showControls('running');

  updateTimerDisplay();
  updateProgress();
  startInterval();
}

function finishFocus() {
  playAlarm();
  el.timerSub.textContent = 'Hora do descanso';
  startRest(state.restMinutes);
}

function finishRest() {
  playAlarm();
  registerCompletedSession(state.focusMinutes);

  state.mode = 'completed';
  setPhaseBadge('Sessão concluída', 'completed');
  el.timerSub.textContent = 'Parabéns! Sessão concluída';
  el.ringProgress.classList.remove('rest');
  state.remainingSeconds = 0;
  updateTimerDisplay();
  updateProgress();
  showControls('completed');
}

function pauseTimer() {
  if (state.mode !== 'focus' && state.mode !== 'rest') return;
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.pausedFromMode = state.mode;
  state.mode = 'paused';
  setPhaseBadge('Pausado', 'paused');
  showControls('paused');
}

function resumeTimer() {
  if (state.mode !== 'paused' || !state.pausedFromMode) return;
  state.mode = state.pausedFromMode;
  if (state.mode === 'focus') {
    setPhaseBadge('Estudando');
    el.ringProgress.classList.remove('rest');
  } else {
    setPhaseBadge('Descansando', 'rest');
    el.ringProgress.classList.add('rest');
  }
  showControls('running');
  startInterval();
}

function resetTimer() {
  // "Reiniciar": volta o tempo da fase atual para o início, mantendo pausado
  if (state.mode !== 'paused') return;
  state.remainingSeconds = state.totalSeconds;
  updateTimerDisplay();
  updateProgress();
}

function stopTimer() {
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = null;
  state.mode = 'idle';
  state.pausedFromMode = null;
  el.ringProgress.classList.remove('rest');
  setPhaseBadge('Pronto para focar');
  el.timerSub.textContent = 'Foco';
  el.durationSection.hidden = false;
  showControls('idle');

  state.totalSeconds = state.focusMinutes * 60;
  state.remainingSeconds = state.totalSeconds;
  updateTimerDisplay();
  updateProgress();
}

function startNewSession() {
  state.mode = 'idle';
  el.durationSection.hidden = false;
  setPhaseBadge('Pronto para focar');
  el.timerSub.textContent = 'Foco';
  el.ringProgress.classList.remove('rest');
  state.totalSeconds = state.focusMinutes * 60;
  state.remainingSeconds = state.totalSeconds;
  updateTimerDisplay();
  updateProgress();
  showControls('idle');
}

// ============================================================
// Seletor de duração (chips)
// ============================================================
function readMinutesFromChips(chipGroup, customInput, fallback) {
  const selected = chipGroup.querySelector('[aria-pressed="true"]');
  if (!selected) return fallback;
  if (selected.dataset.minutes === 'custom') {
    const val = parseInt(customInput.value, 10);
    return Number.isFinite(val) && val > 0 ? val : fallback;
  }
  return parseInt(selected.dataset.minutes, 10);
}

function updateSessionMeta() {
  el.sessionMeta.textContent = `${state.focusMinutes} min foco • ${state.restMinutes} min descanso`;
  el.settingsDefaultFocus.textContent = `${state.focusMinutes} min`;
  el.settingsDefaultRest.textContent = `${state.restMinutes} min`;
}

function setupChipGroup(chipGroup, customWrap, customInput, onChange) {
  chipGroup.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (state.mode !== 'idle') return; // só pode trocar a duração em repouso
      chipGroup.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      customWrap.hidden = chip.dataset.minutes !== 'custom';
      if (chip.dataset.minutes === 'custom') {
        customInput.focus();
      }
      onChange();
    });
  });
  customInput.addEventListener('input', onChange);
}

function handleFocusDurationChange() {
  if (state.mode !== 'idle') return;
  state.focusMinutes = readMinutesFromChips(el.chipsFocus, el.inputCustomFocus, state.focusMinutes);
  state.totalSeconds = state.focusMinutes * 60;
  state.remainingSeconds = state.totalSeconds;
  updateTimerDisplay();
  updateProgress();
  updateSessionMeta();
}

function handleRestDurationChange() {
  if (state.mode !== 'idle') return;
  state.restMinutes = readMinutesFromChips(el.chipsRest, el.inputCustomRest, state.restMinutes);
  updateSessionMeta();
}

// ============================================================
// Settings (modal)
// ============================================================
function openSettings() {
  el.inputSettingsName.value = el.greetingName.textContent.replace(/^Olá,\s*/, '');
  el.inputSettingsSound.checked = settings.soundOn;
  el.inputSettingsVolume.value = settings.volume;
  el.modalSettings.hidden = false;
}

function closeSettings() {
  el.modalSettings.hidden = true;
}

function handleSettingsSubmit(event) {
  event.preventDefault();

  const newName = el.inputSettingsName.value.trim();
  if (newName) {
    saveName(newName);
    el.greetingName.textContent = `Olá, ${newName}`;
  }

  settings.soundOn = el.inputSettingsSound.checked;
  settings.volume = parseInt(el.inputSettingsVolume.value, 10);
  settings.theme = document.documentElement.getAttribute('data-theme');
  saveSettings();

  closeSettings();
}

// ============================================================
// Inicialização
// ============================================================
function initApp() {
  settings = loadSettings();
  applyTheme(settings.theme);

  state.focusMinutes = settings.focusMinutes;
  state.restMinutes = settings.restMinutes;
  state.totalSeconds = state.focusMinutes * 60;
  state.remainingSeconds = state.totalSeconds;

  const name = loadName();
  if (name) {
    el.onboardingScreen.hidden = true;
    el.homeScreen.hidden = false;
    el.greetingName.textContent = `Olá, ${name}`;
  } else {
    el.onboardingScreen.hidden = false;
    el.homeScreen.hidden = true;
  }

  updateTimerDisplay();
  updateProgress();
  updateSessionMeta();
  renderStats();
  showControls('idle');

  // Onboarding
  el.formOnboarding.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = el.inputName.value.trim();
    if (!name) return;
    saveName(name);
    el.greetingName.textContent = `Olá, ${name}`;
    el.onboardingScreen.hidden = true;
    el.homeScreen.hidden = false;
  });

  // Controles do timer
  el.btnStart.addEventListener('click', () => startFocus(state.focusMinutes));
  el.btnPause.addEventListener('click', pauseTimer);
  el.btnResume.addEventListener('click', resumeTimer);
  el.btnRestart.addEventListener('click', resetTimer);
  el.btnStopRunning.addEventListener('click', stopTimer);
  el.btnStopPaused.addEventListener('click', stopTimer);
  el.btnNewSession.addEventListener('click', startNewSession);

  // Duração
  setupChipGroup(el.chipsFocus, el.customFocusWrap, el.inputCustomFocus, handleFocusDurationChange);
  setupChipGroup(el.chipsRest, el.customRestWrap, el.inputCustomRest, handleRestDurationChange);

  // Configurações
  el.btnOpenSettings.addEventListener('click', openSettings);
  el.btnCloseSettings.addEventListener('click', closeSettings);
  el.modalSettings.addEventListener('click', (event) => {
    if (event.target === el.modalSettings) closeSettings();
  });
  el.formSettings.addEventListener('submit', handleSettingsSubmit);
  el.settingsThemeGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeChoice));
  });
}

document.addEventListener('DOMContentLoaded', initApp);
