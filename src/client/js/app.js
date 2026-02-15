import * as starGraph from './starGraph.js';
import * as dashboard from './dashboard.js';
import * as detailPanel from './detailPanel.js';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 3000;

let ws = null;
let reconnectAttempts = 0;
let reconnectTimer = null;

function getWsUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  dashboard.setConnectionStatus('reconnecting');

  try {
    ws = new WebSocket(getWsUrl());
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempts = 0;
    dashboard.setConnectionStatus('connected');
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    try {
      handleMessage(msg);
    } catch (err) {
      console.error('[app] handleMessage error:', err);
    }
  };

  ws.onclose = () => {
    dashboard.setConnectionStatus('disconnected');
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after onerror
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    dashboard.setConnectionStatus('disconnected');
    return;
  }

  reconnectAttempts++;
  const delay = BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1);
  dashboard.setConnectionStatus('reconnecting');

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'snapshot':
      try { starGraph.update(msg.data); } catch (e) { console.error('[starGraph]', e); }
      try { dashboard.update(msg.data); } catch (e) { console.error('[dashboard]', e); }
      try { detailPanel.update(msg.data); } catch (e) { console.error('[detailPanel]', e); }
      break;

    case 'config':
      applyConfig(msg.data);
      break;
  }
}

function applyConfig(config) {
  if (!config) return;

  const modeEl = document.getElementById('mode-badge');
  if (modeEl) {
    const isLive = config.mode === 'live' || config.mode === 'capture';
    modeEl.textContent = isLive ? 'LIVE' : 'SIMULATION';
    modeEl.className = 'mode-badge ' + (isLive ? 'mode-live' : 'mode-sim');

    const scenarioSelect = document.getElementById('scenario-select');
    if (scenarioSelect) {
      scenarioSelect.disabled = isLive;
    }
  }

  if (config.window) {
    const windowSelect = document.getElementById('window-select');
    if (windowSelect) windowSelect.value = config.window;
  }

  if (config.subnetLevel) {
    setActiveSubnetButton(config.subnetLevel);
  }

  if (config.scenario) {
    const scenarioSelect = document.getElementById('scenario-select');
    if (scenarioSelect) scenarioSelect.value = config.scenario;
  }

  if (config.iface) {
    starGraph.setIface(config.iface);
  }
}

function setActiveSubnetButton(level) {
  document.querySelectorAll('.subnet-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === level);
  });
}

function initControls() {
  const windowSelect = document.getElementById('window-select');
  if (windowSelect) {
    windowSelect.addEventListener('change', () => {
      send({ type: 'setWindow', value: windowSelect.value });
    });
  }

  document.querySelectorAll('.subnet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.level;
      setActiveSubnetButton(level);
      send({ type: 'setSubnetLevel', value: level });
    });
  });

  const scenarioSelect = document.getElementById('scenario-select');
  if (scenarioSelect) {
    scenarioSelect.addEventListener('change', () => {
      send({ type: 'setScenario', value: scenarioSelect.value });
    });
  }
}

function initApp() {
  starGraph.init('#star-container', (subnetData) => {
    detailPanel.open(subnetData);
  });

  detailPanel.init();
  initControls();
  dashboard.setConnectionStatus('disconnected');
  connect();

  document.addEventListener('click', (e) => {
    if (detailPanel.isVisible()) {
      const panel = document.getElementById('detail-panel');
      if (panel && !panel.contains(e.target) && !e.target.closest('.ray-group')) {
        detailPanel.close();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
