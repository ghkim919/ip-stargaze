import { MESSAGE_TYPES } from '/shared/protocol.js';

let tabsListEl = null;
let sendFn = null;
let openAgentPanelFn = null;
let selectedSource = 'local';
let agents = [];

export function init(send, openAgentPanel) {
  sendFn = send;
  openAgentPanelFn = openAgentPanel;
  tabsListEl = document.getElementById('source-tabs-list');

  const addBtn = document.getElementById('source-tab-add');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (openAgentPanelFn) openAgentPanelFn();
    });
  }
}

export function getSelectedSource() {
  return selectedSource;
}

export function updateAgents(agentList) {
  if (!agentList) return;
  agents = agentList;
  render();
}

function getStatusDotClass(status) {
  switch (status) {
    case 'online':
      return 'source-tab-dot--online';
    case 'degraded':
      return 'source-tab-dot--degraded';
    case 'offline':
      return 'source-tab-dot--offline';
    default:
      return 'source-tab-dot--offline';
  }
}

function render() {
  if (!tabsListEl) return;

  let html = `<button class="source-tab${selectedSource === 'local' ? ' active' : ''}" data-source="local">
    <span class="source-tab-dot source-tab-dot--active"></span>
    <span class="source-tab-label">Local</span>
  </button>`;

  for (const agent of agents) {
    const isActive = selectedSource === agent.id;
    const dotClass = getStatusDotClass(agent.status);
    const label = agent.label || agent.id;

    html += `<button class="source-tab${isActive ? ' active' : ''}" data-source="${agent.id}">
      <span class="source-tab-dot ${dotClass}"></span>
      <span class="source-tab-label">${label}</span>
    </button>`;
  }

  tabsListEl.innerHTML = html;

  tabsListEl.querySelectorAll('.source-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const source = tab.dataset.source;
      if (source === selectedSource) return;
      selectSource(source);
    });
  });
}

function selectSource(source) {
  selectedSource = source;
  render();
  if (sendFn) {
    sendFn({ type: MESSAGE_TYPES.SET_SOURCE, value: source });
  }
}
