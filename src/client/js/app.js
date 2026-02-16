import * as starGraph from './starGraph.js';
import * as dashboard from './dashboard.js';
import * as detailPanel from './detailPanel.js';
import { WEBSOCKET_CONFIG } from './config.js';
import { MESSAGE_TYPES } from '/shared/protocol.js';
import { isLiveMode } from './helpers/modeHelpers.js';

const PORT_LABELS = {
  21: 'FTP', 22: 'SSH', 25: 'SMTP', 53: 'DNS',
  80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS',
  993: 'IMAPS', 995: 'POP3S', 3306: 'MySQL', 3389: 'RDP',
  5432: 'PgSQL', 6379: 'Redis', 8080: 'Alt-HTTP', 27017: 'MongoDB',
};

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
    send({ type: MESSAGE_TYPES.GET_INTERFACES });
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

    case MESSAGE_TYPES.INTERFACES:
      populateNicSelect(msg.data);
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
    const epsInput = document.getElementById('eps-input');
    if (epsInput) {
      epsInput.value = config.eventsPerSecond;
    }
  }

  const simSection = document.getElementById('sim-section');
  if (simSection) {
    const live = isLiveMode(config);
    simSection.style.opacity = live ? '0.4' : '1';
    const scenarioSelect = document.getElementById('scenario-select');
    const epsInput = document.getElementById('eps-input');
    if (scenarioSelect) scenarioSelect.disabled = live;
    if (epsInput) epsInput.disabled = live;
  }

  if (config.filter) {
    syncPortCheckboxes(config.filter.ports || []);
    syncProtocolButtons(config.filter.protocols || []);
  }

  const nicSelect = document.getElementById('nic-select');
  if (nicSelect) {
    const live = isLiveMode(config);
    nicSelect.disabled = !live;
    const nicControl = document.getElementById('nic-control');
    if (nicControl) nicControl.style.opacity = live ? '1' : '0.4';
    if (config.iface && nicSelect.querySelector(`option[value="${config.iface}"]`)) {
      nicSelect.value = config.iface;
    }
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

  const epsInput = document.getElementById('eps-input');
  if (epsInput) {
    epsInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(500, parseInt(epsInput.value, 10) || 1));
      epsInput.value = val;
      send({ type: MESSAGE_TYPES.SET_EVENTS_PER_SECOND, value: String(val) });
    });
  }

  const ppsInput = document.getElementById('pps-threshold-input');
  if (ppsInput) {
    ppsInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(100, parseInt(ppsInput.value, 10) || 1));
      ppsInput.value = val;
      starGraph.setPpsThreshold(val);
    });
  }

  initPortFilter();
  initProtocolButtons();
  initNicSelect();
  initResetButton();
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

function initPortFilter() {
  const btn = document.getElementById('port-filter-btn');
  const dropdown = document.getElementById('port-filter-dropdown');
  const presetsContainer = document.getElementById('port-filter-presets');
  const customInput = document.getElementById('port-custom-input');
  const customAddBtn = document.getElementById('port-custom-add');

  if (!btn || !dropdown || !presetsContainer) return;

  for (const [port, label] of Object.entries(PORT_LABELS)) {
    const el = document.createElement('label');
    el.innerHTML = `<input type="checkbox" data-port="${port}"> ${port} ${label}`;
    presetsContainer.appendChild(el);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  presetsContainer.addEventListener('change', () => {
    sendFilter();
  });

  if (customAddBtn && customInput) {
    const addCustomPort = () => {
      const val = parseInt(customInput.value, 10);
      if (!val || val < 1 || val > 65535) return;
      const existing = presetsContainer.querySelector(`input[data-port="${val}"]`);
      if (existing) {
        existing.checked = true;
      } else {
        const el = document.createElement('label');
        el.innerHTML = `<input type="checkbox" data-port="${val}" checked> ${val}`;
        presetsContainer.appendChild(el);
        el.querySelector('input').addEventListener('change', () => sendFilter());
      }
      customInput.value = '';
      sendFilter();
    };
    customAddBtn.addEventListener('click', addCustomPort);
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addCustomPort();
    });
  }

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('open');
    }
  });
}

function initProtocolButtons() {
  document.querySelectorAll('.proto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      sendFilter();
    });
  });
}

function initNicSelect() {
  const nicSelect = document.getElementById('nic-select');
  if (!nicSelect) return;
  nicSelect.addEventListener('change', () => {
    if (nicSelect.value) {
      send({ type: MESSAGE_TYPES.SET_INTERFACE, value: nicSelect.value });
    }
  });
}

function initResetButton() {
  const resetBtn = document.getElementById('reset-filter-btn');
  if (!resetBtn) return;
  resetBtn.addEventListener('click', () => {
    document.querySelectorAll('#port-filter-presets input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    document.querySelectorAll('.proto-btn').forEach(btn => {
      btn.classList.add('active');
    });
    updatePortButtonLabel();
    sendFilter();
  });
}

function sendFilter() {
  const checkedPorts = [];
  document.querySelectorAll('#port-filter-presets input[type="checkbox"]:checked').forEach(cb => {
    checkedPorts.push(parseInt(cb.dataset.port, 10));
  });

  const activeProtos = [];
  const allProtoButtons = document.querySelectorAll('.proto-btn');
  const activeCount = document.querySelectorAll('.proto-btn.active').length;
  if (activeCount < allProtoButtons.length) {
    document.querySelectorAll('.proto-btn.active').forEach(btn => {
      activeProtos.push(btn.dataset.proto);
    });
  }

  updatePortButtonLabel();

  send({
    type: MESSAGE_TYPES.SET_FILTER,
    value: { ports: checkedPorts, protocols: activeProtos },
  });
}

function updatePortButtonLabel() {
  const btn = document.getElementById('port-filter-btn');
  if (!btn) return;
  const checked = document.querySelectorAll('#port-filter-presets input[type="checkbox"]:checked');
  if (checked.length === 0) {
    btn.textContent = 'All';
  } else {
    btn.textContent = `${checked.length} port${checked.length > 1 ? 's' : ''}`;
  }
}

function syncPortCheckboxes(ports) {
  document.querySelectorAll('#port-filter-presets input[type="checkbox"]').forEach(cb => {
    cb.checked = ports.includes(parseInt(cb.dataset.port, 10));
  });
  updatePortButtonLabel();
}

function syncProtocolButtons(protocols) {
  if (protocols.length === 0) {
    document.querySelectorAll('.proto-btn').forEach(btn => btn.classList.add('active'));
  } else {
    document.querySelectorAll('.proto-btn').forEach(btn => {
      btn.classList.toggle('active', protocols.includes(btn.dataset.proto));
    });
  }
}

function populateNicSelect(interfaces) {
  const nicSelect = document.getElementById('nic-select');
  if (!nicSelect) return;
  nicSelect.innerHTML = '<option value="">-</option>';
  for (const iface of interfaces) {
    const opt = document.createElement('option');
    opt.value = iface.name;
    opt.textContent = iface.address ? `${iface.name} (${iface.address})` : iface.name;
    nicSelect.appendChild(opt);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
