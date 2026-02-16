import { MESSAGE_TYPES } from '/shared/protocol.js';

let panelEl = null;
let listEl = null;
let formEl = null;
let sendFn = null;
let isOpen = false;
let agents = [];
let testResultMessage = null;
let testInProgress = false;

export function init(send) {
  sendFn = send;
  panelEl = document.getElementById('agent-panel');
  listEl = document.getElementById('agent-list');
  formEl = document.getElementById('agent-add-form');

  const closeBtn = document.getElementById('agent-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }

  const toggleBtn = document.getElementById('agents-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggle);
  }

  const testBtn = document.getElementById('agent-test-btn');
  if (testBtn) {
    testBtn.addEventListener('click', handleTest);
  }

  const addBtn = document.getElementById('agent-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', handleAdd);
  }

  const addToggle = document.getElementById('agent-add-toggle');
  if (addToggle) {
    addToggle.addEventListener('click', () => {
      if (formEl) formEl.classList.toggle('open');
    });
  }
}

export function toggle() {
  if (isOpen) {
    close();
  } else {
    open();
  }
}

export function open() {
  if (!panelEl) return;
  panelEl.classList.add('open');
  isOpen = true;
  sendFn({ type: MESSAGE_TYPES.GET_AGENTS });
  render();
}

export function close() {
  if (!panelEl) return;
  panelEl.classList.remove('open');
  isOpen = false;
}

export function isVisible() {
  return isOpen;
}

export function updateAgents(agentList) {
  if (!agentList) return;
  agents = agentList;
  if (isOpen) render();
}

export function handleTestResult(data) {
  testInProgress = false;
  if (data.success) {
    testResultMessage = { type: 'success', text: `Connected: ${data.agentId || data.info?.agentId || 'OK'}` };
  } else {
    testResultMessage = { type: 'error', text: data.error || 'Connection failed' };
  }
  renderTestResult();
  updateFormButtons();
}

function send(msg) {
  if (sendFn) sendFn(msg);
}

function handleTest() {
  const url = document.getElementById('agent-url-input')?.value?.trim();
  const apiKey = document.getElementById('agent-key-input')?.value?.trim();

  if (!url) return;

  testInProgress = true;
  testResultMessage = null;
  renderTestResult();
  updateFormButtons();

  send({
    type: MESSAGE_TYPES.TEST_AGENT,
    value: { url, apiKey },
  });
}

function handleAdd() {
  const urlInput = document.getElementById('agent-url-input');
  const keyInput = document.getElementById('agent-key-input');
  const labelInput = document.getElementById('agent-label-input');

  const url = urlInput?.value?.trim();
  const apiKey = keyInput?.value?.trim();
  const label = labelInput?.value?.trim();

  if (!url) return;

  send({
    type: MESSAGE_TYPES.ADD_AGENT,
    value: { url, apiKey, label },
  });

  if (urlInput) urlInput.value = '';
  if (keyInput) keyInput.value = '';
  if (labelInput) labelInput.value = '';
  testResultMessage = null;
  renderTestResult();
  if (formEl) formEl.classList.remove('open');
}

function handleRemove(agentId) {
  send({
    type: MESSAGE_TYPES.REMOVE_AGENT,
    value: { id: agentId },
  });
}

function handleToggleEnabled(agentId, currentEnabled) {
  send({
    type: MESSAGE_TYPES.SET_AGENT_ENABLED,
    value: { id: agentId, enabled: !currentEnabled },
  });
}

function getStatusClass(status) {
  switch (status) {
    case 'online':
    case 'active':
      return 'agent-status--online';
    case 'degraded':
      return 'agent-status--degraded';
    case 'offline':
      return 'agent-status--offline';
    default:
      return 'agent-status--offline';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'online':
    case 'active':
      return 'online';
    case 'degraded':
      return 'degraded';
    case 'offline':
      return 'offline';
    default:
      return status || 'unknown';
  }
}

function renderLocalItem() {
  return `<div class="agent-item agent-item--local">
    <div class="agent-item-header">
      <span class="agent-status-dot ${getStatusClass('active')}"></span>
      <span class="agent-item-name">Local</span>
      <span class="agent-item-badge">this server</span>
    </div>
    <div class="agent-item-status">Status: ${getStatusLabel('active')}</div>
  </div>`;
}

function renderRemoteItem(agent) {
  const status = agent.status || 'offline';
  const label = agent.label || '';
  const enabled = agent.enabled !== false;
  const disabledClass = enabled ? '' : ' agent-item--disabled';

  return `<div class="agent-item${disabledClass}" data-agent-id="${agent.id}">
    <div class="agent-item-header">
      <span class="agent-status-dot ${getStatusClass(status)}"></span>
      <span class="agent-item-name">${agent.id}</span>
      <div class="agent-item-actions">
        <button class="agent-toggle-btn" data-action="toggle" data-id="${agent.id}" data-enabled="${enabled}" title="${enabled ? 'Disable' : 'Enable'}">
          ${enabled ? 'ON' : 'OFF'}
        </button>
        <button class="agent-remove-btn" data-action="remove" data-id="${agent.id}" title="Remove">&times;</button>
      </div>
    </div>
    ${label ? `<div class="agent-item-label">${label}</div>` : ''}
    <div class="agent-item-url">${agent.url || ''}</div>
    <div class="agent-item-status">Status: ${getStatusLabel(status)}</div>
  </div>`;
}

function render() {
  if (!listEl) return;

  let html = renderLocalItem();

  for (const agent of agents) {
    html += renderRemoteItem(agent);
  }

  listEl.innerHTML = html;

  listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleToggleEnabled(btn.dataset.id, btn.dataset.enabled === 'true');
    });
  });

  listEl.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleRemove(btn.dataset.id);
    });
  });
}

function renderTestResult() {
  const el = document.getElementById('agent-test-result');
  if (!el) return;

  if (testInProgress) {
    el.className = 'agent-test-result agent-test-result--pending';
    el.textContent = 'Testing...';
    return;
  }

  if (!testResultMessage) {
    el.className = 'agent-test-result';
    el.textContent = '';
    return;
  }

  el.className = `agent-test-result agent-test-result--${testResultMessage.type}`;
  el.textContent = testResultMessage.text;
}

function updateFormButtons() {
  const testBtn = document.getElementById('agent-test-btn');
  if (testBtn) {
    testBtn.disabled = testInProgress;
    testBtn.textContent = testInProgress ? 'Testing...' : 'Test';
  }
}
