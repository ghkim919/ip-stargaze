import { VISUAL_CONFIG } from './config.js';

const STORAGE_KEY = 'ip-stargaze-visual-settings';

const DEFAULTS = {
  MIN_RADIUS: 12,
  MAX_RADIUS: 50,
  HIGHLIGHT_SCALE: 1.3,
  LINK_WIDTH_MIN: 2,
  LINK_WIDTH_MAX: 4,
  LINK_OPACITY: 0.5,
  LABEL_FONT_SIZE: 11,
  GLOW_ENABLED: true,
  GLOW_OPACITY_HIGH: 0.6,
  RIPPLE_ENABLED: true,
  CLUSTER_HULL_VISIBLE: true,
  CLUSTER_HULL_PADDING: 18,
  FORCE_CHARGE_STRENGTH: -180,
  LINK_DISTANCE_NORMAL: 160,
  LINK_DISTANCE_CLUSTER: 250,
};

const SETTING_GROUPS = [
  {
    label: 'Node',
    items: [
      { key: 'MIN_RADIUS', label: 'Min Radius', type: 'range', min: 4, max: 30, step: 1, unit: 'px' },
      { key: 'MAX_RADIUS', label: 'Max Radius', type: 'range', min: 20, max: 80, step: 2, unit: 'px' },
      { key: 'HIGHLIGHT_SCALE', label: 'Highlight Scale', type: 'range', min: 1.0, max: 2.0, step: 0.1, unit: 'x' },
    ],
  },
  {
    label: 'Link',
    items: [
      { key: 'LINK_WIDTH_MIN', label: 'Min Width', type: 'range', min: 0.5, max: 6, step: 0.5, unit: 'px' },
      { key: 'LINK_WIDTH_MAX', label: 'Max Width', type: 'range', min: 2, max: 12, step: 0.5, unit: 'px' },
      { key: 'LINK_OPACITY', label: 'Opacity', type: 'range', min: 0.1, max: 1.0, step: 0.05, unit: '' },
    ],
  },
  {
    label: 'Label',
    items: [
      { key: 'LABEL_FONT_SIZE', label: 'Font Size', type: 'range', min: 8, max: 18, step: 1, unit: 'px' },
    ],
  },
  {
    label: 'Glow',
    items: [
      { key: 'GLOW_ENABLED', label: 'Enabled', type: 'toggle' },
      { key: 'GLOW_OPACITY_HIGH', label: 'High Opacity', type: 'range', min: 0.1, max: 1.0, step: 0.05, unit: '' },
    ],
  },
  {
    label: 'Ripple',
    items: [
      { key: 'RIPPLE_ENABLED', label: 'Enabled', type: 'toggle' },
    ],
  },
  {
    label: 'Cluster',
    items: [
      { key: 'CLUSTER_HULL_VISIBLE', label: 'Hull Visible', type: 'toggle' },
      { key: 'CLUSTER_HULL_PADDING', label: 'Hull Padding', type: 'range', min: 5, max: 50, step: 1, unit: 'px' },
    ],
  },
  {
    label: 'Force',
    items: [
      { key: 'FORCE_CHARGE_STRENGTH', label: 'Charge', type: 'range', min: -400, max: -20, step: 10, unit: '' },
      { key: 'LINK_DISTANCE_NORMAL', label: 'Link Dist', type: 'range', min: 80, max: 350, step: 10, unit: 'px' },
      { key: 'LINK_DISTANCE_CLUSTER', label: 'Cluster Dist', type: 'range', min: 120, max: 450, step: 10, unit: 'px' },
    ],
  },
];

const FORCE_KEYS = new Set(['FORCE_CHARGE_STRENGTH', 'LINK_DISTANCE_NORMAL', 'LINK_DISTANCE_CLUSTER']);

const MIN_MAX_PAIRS = [
  { minKey: 'MIN_RADIUS', maxKey: 'MAX_RADIUS' },
  { minKey: 'LINK_WIDTH_MIN', maxKey: 'LINK_WIDTH_MAX' },
];

let panelEl = null;
let bodyEl = null;
let restartSimulationFn = null;
let saveTimer = null;

export function init(restartSimulation) {
  restartSimulationFn = restartSimulation;
  panelEl = document.getElementById('settings-panel');
  bodyEl = document.getElementById('settings-panel-body');

  const closeBtn = document.getElementById('settings-panel-close');
  if (closeBtn) closeBtn.addEventListener('click', close);

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', toggle);

  const resetBtn = document.getElementById('settings-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetAll);

  loadFromStorage();
  render();
}

export function open() {
  if (panelEl) panelEl.classList.add('open');
}

export function close() {
  if (panelEl) panelEl.classList.remove('open');
}

export function isVisible() {
  return panelEl ? panelEl.classList.contains('open') : false;
}

export function toggle() {
  if (isVisible()) close();
  else open();
}

function render() {
  if (!bodyEl) return;
  bodyEl.innerHTML = '';

  for (const group of SETTING_GROUPS) {
    const section = document.createElement('div');
    section.className = 'settings-group';

    const title = document.createElement('div');
    title.className = 'settings-group-title';
    title.textContent = group.label;
    section.appendChild(title);

    for (const item of group.items) {
      const row = document.createElement('div');
      row.className = 'settings-item';

      const label = document.createElement('label');
      label.className = 'settings-item-label';
      label.textContent = item.label;
      row.appendChild(label);

      if (item.type === 'toggle') {
        const toggle = createToggle(item.key);
        row.appendChild(toggle);
      } else {
        const { wrapper } = createRange(item, group.label === 'Force');
        row.appendChild(wrapper);
      }

      section.appendChild(row);
    }

    bodyEl.appendChild(section);
  }
}

function createToggle(key) {
  const wrapper = document.createElement('label');
  wrapper.className = 'settings-toggle';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = VISUAL_CONFIG[key];
  input.dataset.key = key;

  input.addEventListener('change', () => {
    applyValue(key, input.checked);
    saveToStorage();
  });

  const slider = document.createElement('span');
  slider.className = 'settings-toggle-slider';

  wrapper.appendChild(input);
  wrapper.appendChild(slider);
  return wrapper;
}

function createRange(item, isForce) {
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-range-wrapper';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'settings-range';
  input.min = item.min;
  input.max = item.max;
  input.step = item.step;
  input.value = VISUAL_CONFIG[item.key];
  input.dataset.key = item.key;

  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'settings-range-value';
  valueDisplay.textContent = formatValue(VISUAL_CONFIG[item.key], item);

  input.addEventListener('input', () => {
    const val = parseFloat(input.value);
    const clamped = clampMinMax(item.key, val);
    if (clamped !== val) input.value = clamped;
    applyValue(item.key, clamped);
    valueDisplay.textContent = formatValue(clamped, item);
    syncPairedSlider(item.key, clamped);
    if (!isForce) saveToStorage();
  });

  if (isForce) {
    input.addEventListener('change', () => {
      if (restartSimulationFn) restartSimulationFn();
      saveToStorage();
    });
  }

  wrapper.appendChild(input);
  wrapper.appendChild(valueDisplay);
  return { wrapper };
}

function formatValue(val, item) {
  if (Number.isInteger(item.step) || item.step >= 1) {
    return Math.round(val) + (item.unit ? item.unit : '');
  }
  const decimals = String(item.step).split('.')[1]?.length || 1;
  return parseFloat(val).toFixed(decimals) + (item.unit ? item.unit : '');
}

function clampMinMax(key, value) {
  for (const pair of MIN_MAX_PAIRS) {
    if (key === pair.minKey) {
      const maxVal = VISUAL_CONFIG[pair.maxKey];
      if (value > maxVal) return maxVal;
    }
    if (key === pair.maxKey) {
      const minVal = VISUAL_CONFIG[pair.minKey];
      if (value < minVal) return minVal;
    }
  }
  return value;
}

function syncPairedSlider(key, value) {
  if (!bodyEl) return;
  for (const pair of MIN_MAX_PAIRS) {
    let pairedKey = null;
    if (key === pair.minKey) pairedKey = pair.maxKey;
    else if (key === pair.maxKey) pairedKey = pair.minKey;
    if (!pairedKey) continue;

    const pairedInput = bodyEl.querySelector(`input[data-key="${pairedKey}"]`);
    if (!pairedInput) continue;

    const pairedVal = parseFloat(pairedInput.value);
    if (key === pair.minKey && value > pairedVal) {
      pairedInput.value = value;
      applyValue(pairedKey, value);
      const display = pairedInput.parentElement.querySelector('.settings-range-value');
      if (display) {
        const item = findItemDef(pairedKey);
        if (item) display.textContent = formatValue(value, item);
      }
    } else if (key === pair.maxKey && value < pairedVal) {
      pairedInput.value = value;
      applyValue(pairedKey, value);
      const display = pairedInput.parentElement.querySelector('.settings-range-value');
      if (display) {
        const item = findItemDef(pairedKey);
        if (item) display.textContent = formatValue(value, item);
      }
    }
  }
}

function findItemDef(key) {
  for (const group of SETTING_GROUPS) {
    for (const item of group.items) {
      if (item.key === key) return item;
    }
  }
  return null;
}

function applyValue(key, value) {
  VISUAL_CONFIG[key] = value;
}

function saveToStorage() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const delta = {};
    for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
      if (VISUAL_CONFIG[key] !== defaultVal) {
        delta[key] = VISUAL_CONFIG[key];
      }
    }
    if (Object.keys(delta).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(delta));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, 300);
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const delta = JSON.parse(raw);
    for (const [key, value] of Object.entries(delta)) {
      if (key in DEFAULTS) {
        VISUAL_CONFIG[key] = value;
      }
    }
  } catch {
    // ignore corrupted storage
  }
}

function resetAll() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    VISUAL_CONFIG[key] = value;
  }
  localStorage.removeItem(STORAGE_KEY);
  render();
  if (restartSimulationFn) restartSimulationFn();
}
