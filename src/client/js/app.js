import * as starGraph from './starGraph.js';
import * as dashboard from './dashboard.js';
import * as detailPanel from './detailPanel.js';
import { WEBSOCKET_CONFIG } from './config.js';
import { MESSAGE_TYPES } from '/shared/protocol.js';
import { isLiveMode } from './helpers/modeHelpers.js';

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
  if (reconnectAttempts >= WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS) {
    dashboard.setConnectionStatus('disconnected');
    return;
  }

  reconnectAttempts++;
  const delay = WEBSOCKET_CONFIG.BASE_RECONNECT_DELAY * Math.pow(WEBSOCKET_CONFIG.RECONNECT_BACKOFF, reconnectAttempts - 1);
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
    case MESSAGE_TYPES.SNAPSHOT:
      try { starGraph.update(msg.data); } catch (e) { console.error('[starGraph]', e); }
      try { dashboard.update(msg.data); } catch (e) { console.error('[dashboard]', e); }
      try { detailPanel.update(msg.data); } catch (e) { console.error('[detailPanel]', e); }
      if (detailPanel.isVisible() && detailPanel.getSelectedNetwork()) {
        send({ type: MESSAGE_TYPES.GET_SUBNET_DETAIL, value: detailPanel.getSelectedNetwork() });
      }
      break;

    case MESSAGE_TYPES.SUBNET_DETAIL:
      try { detailPanel.updateDetail(msg.data); } catch (e) { console.error('[detailPanel]', e); }
      break;

    case MESSAGE_TYPES.CONFIG:
      applyConfig(msg.data);
      break;
  }
}

function applyConfig(config) {
  if (!config) return;

  const modeEl = document.getElementById('mode-badge');
  if (modeEl) {
    const live = isLiveMode(config);
    modeEl.textContent = live ? 'LIVE' : 'SIMULATION';
    modeEl.className = 'mode-badge ' + (live ? 'mode-live' : 'mode-sim');

    const scenarioSelect = document.getElementById('scenario-select');
    if (scenarioSelect) {
      scenarioSelect.disabled = live;
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

  if (config.eventsPerSecond) {
    const epsSlider = document.getElementById('eps-slider');
    const epsValue = document.getElementById('eps-value');
    if (epsSlider) {
      epsSlider.value = config.eventsPerSecond;
      epsValue.textContent = config.eventsPerSecond;
    }
  }

  const epsControl = document.getElementById('eps-control');
  if (epsControl) {
    const live = isLiveMode(config);
    const epsSlider = document.getElementById('eps-slider');
    if (epsSlider) epsSlider.disabled = live;
    epsControl.style.opacity = live ? '0.4' : '1';
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
      send({ type: MESSAGE_TYPES.SET_WINDOW, value: windowSelect.value });
    });
  }

  document.querySelectorAll('.subnet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.level;
      setActiveSubnetButton(level);
      send({ type: MESSAGE_TYPES.SET_SUBNET_LEVEL, value: level });
    });
  });

  const scenarioSelect = document.getElementById('scenario-select');
  if (scenarioSelect) {
    scenarioSelect.addEventListener('change', () => {
      send({ type: MESSAGE_TYPES.SET_SCENARIO, value: scenarioSelect.value });
    });
  }

  const epsSlider = document.getElementById('eps-slider');
  const epsValue = document.getElementById('eps-value');
  if (epsSlider) {
    epsSlider.addEventListener('input', () => {
      epsValue.textContent = epsSlider.value;
    });
    epsSlider.addEventListener('change', () => {
      send({ type: MESSAGE_TYPES.SET_EVENTS_PER_SECOND, value: epsSlider.value });
    });
  }

  const ppsThresholdSlider = document.getElementById('pps-threshold-slider');
  const ppsThresholdValue = document.getElementById('pps-threshold-value');
  if (ppsThresholdSlider) {
    ppsThresholdSlider.addEventListener('input', () => {
      ppsThresholdValue.textContent = ppsThresholdSlider.value;
    });
    ppsThresholdSlider.addEventListener('change', () => {
      starGraph.setPpsThreshold(parseInt(ppsThresholdSlider.value, 10));
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
