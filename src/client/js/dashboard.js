import { formatNumber, formatPps, formatBytes, subnetAbbrev } from './utils.js';
import { VISUAL_CONFIG } from './config.js';

const WINDOW_LABELS = {
  '1m': 'Last 1 min',
  '5m': 'Last 5 min',
  '15m': 'Last 15 min',
  '1h': 'Last 1 hour',
};

const state = {
  totalPackets: 0,
  uniqueIps: 0,
  pps: 0,
  totalBytes: 0,
  activeSubnets: 0,
  topSubnets: [],
  window: '5m',
  protocolTotals: { TCP: 0, UDP: 0, ICMP: 0 },
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

function renderTopSubnets(topSubnets, activeSubnets) {
  const container = document.getElementById('top-subnets');
  if (container) {
    if (!topSubnets || topSubnets.length === 0) {
      container.textContent = '-';
    } else {
      container.innerHTML = topSubnets.slice(0, 3).map(s =>
        `<span class="top-subnet-item">${subnetAbbrev(s.network)} <span class="top-subnet-pct">${s.percentage.toFixed(1)}%</span></span>`
      ).join('');
    }
  }

  const countEl = document.getElementById('top-subnets-count');
  if (countEl) {
    countEl.textContent = `${activeSubnets} subnet${activeSubnets !== 1 ? 's' : ''}`;
  }
}

function updateWindowBadge(windowKey) {
  const el = document.getElementById('window-badge');
  if (!el) return;
  el.textContent = WINDOW_LABELS[windowKey] || WINDOW_LABELS['5m'];
}

function renderProtocolMiniBar(protocols) {
  const container = document.getElementById('protocol-mini-bar');
  if (!container) return;

  const total = protocols.TCP + protocols.UDP + protocols.ICMP;
  if (total === 0) {
    container.innerHTML = '';
    return;
  }

  const tcpPct = (protocols.TCP / total * 100).toFixed(1);
  const udpPct = (protocols.UDP / total * 100).toFixed(1);
  const icmpPct = (protocols.ICMP / total * 100).toFixed(1);

  container.innerHTML =
    `<div class="protocol-mini-segments">` +
      `<div class="protocol-mini-segment proto-tcp" style="width:${tcpPct}%"></div>` +
      `<div class="protocol-mini-segment proto-udp" style="width:${udpPct}%"></div>` +
      `<div class="protocol-mini-segment proto-icmp" style="width:${icmpPct}%"></div>` +
    `</div>` +
    `<div class="protocol-mini-labels">` +
      `<span class="protocol-mini-label"><span class="protocol-mini-dot" style="background:var(--proto-tcp)"></span><span class="protocol-mini-pct">${tcpPct}%</span></span>` +
      `<span class="protocol-mini-label"><span class="protocol-mini-dot" style="background:var(--proto-udp)"></span><span class="protocol-mini-pct">${udpPct}%</span></span>` +
      `<span class="protocol-mini-label"><span class="protocol-mini-dot" style="background:var(--proto-icmp)"></span><span class="protocol-mini-pct">${icmpPct}%</span></span>` +
    `</div>`;
}

export function update(data) {
  if (!data || !data.summary) return;

  const { totalPackets, totalUniqueIps, totalPps, topSubnets } = data.summary;
  const subnets = data.subnets || [];
  const activeSubnets = subnets.length;

  let totalBytes = 0;
  const protocolTotals = { TCP: 0, UDP: 0, ICMP: 0 };
  for (const s of subnets) {
    totalBytes += s.bytes || 0;
    if (s.protocols) {
      protocolTotals.TCP += s.protocols.TCP || 0;
      protocolTotals.UDP += s.protocols.UDP || 0;
      protocolTotals.ICMP += s.protocols.ICMP || 0;
    }
  }

  animateValue('stat-packets', state.totalPackets, totalPackets, formatNumber);
  animateValue('stat-ips', state.uniqueIps, totalUniqueIps, formatNumber);
  animateValue('stat-pps', state.pps, Math.round(totalPps), v => formatPps(v));
  animateValue('stat-traffic', state.totalBytes, totalBytes, v => formatBytes(v));

  state.totalPackets = totalPackets;
  state.uniqueIps = totalUniqueIps;
  state.pps = Math.round(totalPps);
  state.totalBytes = totalBytes;
  state.activeSubnets = activeSubnets;
  state.topSubnets = topSubnets || [];
  state.protocolTotals = protocolTotals;

  if (data.window && data.window !== state.window) {
    state.window = data.window;
    updateWindowBadge(state.window);
  }

  renderTopSubnets(state.topSubnets, state.activeSubnets);
  renderProtocolMiniBar(state.protocolTotals);
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
