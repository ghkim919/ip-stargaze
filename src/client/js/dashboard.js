import { formatNumber, formatPps, subnetAbbrev } from './utils.js';
import { VISUAL_CONFIG } from './config.js';

const state = {
  totalPackets: 0,
  uniqueIps: 0,
  pps: 0,
  activeSubnets: 0,
  topSubnets: [],
};

const animationFrames = new Map();

function animateValue(elementId, startVal, endVal, formatter) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (animationFrames.has(elementId)) {
    cancelAnimationFrame(animationFrames.get(elementId));
  }

  if (startVal === endVal) {
    el.textContent = formatter(endVal);
    return;
  }

  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / VISUAL_CONFIG.COUNTER_DURATION, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = startVal + (endVal - startVal) * eased;
    el.textContent = formatter(Math.round(current));

    if (progress < 1) {
      animationFrames.set(elementId, requestAnimationFrame(step));
    } else {
      animationFrames.delete(elementId);
    }
  }

  animationFrames.set(elementId, requestAnimationFrame(step));
}

function renderTopSubnets(topSubnets) {
  const container = document.getElementById('top-subnets');
  if (!container) return;

  if (!topSubnets || topSubnets.length === 0) {
    container.textContent = '-';
    return;
  }

  container.innerHTML = topSubnets.slice(0, 3).map(s =>
    `<span class="top-subnet-item">${subnetAbbrev(s.network)} <span class="top-subnet-pct">${s.percentage.toFixed(1)}%</span></span>`
  ).join('');
}

export function update(data) {
  if (!data || !data.summary) return;

  const { totalPackets, totalUniqueIps, totalPps, topSubnets } = data.summary;
  const activeSubnets = data.subnets ? data.subnets.length : 0;

  animateValue('stat-packets', state.totalPackets, totalPackets, formatNumber);
  animateValue('stat-ips', state.uniqueIps, totalUniqueIps, formatNumber);
  animateValue('stat-pps', state.pps, Math.round(totalPps), v => formatPps(v));
  animateValue('stat-subnets', state.activeSubnets, activeSubnets, v => v.toString());

  state.totalPackets = totalPackets;
  state.uniqueIps = totalUniqueIps;
  state.pps = Math.round(totalPps);
  state.activeSubnets = activeSubnets;
  state.topSubnets = topSubnets || [];

  renderTopSubnets(state.topSubnets);
}

export function setConnectionStatus(status) {
  const dot = document.getElementById('conn-dot');
  const text = document.getElementById('conn-text');
  if (!dot || !text) return;

  dot.className = 'conn-dot';
  switch (status) {
    case 'connected':
      dot.classList.add('conn-connected');
      text.textContent = 'Connected';
      break;
    case 'reconnecting':
      dot.classList.add('conn-reconnecting');
      text.textContent = 'Reconnecting...';
      break;
    case 'disconnected':
      dot.classList.add('conn-disconnected');
      text.textContent = 'Disconnected';
      break;
  }
}
