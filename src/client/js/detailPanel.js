import { formatNumber, formatPps, getSubnetColor } from './utils.js';

let panelEl = null;
let selectedNetwork = null;
let isOpen = false;

export function init() {
  panelEl = document.getElementById('detail-panel');
  const closeBtn = document.getElementById('detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }
}

export function open(subnetData) {
  if (!panelEl) return;
  selectedNetwork = subnetData.network;
  renderContent(subnetData);
  panelEl.classList.add('open');
  isOpen = true;
}

export function close() {
  if (!panelEl) return;
  panelEl.classList.remove('open');
  isOpen = false;
  selectedNetwork = null;
}

export function getSelectedNetwork() {
  return selectedNetwork;
}

export function isVisible() {
  return isOpen;
}

export function update(data) {
  if (!isOpen || !selectedNetwork || !data.subnets) return;

  const subnet = data.subnets.find(s => s.network === selectedNetwork);
  if (subnet) {
    renderContent(subnet);
  }
}

function renderContent(d) {
  const color = getSubnetColor(d.network);

  const networkEl = document.getElementById('detail-network');
  const labelEl = document.getElementById('detail-label');
  const statsEl = document.getElementById('detail-stats');
  const colorBar = document.getElementById('detail-color-bar');

  if (colorBar) {
    colorBar.style.backgroundColor = color;
  }

  if (networkEl) {
    networkEl.textContent = d.network;
  }

  if (labelEl) {
    labelEl.textContent = d.label || (d.isPrivate ? 'Private Network' : 'Public Network');
  }

  if (statsEl) {
    statsEl.innerHTML = `
      <div class="detail-stat-row">
        <span class="detail-stat-label">Packets</span>
        <span class="detail-stat-value">${formatNumber(d.count)}</span>
      </div>
      <div class="detail-stat-row">
        <span class="detail-stat-label">Unique IPs</span>
        <span class="detail-stat-value">${formatNumber(d.uniqueIps)}</span>
      </div>
      <div class="detail-stat-row">
        <span class="detail-stat-label">PPS</span>
        <span class="detail-stat-value">${formatPps(d.pps)}/s</span>
      </div>
      <div class="detail-stat-row">
        <span class="detail-stat-label">Bytes</span>
        <span class="detail-stat-value">${formatNumber(d.bytes)}</span>
      </div>
    `;
  }
}
