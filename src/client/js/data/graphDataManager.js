import { VISUAL_CONFIG } from '../config.js';
import { getSubnetColor, getSubnetGlowColor } from '../utils.js';

const d3 = window.d3;

function computeNodeRadius(count, maxCount) {
  if (maxCount <= 0) return VISUAL_CONFIG.MIN_RADIUS;
  const ratio = Math.log(count + 1) / Math.log(maxCount + 1);
  return VISUAL_CONFIG.MIN_RADIUS + (VISUAL_CONFIG.MAX_RADIUS - VISUAL_CONFIG.MIN_RADIUS) * ratio;
}

function computeLinkWidth(uniqueIps, maxUniqueIps) {
  if (maxUniqueIps <= 0) return VISUAL_CONFIG.LINK_WIDTH_MIN;
  const ratio = Math.min(1, uniqueIps / maxUniqueIps);
  return VISUAL_CONFIG.LINK_WIDTH_MIN + (VISUAL_CONFIG.LINK_WIDTH_MAX - VISUAL_CONFIG.LINK_WIDTH_MIN) * ratio;
}

export default class GraphDataManager {
  #nodesData = [];
  #linksData = [];
  #hubNode = null;

  get nodes() { return this.#nodesData; }
  get links() { return this.#linksData; }
  get hubNode() { return this.#hubNode; }
  get subnetNodes() { return this.#nodesData.filter(d => !d.isHub); }

  update(subnets, maxCount, maxUniqueIps, centerX, centerY, radialRadius) {
    const oldMap = new Map();
    this.#nodesData.forEach(n => {
      if (!n.isHub) oldMap.set(n.id, n);
    });

    if (!this.#hubNode) {
      this.#hubNode = { id: '__hub__', isHub: true, x: centerX, y: centerY, fx: centerX, fy: centerY, radius: VISUAL_CONFIG.HUB_RADIUS };
    }
    this.#hubNode.fx = centerX;
    this.#hubNode.fy = centerY;

    const newNodes = [this.#hubNode];
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
          const jitter = VISUAL_CONFIG.SPAWN_JITTER_MIN + Math.random() * VISUAL_CONFIG.SPAWN_JITTER_RANGE;
          const angle = Math.random() * 2 * Math.PI;
          spawnX = cx + Math.cos(angle) * jitter;
          spawnY = cy + Math.sin(angle) * jitter;
        } else {
          const angle = Math.random() * 2 * Math.PI;
          spawnX = centerX + Math.cos(angle) * radialRadius;
          spawnY = centerY + Math.sin(angle) * radialRadius;
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

    this.#nodesData = newNodes;
    this.#linksData = newLinks;

    this.#updateClusterMembership();
  }

  #updateClusterMembership() {
    const parentCounts = new Map();
    this.#nodesData.forEach(n => {
      if (n.isHub || !n.parentNetwork) return;
      parentCounts.set(n.parentNetwork, (parentCounts.get(n.parentNetwork) || 0) + 1);
    });
    this.#nodesData.forEach(n => {
      if (n.isHub) return;
      n.inCluster = n.parentNetwork && (parentCounts.get(n.parentNetwork) || 0) >= VISUAL_CONFIG.CLUSTER_MIN_NODES;
    });
  }

  removeStaleHighlight(highlightManager) {
    if (highlightManager.hoveredNodeId && !this.#nodesData.find(n => n.id === highlightManager.hoveredNodeId)) {
      highlightManager.clearHighlight();
    }
  }
}
