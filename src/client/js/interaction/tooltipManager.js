import { formatNumber, formatPps } from '../utils.js';

let tooltipEl = null;

export function createTooltip() {
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'star-tooltip';
  tooltipEl.style.display = 'none';
  document.body.appendChild(tooltipEl);
}

export function showTooltip(event, d) {
  tooltipEl.innerHTML = `
    <strong>${d.network}</strong>
    ${d.label ? `<span class="tooltip-label">${d.label}</span>` : ''}
    <div class="tooltip-stats">
      <span>Packets: ${formatNumber(d.count)}</span>
      <span>IPs: ${formatNumber(d.uniqueIps)}</span>
      <span>PPS: ${formatPps(d.pps)}</span>
    </div>
  `;
  tooltipEl.style.display = 'block';
  const rect = tooltipEl.getBoundingClientRect();
  let left = event.pageX + 12;
  let top = event.pageY - 12;
  if (left + rect.width > window.innerWidth) {
    left = event.pageX - rect.width - 12;
  }
  if (top + rect.height > window.innerHeight) {
    top = event.pageY - rect.height - 12;
  }
  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
}

export function hideTooltip() {
  tooltipEl.style.display = 'none';
}
