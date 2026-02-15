import { getSubnetColor, getSubnetGlowColor, formatNumber, formatPps, subnetAbbrev } from './utils.js';

const d3 = window.d3;

const MIN_RADIUS = 12;
const MAX_RADIUS = 50;
const HUB_RADIUS = 50;
const LINK_WIDTH_MIN = 2;
const LINK_WIDTH_MAX = 4;
const LINK_OPACITY = 0.5;
const TRANSITION_DURATION = 400;

let svg = null;
let container = null;
let defs = null;
let linksGroup = null;
let nodesGroup = null;
let labelsGroup = null;
let hubGroup = null;
let tooltipEl = null;
let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let onRayClick = null;
let currentIface = null;
let simulation = null;
let nodesData = [];
let linksData = [];
let hubNode = null;
let selectedNetwork = null;

function createTooltip() {
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'star-tooltip';
  tooltipEl.style.display = 'none';
  document.body.appendChild(tooltipEl);
}

function showTooltip(event, d) {
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

function hideTooltip() {
  tooltipEl.style.display = 'none';
}

function computeNodeRadius(count, maxCount) {
  if (maxCount <= 0) return MIN_RADIUS;
  const ratio = Math.log(count + 1) / Math.log(maxCount + 1);
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * ratio;
}

function computeLinkWidth(uniqueIps, maxUniqueIps) {
  if (maxUniqueIps <= 0) return LINK_WIDTH_MIN;
  const ratio = Math.min(1, uniqueIps / maxUniqueIps);
  return LINK_WIDTH_MIN + (LINK_WIDTH_MAX - LINK_WIDTH_MIN) * ratio;
}

function ensureGlowFilter() {
  if (defs.select('#glow-filter').empty()) {
    const filter = defs.append('filter')
      .attr('id', 'glow-filter')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
  }

  if (defs.select('#hub-glow').empty()) {
    const hubGlow = defs.append('filter')
      .attr('id', 'hub-glow')
      .attr('x', '-100%').attr('y', '-100%')
      .attr('width', '300%').attr('height', '300%');
    hubGlow.append('feGaussianBlur')
      .attr('stdDeviation', '6')
      .attr('result', 'blur');
    const merge2 = hubGlow.append('feMerge');
    merge2.append('feMergeNode').attr('in', 'blur');
    merge2.append('feMergeNode').attr('in', 'SourceGraphic');
  }
}

function ensurePulseAnimation() {
  const styleId = 'star-pulse-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      .ray-node-glow {
        animation: pulse-glow 1.5s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }
}

function updateDimensions() {
  const svgEl = svg.node();
  const rect = svgEl.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  centerX = width / 2;
  centerY = height / 2;
}

function radialRadius() {
  return Math.min(width, height) * 0.3;
}

function initSimulation() {
  simulation = d3.forceSimulation()
    .alphaDecay(0.015)
    .velocityDecay(0.35)
    .force('center', d3.forceCenter(centerX, centerY))
    .force('radial', d3.forceRadial(radialRadius(), centerX, centerY)
      .strength(d => d.isHub ? 0 : 0.1))
    .force('collide', d3.forceCollide(d => (d.radius || MIN_RADIUS) + 8)
      .strength(0.7)
      .iterations(2))
    .force('charge', d3.forceManyBody()
      .strength(-30))
    .force('link', d3.forceLink()
      .id(d => d.id)
      .distance(radialRadius())
      .strength(0.05))
    .on('tick', ticked);

  simulation.stop();
}

function ticked() {
  linksGroup.selectAll('.ray-link')
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  nodesGroup.selectAll('.ray-group')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  labelsGroup.selectAll('.ray-label')
    .attr('x', d => {
      const offset = (d.radius || MIN_RADIUS) + 8;
      return d.x > centerX ? d.x + offset : d.x - offset;
    })
    .attr('y', d => d.y)
    .attr('text-anchor', d => d.x > centerX ? 'start' : 'end');

  hubGroup.attr('transform', () => {
    if (hubNode) return `translate(${hubNode.x},${hubNode.y})`;
    return `translate(${centerX},${centerY})`;
  });
}

function makeDrag() {
  return d3.drag()
    .on('start', function(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', function(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', function(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}

function renderHub(totalPackets) {
  hubGroup.selectAll('*').remove();

  hubGroup.append('circle')
    .attr('class', 'hub-outer')
    .attr('r', HUB_RADIUS + 12)
    .attr('fill', 'rgba(100, 180, 255, 0.08)')
    .attr('stroke', 'rgba(100, 180, 255, 0.15)')
    .attr('stroke-width', 1);

  hubGroup.append('circle')
    .attr('class', 'hub-circle')
    .attr('r', HUB_RADIUS)
    .attr('fill', '#0f1b3d')
    .attr('stroke', '#4a9eff')
    .attr('stroke-width', 2)
    .attr('filter', 'url(#hub-glow)');

  hubGroup.append('text')
    .attr('class', 'hub-text')
    .attr('y', -6)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#7dd3fc')
    .attr('font-size', '12px')
    .attr('font-weight', 'bold')
    .text(currentIface || 'SERVER');

  hubGroup.append('text')
    .attr('class', 'hub-subtext')
    .attr('y', 10)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#4a9eff')
    .attr('font-size', '9px')
    .text(formatNumber(totalPackets) + ' pkts');

  hubGroup.call(makeDrag());
}

function renderWaitingMessage(show) {
  let msg = container.selectAll('.waiting-msg').data(show ? [1] : []);

  msg.exit().transition().duration(200).attr('opacity', 0).remove();

  msg.enter()
    .append('text')
    .attr('class', 'waiting-msg')
    .attr('x', centerX)
    .attr('y', centerY + 80)
    .attr('text-anchor', 'middle')
    .attr('fill', '#4a6a8a')
    .attr('font-size', '14px')
    .attr('opacity', 0)
    .text('Waiting for traffic...')
    .transition().duration(500)
    .attr('opacity', 1);
}

export function init(containerSelector, clickCallback) {
  const el = document.querySelector(containerSelector);
  if (!el) return;

  onRayClick = clickCallback;
  createTooltip();
  ensurePulseAnimation();

  svg = d3.select(containerSelector).append('svg')
    .attr('class', 'star-svg')
    .attr('width', '100%')
    .attr('height', '100%');

  defs = svg.append('defs');
  ensureGlowFilter();

  container = svg.append('g').attr('class', 'star-container');
  linksGroup = container.append('g').attr('class', 'links-group');
  nodesGroup = container.append('g').attr('class', 'nodes-group');
  labelsGroup = container.append('g').attr('class', 'labels-group');
  hubGroup = container.append('g').attr('class', 'hub-group');

  updateDimensions();
  initSimulation();

  const resizeObserver = new ResizeObserver(() => {
    updateDimensions();
    if (simulation) {
      simulation.force('center', d3.forceCenter(centerX, centerY));
      simulation.force('radial', d3.forceRadial(radialRadius(), centerX, centerY)
        .strength(d => d.isHub ? 0 : 0.1));
      simulation.force('link').distance(radialRadius());
      if (hubNode) {
        hubNode.fx = centerX;
        hubNode.fy = centerY;
      }
      simulation.alpha(0.3).restart();
    }
  });
  resizeObserver.observe(el);
}

export function update(data) {
  if (!svg || !simulation) return;

  updateDimensions();

  const totalPackets = data.summary ? data.summary.totalPackets : 0;
  const subnets = data.subnets || [];
  const maxCount = d3.max(subnets, d => d.count) || 1;
  const maxUniqueIps = d3.max(subnets, d => d.uniqueIps) || 1;

  renderHub(totalPackets);
  renderWaitingMessage(subnets.length === 0);

  const oldMap = new Map();
  nodesData.forEach(n => {
    if (!n.isHub) oldMap.set(n.id, n);
  });

  if (!hubNode) {
    hubNode = { id: '__hub__', isHub: true, x: centerX, y: centerY, fx: centerX, fy: centerY, radius: HUB_RADIUS };
  }
  hubNode.fx = centerX;
  hubNode.fy = centerY;

  const newNodes = [hubNode];
  const newLinks = [];

  subnets.forEach(s => {
    const id = s.network;
    const radius = computeNodeRadius(s.count, maxCount);
    const color = getSubnetColor(s.network);
    const glowColor = getSubnetGlowColor(s.network);
    const linkWidth = computeLinkWidth(s.uniqueIps, maxUniqueIps);

    const existing = oldMap.get(id);
    let node;
    if (existing) {
      node = existing;
      node.radius = radius;
      node.color = color;
      node.glowColor = glowColor;
      node.count = s.count;
      node.uniqueIps = s.uniqueIps;
      node.pps = s.pps;
      node.label = s.label;
      node.network = s.network;
      node.linkWidth = linkWidth;
      oldMap.delete(id);
    } else {
      const angle = Math.random() * 2 * Math.PI;
      const r = radialRadius();
      node = {
        id,
        network: s.network,
        label: s.label,
        count: s.count,
        uniqueIps: s.uniqueIps,
        pps: s.pps,
        radius,
        color,
        glowColor,
        linkWidth,
        isHub: false,
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r,
      };
    }
    newNodes.push(node);
    newLinks.push({ source: '__hub__', target: id, color, linkWidth });
  });

  nodesData = newNodes;
  linksData = newLinks;

  const links = linksGroup.selectAll('.ray-link')
    .data(linksData, d => d.target);

  links.exit()
    .transition().duration(TRANSITION_DURATION)
    .attr('stroke-opacity', 0)
    .remove();

  const linksEnter = links.enter()
    .append('line')
    .attr('class', 'ray-link')
    .attr('stroke-opacity', 0);

  links.merge(linksEnter)
    .attr('stroke', d => d.color)
    .attr('stroke-width', d => d.linkWidth)
    .transition().duration(TRANSITION_DURATION)
    .attr('stroke-opacity', LINK_OPACITY);

  const subnetNodes = nodesData.filter(d => !d.isHub);

  const groups = nodesGroup.selectAll('.ray-group')
    .data(subnetNodes, d => d.id);

  groups.exit()
    .transition().duration(TRANSITION_DURATION)
    .attr('opacity', 0)
    .remove();

  const enter = groups.enter()
    .append('g')
    .attr('class', 'ray-group')
    .attr('opacity', 0)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) { showTooltip(event, d); })
    .on('mousemove', function(event, d) { showTooltip(event, d); })
    .on('mouseleave', hideTooltip)
    .on('click', function(event, d) {
      event.stopPropagation();
      selectedNetwork = d.network;
      if (onRayClick) onRayClick(d);
    });

  enter.append('circle')
    .attr('class', 'ray-node-glow')
    .attr('r', 0);

  enter.append('circle')
    .attr('class', 'ray-node')
    .attr('r', 0);

  const merged = enter.merge(groups);
  merged.call(makeDrag());

  merged.transition().duration(TRANSITION_DURATION)
    .attr('opacity', 1);

  merged.select('.ray-node-glow')
    .transition().duration(TRANSITION_DURATION)
    .attr('r', d => d.radius + 6)
    .attr('fill', d => d.glowColor)
    .attr('opacity', 0.3)
    .attr('filter', 'url(#glow-filter)');

  merged.select('.ray-node')
    .transition().duration(TRANSITION_DURATION)
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .attr('stroke', d => d.glowColor)
    .attr('stroke-width', 1.5);

  const labels = labelsGroup.selectAll('.ray-label')
    .data(subnetNodes, d => d.id);

  labels.exit()
    .transition().duration(TRANSITION_DURATION)
    .attr('opacity', 0)
    .remove();

  const labelsEnter = labels.enter()
    .append('text')
    .attr('class', 'ray-label')
    .attr('font-size', '11px')
    .attr('fill', '#a0b4cc')
    .attr('dominant-baseline', 'middle')
    .attr('opacity', 0);

  labels.merge(labelsEnter)
    .text(d => subnetAbbrev(d.network))
    .transition().duration(TRANSITION_DURATION)
    .attr('opacity', 1);

  simulation.nodes(nodesData);
  simulation.force('link').links(linksData);
  simulation.force('collide').radius(d => (d.radius || MIN_RADIUS) + 8);
  simulation.alpha(0.3).restart();
}

export function setIface(iface) {
  currentIface = iface;
}

export function getSelectedNetwork() {
  return selectedNetwork;
}
