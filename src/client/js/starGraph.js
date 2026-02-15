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
let clustersGroup = null;
let linksGroup = null;
let linkLabelsGroup = null;
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
let zoomBehavior = null;
let hoveredNodeId = null;

let ppsThresholdHigh = 10;
let ppsThresholdMid = 5;
let ppsThresholdLow = 2;

function ppsToAnimDuration(pps) {
  if (pps >= ppsThresholdHigh) return 0.3;
  if (pps >= ppsThresholdMid) return 0.6;
  if (pps >= ppsThresholdLow) return 1.0;
  if (pps >= ppsThresholdLow * 0.25) return 1.5;
  return 2.5;
}

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

function applyHighlight(id, dur) {
  const t = sel => dur > 0 ? sel.transition().duration(dur) : sel;

  t(nodesGroup.selectAll('.ray-group'))
    .attr('opacity', n => n.id === id ? 1 : 0.15);

  t(labelsGroup.selectAll('.ray-label'))
    .attr('opacity', n => n.id === id ? 1 : 0.1)
    .attr('font-size', n => n.id === id ? '14px' : '11px')
    .attr('font-weight', n => n.id === id ? '700' : '400');

  t(linksGroup.selectAll('.ray-link'))
    .attr('stroke-opacity', l => {
      const tid = typeof l.target === 'object' ? l.target.id : l.target;
      return tid === id ? 0.9 : 0.05;
    })
    .attr('stroke-width', l => {
      const tid = typeof l.target === 'object' ? l.target.id : l.target;
      return tid === id ? (l.linkWidth || 2) * 2.5 : l.linkWidth || 2;
    });

  t(linkLabelsGroup.selectAll('.link-label'))
    .attr('opacity', l => {
      const tid = typeof l.target === 'object' ? l.target.id : l.target;
      return tid === id ? 1 : 0;
    })
    .attr('font-size', l => {
      const tid = typeof l.target === 'object' ? l.target.id : l.target;
      return tid === id ? '14px' : '9px';
    })
    .attr('font-weight', l => {
      const tid = typeof l.target === 'object' ? l.target.id : l.target;
      return tid === id ? '700' : '400';
    })
    .attr('fill', l => {
      const tid = typeof l.target === 'object' ? l.target.id : l.target;
      return tid === id ? '#e2e8f0' : '#8899aa';
    });

  t(hubGroup).attr('opacity', 0.4);
  t(clustersGroup).attr('opacity', 0.15);
}

function clearHighlight(dur) {
  const t = sel => dur > 0 ? sel.transition().duration(dur) : sel;

  t(nodesGroup.selectAll('.ray-group'))
    .attr('opacity', 1);

  t(labelsGroup.selectAll('.ray-label'))
    .attr('opacity', 1)
    .attr('font-size', '11px')
    .attr('font-weight', '400');

  t(linksGroup.selectAll('.ray-link'))
    .attr('stroke-opacity', LINK_OPACITY)
    .attr('stroke-width', l => l.linkWidth || 2);

  t(linkLabelsGroup.selectAll('.link-label'))
    .attr('opacity', 1)
    .attr('font-size', '9px')
    .attr('font-weight', '400')
    .attr('fill', '#8899aa');

  t(hubGroup).attr('opacity', 1);
  t(clustersGroup).attr('opacity', 1);
}

function highlightNode(d) {
  hoveredNodeId = d.id;
  applyHighlight(d.id, 150);
}

function unhighlightNode() {
  hoveredNodeId = null;
  clearHighlight(300);
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
        animation-name: pulse-glow;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
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
  return Math.min(width, height) * 0.7;
}

function forceCluster() {
  let nodes;
  const attractStrength = 0.15;

  function force(alpha) {
    const clusterCenters = new Map();
    const clusterCounts = new Map();
    const clusterRadii = new Map();

    for (const node of nodes) {
      if (node.isHub || !node.parentNetwork) continue;
      const key = node.parentNetwork;
      if (!clusterCenters.has(key)) {
        clusterCenters.set(key, { x: 0, y: 0 });
        clusterCounts.set(key, 0);
      }
      const center = clusterCenters.get(key);
      center.x += node.x;
      center.y += node.y;
      clusterCounts.set(key, clusterCounts.get(key) + 1);
    }

    for (const [key, center] of clusterCenters) {
      const count = clusterCounts.get(key);
      center.x /= count;
      center.y /= count;
    }

    for (const [key, center] of clusterCenters) {
      let maxDist = 0;
      for (const node of nodes) {
        if (node.isHub || node.parentNetwork !== key) continue;
        const dist = Math.hypot(node.x - center.x, node.y - center.y) + (node.radius || MIN_RADIUS);
        if (dist > maxDist) maxDist = dist;
      }
      clusterRadii.set(key, maxDist + 30);
    }

    for (const node of nodes) {
      if (node.isHub || !node.parentNetwork) continue;
      const center = clusterCenters.get(node.parentNetwork);
      if (!center) continue;
      node.vx += (center.x - node.x) * attractStrength * alpha;
      node.vy += (center.y - node.y) * attractStrength * alpha;
    }

    for (const node of nodes) {
      if (node.isHub) continue;
      for (const [key, center] of clusterCenters) {
        if (node.parentNetwork === key) continue;
        const dx = node.x - center.x;
        const dy = node.y - center.y;
        const dist = Math.hypot(dx, dy) || 1;
        const clusterR = clusterRadii.get(key) || 50;
        const buffer = clusterR + (node.radius || MIN_RADIUS) + 60;
        if (dist < buffer) {
          const push = 0.25 * alpha * (buffer - dist) / dist;
          node.vx += dx * push;
          node.vy += dy * push;
        }
      }
    }

    const hubX = hubNode ? hubNode.x : centerX;
    const hubY = hubNode ? hubNode.y : centerY;
    for (const [key, center] of clusterCenters) {
      const count = clusterCounts.get(key);
      const minDistFromHub = 150 + count * 25;
      const dx = center.x - hubX;
      const dy = center.y - hubY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < minDistFromHub) {
        const push = 0.4 * alpha * (minDistFromHub - dist) / dist;
        for (const node of nodes) {
          if (node.isHub || node.parentNetwork !== key) continue;
          node.vx += dx * push;
          node.vy += dy * push;
        }
      }
    }

    const clusterKeys = Array.from(clusterCenters.keys());
    for (let i = 0; i < clusterKeys.length; i++) {
      for (let j = i + 1; j < clusterKeys.length; j++) {
        const c1 = clusterCenters.get(clusterKeys[i]);
        const c2 = clusterCenters.get(clusterKeys[j]);
        const r1 = clusterRadii.get(clusterKeys[i]) || 50;
        const r2 = clusterRadii.get(clusterKeys[j]) || 50;
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = r1 + r2 + 150;

        if (dist < minDist) {
          const pushForce = 0.5 * alpha * (minDist - dist) / dist;
          for (const node of nodes) {
            if (node.isHub) continue;
            if (node.parentNetwork === clusterKeys[i]) {
              node.vx -= dx * pushForce;
              node.vy -= dy * pushForce;
            } else if (node.parentNetwork === clusterKeys[j]) {
              node.vx += dx * pushForce;
              node.vy += dy * pushForce;
            }
          }
        }
      }
    }
  }

  force.initialize = function(_nodes) { nodes = _nodes; };
  return force;
}

function initSimulation() {
  simulation = d3.forceSimulation()
    .alphaDecay(0.03)
    .velocityDecay(0.55)
    .force('charge', d3.forceManyBody()
      .strength(d => d.isHub ? 0 : -180)
      .distanceMax(600))
    .force('collide', d3.forceCollide(d => (d.radius || MIN_RADIUS) + 12)
      .strength(0.8)
      .iterations(3))
    .force('link', d3.forceLink()
      .id(d => d.id)
      .distance(d => {
        const target = typeof d.target === 'object' ? d.target : null;
        if (target && target.inCluster) return 250;
        return 160;
      })
      .strength(d => {
        const target = typeof d.target === 'object' ? d.target : null;
        if (target && target.inCluster) return 0.008;
        return 0.04;
      }))
    .force('cluster', forceCluster())
    .on('tick', ticked);

  simulation.stop();
}

function computePaddedHull(nodes, padding) {
  if (nodes.length < 2) return null;

  const points = [];
  for (const node of nodes) {
    const r = (node.radius || MIN_RADIUS) + padding;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      points.push([node.x + Math.cos(angle) * r, node.y + Math.sin(angle) * r]);
    }
  }

  return d3.polygonHull(points);
}

function hullPath(hull) {
  if (!hull || hull.length < 3) return '';
  const lineGenerator = d3.line()
    .x(d => d[0])
    .y(d => d[1])
    .curve(d3.curveCatmullRomClosed.alpha(0.5));
  return lineGenerator(hull);
}

function ticked() {
  const now = Date.now();
  nodesData.forEach(d => {
    if (d.isHub || !d._rippleInterval) return;
    if (now - (d._lastRipple || 0) < d._rippleInterval) return;
    const group = nodesGroup.selectAll('.ray-group').filter(n => n.id === d.id);
    if (group.empty()) return;
    if (group.selectAll('.ripple').size() >= 4) return;
    d._lastRipple = now;
    const baseR = d.radius || MIN_RADIUS;
    const spread = baseR + 50 + (d.pps >= ppsThresholdHigh ? 30 : 0);
    group.append('circle')
      .attr('class', 'ripple')
      .attr('r', baseR)
      .attr('fill', 'none')
      .attr('stroke', d.color)
      .attr('stroke-width', d.pps >= ppsThresholdHigh ? 3.5 : d.pps >= ppsThresholdMid ? 2.5 : 1.5)
      .attr('stroke-opacity', d.pps >= ppsThresholdHigh ? 0.8 : 0.6)
      .transition()
      .duration(d.pps >= ppsThresholdHigh ? 600 : 1000)
      .ease(d3.easeCubicOut)
      .attr('r', spread)
      .attr('stroke-opacity', 0)
      .remove();
  });

  linksGroup.selectAll('.ray-link')
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  linkLabelsGroup.selectAll('.link-label')
    .attr('x', d => d.source.x + (d.target.x - d.source.x) * 0.45)
    .attr('y', d => d.source.y + (d.target.y - d.source.y) * 0.45);

  nodesGroup.selectAll('.ray-group')
    .attr('transform', d => {
      const scale = hoveredNodeId === d.id ? 1.3 : 1;
      return `translate(${d.x},${d.y}) scale(${scale})`;
    });

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

  if (clustersGroup) {
    const clusterGroups = new Map();
    nodesData.forEach(d => {
      if (d.isHub || !d.parentNetwork) return;
      if (!clusterGroups.has(d.parentNetwork)) {
        clusterGroups.set(d.parentNetwork, []);
      }
      clusterGroups.get(d.parentNetwork).push(d);
    });

    const clusterData = Array.from(clusterGroups.entries())
      .map(([name, clusterNodes]) => {
        const hull = computePaddedHull(clusterNodes, 18);
        const cx = d3.mean(clusterNodes, d => d.x);
        const cy = d3.mean(clusterNodes, d => d.y);
        const color = clusterNodes[0].color;
        return { name, hull, cx, cy, color, count: clusterNodes.length };
      })
      .filter(c => c.count >= 2 && c.hull);

    const hulls = clustersGroup.selectAll('.cluster-bg')
      .data(clusterData, d => d.name);

    hulls.exit().remove();

    const hullsEnter = hulls.enter()
      .append('g')
      .attr('class', 'cluster-bg');

    hullsEnter.append('path').attr('class', 'cluster-hull');
    hullsEnter.append('text').attr('class', 'cluster-label');

    const hullsMerged = hullsEnter.merge(hulls);

    hullsMerged.select('.cluster-hull')
      .attr('d', d => hullPath(d.hull))
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.1)
      .attr('stroke', d => d.color)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4')
      .attr('stroke-linejoin', 'round');

    hullsMerged.select('.cluster-label')
      .attr('x', d => d.cx)
      .attr('y', d => {
        const minY = d.hull ? Math.min(...d.hull.map(p => p[1])) : d.cy;
        return minY - 8;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.7)
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .text(d => d.name);
  }
}

function makeDrag() {
  return d3.drag()
    .on('start', function(event, d) {
      event.sourceEvent.stopPropagation();
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

  zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
    });

  svg.call(zoomBehavior);
  svg.on('click', function(event) {
    if (event.target === svg.node() && hoveredNodeId) {
      unhighlightNode();
    }
  });
  clustersGroup = container.append('g').attr('class', 'clusters-group');
  linksGroup = container.append('g').attr('class', 'links-group');
  linkLabelsGroup = container.append('g').attr('class', 'link-labels-group');
  nodesGroup = container.append('g').attr('class', 'nodes-group');
  labelsGroup = container.append('g').attr('class', 'labels-group');
  hubGroup = container.append('g').attr('class', 'hub-group');

  updateDimensions();
  initSimulation();

  const resizeObserver = new ResizeObserver(() => {
    updateDimensions();
    if (simulation) {
      simulation.force('link').distance(d => {
        const target = typeof d.target === 'object' ? d.target : null;
        if (target && target.inCluster) return 250;
        return 160;
      });
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
  hubGroup.attr('opacity', hoveredNodeId ? 0.4 : 1);
  clustersGroup.attr('opacity', hoveredNodeId ? 0.15 : 1);

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
      node.parentNetwork = s.parentNetwork || null;
      oldMap.delete(id);
    } else {
      let spawnX, spawnY;
      const parentNet = s.parentNetwork || null;
      const siblings = parentNet ? newNodes.filter(n => !n.isHub && n.parentNetwork === parentNet) : [];
      if (siblings.length > 0) {
        const cx = d3.mean(siblings, n => n.x);
        const cy = d3.mean(siblings, n => n.y);
        const jitter = 30 + Math.random() * 20;
        const angle = Math.random() * 2 * Math.PI;
        spawnX = cx + Math.cos(angle) * jitter;
        spawnY = cy + Math.sin(angle) * jitter;
      } else {
        const angle = Math.random() * 2 * Math.PI;
        const r = radialRadius();
        spawnX = centerX + Math.cos(angle) * r;
        spawnY = centerY + Math.sin(angle) * r;
      }
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
        parentNetwork: parentNet,
        isHub: false,
        x: spawnX,
        y: spawnY,
      };
    }
    newNodes.push(node);
    newLinks.push({ source: '__hub__', target: id, color, linkWidth, count: s.count });
  });

  nodesData = newNodes;
  linksData = newLinks;

  const parentCounts = new Map();
  nodesData.forEach(n => {
    if (n.isHub || !n.parentNetwork) return;
    parentCounts.set(n.parentNetwork, (parentCounts.get(n.parentNetwork) || 0) + 1);
  });
  nodesData.forEach(n => {
    if (n.isHub) return;
    n.inCluster = n.parentNetwork && (parentCounts.get(n.parentNetwork) || 0) >= 2;
  });

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
    .attr('stroke-width', d => {
      if (!hoveredNodeId) return d.linkWidth;
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return tid === hoveredNodeId ? (d.linkWidth || 2) * 2.5 : d.linkWidth;
    })
    .transition().duration(TRANSITION_DURATION)
    .attr('stroke-opacity', d => {
      if (!hoveredNodeId) return LINK_OPACITY;
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return tid === hoveredNodeId ? 0.9 : 0.05;
    });

  const ll = linkLabelsGroup.selectAll('.link-label')
    .data(linksData, d => d.target);

  ll.exit().remove();

  const llEnter = ll.enter()
    .append('text')
    .attr('class', 'link-label')
    .attr('font-size', '9px')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#8899aa')
    .attr('pointer-events', 'none');

  ll.merge(llEnter)
    .text(d => formatNumber(d.count))
    .attr('font-size', d => {
      if (!hoveredNodeId) return '9px';
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return tid === hoveredNodeId ? '14px' : '9px';
    })
    .attr('font-weight', d => {
      if (!hoveredNodeId) return '400';
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return tid === hoveredNodeId ? '700' : '400';
    })
    .attr('fill', d => {
      if (!hoveredNodeId) return '#8899aa';
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return tid === hoveredNodeId ? '#e2e8f0' : '#8899aa';
    })
    .attr('opacity', d => {
      if (!hoveredNodeId) return 1;
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return tid === hoveredNodeId ? 1 : 0;
    });

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
      if (hoveredNodeId === d.id) {
        unhighlightNode();
      } else {
        highlightNode(d);
      }
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
    .attr('opacity', d => {
      if (!hoveredNodeId) return 1;
      return d.id === hoveredNodeId ? 1 : 0.15;
    });

  merged.select('.ray-node-glow')
    .style('animation-duration', d => ppsToAnimDuration(d.pps) + 's')
    .transition().duration(TRANSITION_DURATION)
    .attr('r', d => d.radius + (d.pps >= ppsThresholdHigh ? 18 : d.pps >= ppsThresholdMid ? 12 : 6))
    .attr('fill', d => d.glowColor)
    .attr('opacity', d => {
      if (d.pps >= ppsThresholdHigh) return 0.6;
      if (d.pps >= ppsThresholdMid) return 0.45;
      if (d.pps >= ppsThresholdLow) return 0.3;
      return 0.15;
    })
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
    .attr('font-size', d => hoveredNodeId && d.id === hoveredNodeId ? '14px' : '11px')
    .attr('font-weight', d => hoveredNodeId && d.id === hoveredNodeId ? '700' : '400')
    .transition().duration(TRANSITION_DURATION)
    .attr('opacity', d => {
      if (!hoveredNodeId) return 1;
      return d.id === hoveredNodeId ? 1 : 0.1;
    });

  subnetNodes.forEach(d => {
    d._lastRipple = d._lastRipple || 0;
    d._rippleInterval = d.pps >= ppsThresholdHigh ? 400 : d.pps >= ppsThresholdMid ? 700 : d.pps >= ppsThresholdLow ? 1200 : 0;
  });

  const hasStructuralChange = enter.size() > 0 || groups.exit().size() > 0;

  simulation.nodes(nodesData);
  simulation.force('link').links(linksData);
  simulation.force('collide').radius(d => (d.radius || MIN_RADIUS) + 12);

  if (hasStructuralChange) {
    simulation.alpha(0.3).restart();
  } else if (simulation.alpha() < 0.01) {
    simulation.alpha(0.02).restart();
  }

  if (hoveredNodeId && !nodesData.find(n => n.id === hoveredNodeId)) {
    hoveredNodeId = null;
  }
}

export function setIface(iface) {
  currentIface = iface;
}

export function getSelectedNetwork() {
  return selectedNetwork;
}

export function setPpsThreshold(value) {
  ppsThresholdHigh = value;
  ppsThresholdMid = value * 0.5;
  ppsThresholdLow = value * 0.2;
}
