import { formatNumber, formatPps, formatPercent, formatBytes, getSubnetColor } from './utils.js';

let panelEl = null;
let selectedNetwork = null;
let isOpen = false;
let detailData = null;

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
  detailData = null;
  renderContent(subnetData);
  panelEl.classList.add('open');
  isOpen = true;
}

export function close() {
  if (!panelEl) return;
  panelEl.classList.remove('open');
  isOpen = false;
  selectedNetwork = null;
  detailData = null;
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

export function updateDetail(data) {
  if (!isOpen || !selectedNetwork) return;
  if (data.network !== selectedNetwork) return;
  detailData = data;
  renderExtendedSections();
}

function renderProtocolBar(protocols) {
  if (!protocols) return '';
  const total = (protocols.TCP || 0) + (protocols.UDP || 0) + (protocols.ICMP || 0);
  if (total === 0) return '';

  const segments = [
    { key: 'TCP', cls: 'proto-tcp', count: protocols.TCP || 0 },
    { key: 'UDP', cls: 'proto-udp', count: protocols.UDP || 0 },
    { key: 'ICMP', cls: 'proto-icmp', count: protocols.ICMP || 0 },
  ].filter((s) => s.count > 0);

  const barHtml = segments
    .map((s) => {
      const pct = ((s.count / total) * 100).toFixed(1);
      const narrow = parseFloat(pct) < 5;
      return `<div class="protocol-segment ${s.cls}" style="width:${pct}%" data-narrow="${narrow}">${s.key} ${pct}%</div>`;
    })
    .join('');

  const legendHtml = segments
    .map((s) => {
      const pct = ((s.count / total) * 100).toFixed(1);
      return `<span class="protocol-legend-item"><span class="protocol-legend-dot" style="background:var(--${s.cls})"></span>${s.key} ${pct}%</span>`;
    })
    .join('');

  return `
    <div class="detail-section-divider"></div>
    <div class="detail-section-header">
      <span class="detail-section-title">Protocols</span>
      <span class="detail-section-count">${formatNumber(total)} total</span>
    </div>
    <div class="detail-protocol-bar">${barHtml}</div>
    <div class="detail-protocol-legend">${legendHtml}</div>
  `;
}

function renderProtocolDetailCards(protocolDetail) {
  if (!protocolDetail) return '';

  const protoColors = { TCP: 'var(--proto-tcp)', UDP: 'var(--proto-udp)', ICMP: 'var(--proto-icmp)' };

  const cards = ['TCP', 'UDP', 'ICMP']
    .filter((proto) => protocolDetail[proto] && protocolDetail[proto].count > 0)
    .map((proto) => {
      const p = protocolDetail[proto];
      const portsHtml = proto !== 'ICMP' && p.topPorts && p.topPorts.length > 0
        ? `<div class="proto-port-list">${p.topPorts.map((tp) => {
            const pct = p.count > 0 ? ((tp.count / p.count) * 100).toFixed(1) : '0.0';
            return `<div class="proto-port-row">
              <span class="proto-port-num">${tp.port}</span>
              <span class="proto-port-label">${tp.label || ''}</span>
              <span class="proto-port-count">${formatNumber(tp.count)}</span>
              <span class="proto-port-pct">${pct}%</span>
            </div>`;
          }).join('')}</div>`
        : '';

      return `<div class="proto-detail-card">
        <div class="proto-detail-header">
          <span class="proto-detail-name" style="color:${protoColors[proto]}">${proto}</span>
          <span class="proto-detail-count">${formatNumber(p.count)} pkts</span>
        </div>
        <div class="proto-detail-stats">
          <span><span class="proto-detail-stat-label">Bytes </span><span class="proto-detail-stat-value">${formatBytes(p.bytes)}</span></span>
          <span><span class="proto-detail-stat-label">PPS </span><span class="proto-detail-stat-value">${formatPps(p.pps)}/s</span></span>
        </div>
        ${portsHtml}
      </div>`;
    })
    .join('');

  if (!cards) return '';

  return `
    <div class="detail-section-divider"></div>
    <div class="detail-section-header">
      <span class="detail-section-title">Protocol Details</span>
    </div>
    ${cards}
  `;
}

function renderIpRow(ip, totalCount) {
  const pct = totalCount > 0 ? ((ip.count / totalCount) * 100).toFixed(1) : 0;
  return `
        <div class="detail-ip-row">
          <div class="detail-ip-bar" style="width:${pct}%"></div>
          <span class="detail-ip-addr">${ip.ip}</span>
          <span class="detail-ip-count">${formatNumber(ip.count)}</span>
          <span class="detail-ip-pct">${formatPercent(ip.count, totalCount)}</span>
        </div>`;
}

function renderTopIps(topIps, uniqueIps, totalCount) {
  if (!topIps || topIps.length === 0) return '';

  const ips = detailData ? detailData.allIps : topIps;
  const title = detailData ? 'All IPs' : 'Top IPs';

  const rowsHtml = ips.map((ip) => renderIpRow(ip, totalCount)).join('');

  let footerHtml = '';
  if (!detailData) {
    const moreCount = uniqueIps - topIps.length;
    if (moreCount > 0) {
      footerHtml = `<div class="detail-ip-more">and ${formatNumber(moreCount)} more IPs</div>`;
    }
    footerHtml += `<div class="detail-ip-loading">Loading full list...</div>`;
  }

  return `
    <div class="detail-section-divider"></div>
    <div class="detail-section-header">
      <span class="detail-section-title">${title}</span>
      <span class="detail-section-count">${formatNumber(detailData ? ips.length : uniqueIps)} ${detailData ? 'total' : 'unique'}</span>
    </div>
    <div class="detail-ip-list">${rowsHtml}${footerHtml}</div>
  `;
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
    const typeLabel = d.label || (d.isPrivate ? 'Private Network' : 'Public Network');
    const badgeClass = d.isPrivate ? 'private' : 'public';
    const badgeText = d.isPrivate ? 'Private' : 'Public';
    labelEl.innerHTML = `${typeLabel} <span class="detail-type-badge ${badgeClass}">${badgeText}</span>`;
  }

  if (statsEl) {
    const statsHtml = `
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

    const protocolHtml = renderProtocolBar(d.protocols);
    const protoDetailHtml = renderProtocolDetailCards(detailData?.protocolDetail);
    const topIpsHtml = renderTopIps(d.topIps, d.uniqueIps, d.count);

    statsEl.innerHTML = statsHtml + protocolHtml + protoDetailHtml + topIpsHtml;
  }
}

function renderExtendedSections() {
  if (!panelEl) return;
  const statsEl = document.getElementById('detail-stats');
  if (!statsEl) return;

  const protoDetailContainer = statsEl.querySelector('.proto-detail-card')?.parentElement;
  const existingProtoHeader = Array.from(statsEl.querySelectorAll('.detail-section-header'))
    .find(h => h.querySelector('.detail-section-title')?.textContent === 'Protocol Details');

  const protoDetailHtml = renderProtocolDetailCards(detailData?.protocolDetail);

  const ipHeader = Array.from(statsEl.querySelectorAll('.detail-section-header'))
    .find(h => {
      const title = h.querySelector('.detail-section-title')?.textContent;
      return title === 'Top IPs' || title === 'All IPs';
    });

  if (ipHeader) {
    const divider = ipHeader.previousElementSibling;
    const ipList = ipHeader.nextElementSibling;

    if (existingProtoHeader) {
      const protoDivider = existingProtoHeader.previousElementSibling;
      let el = existingProtoHeader.nextElementSibling;
      const toRemove = [existingProtoHeader];
      if (protoDivider?.classList.contains('detail-section-divider')) toRemove.push(protoDivider);
      while (el && !el.classList.contains('detail-section-divider') && el !== divider) {
        toRemove.push(el);
        el = el.nextElementSibling;
      }
      toRemove.forEach(e => e.remove());
    }

    if (protoDetailHtml) {
      const temp = document.createElement('div');
      temp.innerHTML = protoDetailHtml;
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) fragment.appendChild(temp.firstChild);
      divider.parentElement.insertBefore(fragment, divider);
    }

    if (ipList && detailData) {
      const totalCount = detailData.allIps.reduce((sum, ip) => sum + ip.count, 0);
      const rowsHtml = detailData.allIps.map((ip) => renderIpRow(ip, totalCount)).join('');

      const countEl = ipHeader.querySelector('.detail-section-count');
      const titleEl = ipHeader.querySelector('.detail-section-title');
      if (titleEl) titleEl.textContent = 'All IPs';
      if (countEl) countEl.textContent = `${formatNumber(detailData.allIps.length)} total`;
      ipList.innerHTML = rowsHtml;
    }
  }
}
