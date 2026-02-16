import { VISUAL_CONFIG, PPS_THRESHOLDS } from './config.js';
import HighlightManager from './helpers/highlightManager.js';
import { createSimulation, updateLinkDistance, clampNodesToHubDistance } from './simulation/forceSimulation.js';
import GraphDataManager from './data/graphDataManager.js';
import { renderHub } from './rendering/hubRenderer.js';
import { renderLinks, renderLinkLabels, renderWaitingMessage } from './rendering/linkRenderer.js';
import { renderNodes } from './rendering/nodeRenderer.js';
import { renderNodeLabels } from './rendering/labelRenderer.js';
import { renderClusters } from './rendering/clusterRenderer.js';
import { updateRipples, computeRippleInterval } from './effects/rippleEffect.js';
import { ensureGlowFilter, ensurePulseAnimation } from './effects/glowFilters.js';
import { createTooltip, showTooltip, hideTooltip } from './interaction/tooltipManager.js';
import { createDragBehavior } from './interaction/dragBehavior.js';
import { updatePositions } from './layout/positionManager.js';
import { createZoomBehavior } from './layout/zoomManager.js';

const d3 = window.d3;

let svg = null;
let container = null;
let defs = null;
let clustersGroup = null;
let linksGroup = null;
let linkLabelsGroup = null;
let nodesGroup = null;
let labelsGroup = null;
let hubGroup = null;
let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let onRayClick = null;
let currentIface = null;
let simulation = null;
let selectedNetwork = null;
const highlight = new HighlightManager();
const dataManager = new GraphDataManager();

let ppsThresholdHigh = PPS_THRESHOLDS.DEFAULT_HIGH;
let ppsThresholdMid = PPS_THRESHOLDS.DEFAULT_HIGH * PPS_THRESHOLDS.DEFAULT_MID_MULTIPLIER;
let ppsThresholdLow = PPS_THRESHOLDS.DEFAULT_HIGH * PPS_THRESHOLDS.DEFAULT_LOW_MULTIPLIER;

function getPpsThresholds() {
  return { high: ppsThresholdHigh, mid: ppsThresholdMid, low: ppsThresholdLow };
}

function ppsToAnimDuration(pps) {
  if (pps >= ppsThresholdHigh) return VISUAL_CONFIG.ANIM_DURATION_HIGH;
  if (pps >= ppsThresholdMid) return VISUAL_CONFIG.ANIM_DURATION_MID;
  if (pps >= ppsThresholdLow) return VISUAL_CONFIG.ANIM_DURATION_LOW;
  if (pps >= ppsThresholdLow * PPS_THRESHOLDS.DEFAULT_VLOW_MULTIPLIER) return VISUAL_CONFIG.ANIM_DURATION_VLOW;
  return VISUAL_CONFIG.ANIM_DURATION_NONE;
}

function syncHighlightVisuals(dur) {
  const t = sel => dur > 0 ? sel.transition().duration(dur) : sel;
  t(nodesGroup.selectAll('.ray-group'))
    .attr('opacity', n => highlight.getNodeOpacity(n.id));
  t(labelsGroup.selectAll('.ray-label'))
    .attr('opacity', n => highlight.getLabelOpacity(n.id))
    .attr('font-size', n => highlight.getLabelFontSize(n.id))
    .attr('font-weight', n => highlight.getLabelFontWeight(n.id));
  t(linksGroup.selectAll('.ray-link'))
    .attr('stroke-opacity', l => highlight.getLinkOpacity(l))
    .attr('stroke-width', l => highlight.getLinkWidth(l, l.linkWidth || VISUAL_CONFIG.LINK_WIDTH_MIN));
  t(linkLabelsGroup.selectAll('.link-label'))
    .attr('opacity', l => highlight.getLinkLabelOpacity(l))
    .attr('font-size', l => highlight.getLinkLabelFontSize(l))
    .attr('font-weight', l => highlight.getLinkLabelFontWeight(l))
    .attr('fill', l => highlight.getLinkLabelFill(l));
  t(hubGroup).attr('opacity', highlight.getHubOpacity());
  t(clustersGroup).attr('opacity', highlight.getClusterOpacity());
}

function highlightNode(d) {
  highlight.setHighlight(d.id);
  syncHighlightVisuals(VISUAL_CONFIG.HIGHLIGHT_TRANSITION);
}

function unhighlightNode() {
  highlight.clearHighlight();
  syncHighlightVisuals(VISUAL_CONFIG.UNHIGHLIGHT_TRANSITION);
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
  return Math.min(width, height) * VISUAL_CONFIG.RADIAL_SCALE;
}

function makeDrag() {
  return createDragBehavior(() => simulation);
}

function ticked() {
  updateRipples(nodesGroup, dataManager.nodes, getPpsThresholds());

  clampNodesToHubDistance(dataManager.nodes, dataManager.hubNode, centerX, centerY);

  updatePositions({
    linksGroup,
    linkLabelsGroup,
    nodesGroup,
    labelsGroup,
    hubGroup,
    highlight,
    getHubNode: () => dataManager.hubNode,
    centerY,
  }, centerX);

  if (clustersGroup) {
    renderClusters(clustersGroup, dataManager.nodes);
  }
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
  ensureGlowFilter(defs);

  container = svg.append('g').attr('class', 'star-container');

  createZoomBehavior(svg, container);

  svg.on('click', function(event) {
    if (event.target === svg.node() && highlight.hoveredNodeId) {
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
  simulation = createSimulation(
    ticked,
    () => dataManager.hubNode,
    () => centerX,
    () => centerY,
  );

  const resizeObserver = new ResizeObserver(() => {
    updateDimensions();
    if (simulation) {
      updateLinkDistance(simulation);
      const hub = dataManager.hubNode;
      if (hub) {
        hub.fx = centerX;
        hub.fy = centerY;
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

  renderHub(hubGroup, totalPackets, currentIface, makeDrag);
  renderWaitingMessage(container, subnets.length === 0, centerX, centerY);
  hubGroup.attr('opacity', highlight.getHubOpacity());
  clustersGroup.attr('opacity', highlight.getClusterOpacity());

  dataManager.update(subnets, maxCount, maxUniqueIps, centerX, centerY, radialRadius());

  const nodesData = dataManager.nodes;
  const linksData = dataManager.links;

  renderLinks(linksGroup, linksData, highlight);
  renderLinkLabels(linkLabelsGroup, linksData, highlight);

  const subnetNodes = nodesData.filter(d => !d.isHub);

  const onNodeClick = (event, d) => {
    event.stopPropagation();
    if (highlight.hoveredNodeId === d.id) {
      unhighlightNode();
    } else {
      highlightNode(d);
    }
    selectedNetwork = d.network;
    if (onRayClick) onRayClick(d);
  };

  const { enter, groups } = renderNodes(
    nodesGroup, subnetNodes, highlight, makeDrag,
    ppsToAnimDuration, getPpsThresholds(),
    { showTooltip, hideTooltip, onNodeClick }
  );

  renderNodeLabels(labelsGroup, subnetNodes, highlight);

  subnetNodes.forEach(d => {
    d._lastRipple = d._lastRipple || 0;
    d._rippleInterval = computeRippleInterval(d.pps, getPpsThresholds());
  });

  const hasStructuralChange = enter.size() > 0 || groups.exit().size() > 0;

  simulation.nodes(nodesData);
  simulation.force('link').links(linksData);
  simulation.force('collide').radius(d => (d.radius || VISUAL_CONFIG.MIN_RADIUS) + VISUAL_CONFIG.FORCE_COLLIDE_PADDING);

  if (hasStructuralChange) {
    simulation.alpha(0.3).restart();
  } else if (simulation.alpha() < 0.01) {
    simulation.alpha(0.02).restart();
  }

  dataManager.removeStaleHighlight(highlight);
}

export function setIface(iface) {
  currentIface = iface;
}

export function getSelectedNetwork() {
  return selectedNetwork;
}

export function setPpsThreshold(value) {
  ppsThresholdHigh = value;
  ppsThresholdMid = value * PPS_THRESHOLDS.DEFAULT_MID_MULTIPLIER;
  ppsThresholdLow = value * PPS_THRESHOLDS.DEFAULT_LOW_MULTIPLIER;
}

export function restartSimulation() {
  if (!simulation) return;
  updateLinkDistance(simulation);
  simulation.force('charge').strength(d => d.isHub ? 0 : VISUAL_CONFIG.FORCE_CHARGE_STRENGTH);
  simulation.alpha(0.3).restart();
}
