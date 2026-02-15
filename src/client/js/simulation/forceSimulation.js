import { VISUAL_CONFIG } from '../config.js';
import { getLinkTargetNode } from '../helpers/linkHelpers.js';

const d3 = window.d3;

function createClusterForce(getHubNode, getCenterX, getCenterY) {
  let nodes;

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
        const dist = Math.hypot(node.x - center.x, node.y - center.y) + (node.radius || VISUAL_CONFIG.MIN_RADIUS);
        if (dist > maxDist) maxDist = dist;
      }
      clusterRadii.set(key, maxDist + VISUAL_CONFIG.CLUSTER_RADIUS_PADDING);
    }

    for (const node of nodes) {
      if (node.isHub || !node.parentNetwork) continue;
      const center = clusterCenters.get(node.parentNetwork);
      if (!center) continue;
      node.vx += (center.x - node.x) * VISUAL_CONFIG.CLUSTER_ATTRACT_STRENGTH * alpha;
      node.vy += (center.y - node.y) * VISUAL_CONFIG.CLUSTER_ATTRACT_STRENGTH * alpha;
    }

    for (const node of nodes) {
      if (node.isHub) continue;
      for (const [key, center] of clusterCenters) {
        if (node.parentNetwork === key) continue;
        const dx = node.x - center.x;
        const dy = node.y - center.y;
        const dist = Math.hypot(dx, dy) || 1;
        const clusterR = clusterRadii.get(key) || 50;
        const buffer = clusterR + (node.radius || VISUAL_CONFIG.MIN_RADIUS) + VISUAL_CONFIG.CLUSTER_NODE_BUFFER;
        if (dist < buffer) {
          const push = VISUAL_CONFIG.CLUSTER_SEPARATION_PUSH * alpha * (buffer - dist) / dist;
          node.vx += dx * push;
          node.vy += dy * push;
        }
      }
    }

    const hub = getHubNode();
    const hubX = hub ? hub.x : getCenterX();
    const hubY = hub ? hub.y : getCenterY();
    for (const [key, center] of clusterCenters) {
      const count = clusterCounts.get(key);
      const minDistFromHub = VISUAL_CONFIG.HUB_PUSH_BASE + count * VISUAL_CONFIG.HUB_PUSH_PER_NODE;
      const dx = center.x - hubX;
      const dy = center.y - hubY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < minDistFromHub) {
        const push = VISUAL_CONFIG.HUB_PUSH_STRENGTH * alpha * (minDistFromHub - dist) / dist;
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
        const minDist = r1 + r2 + VISUAL_CONFIG.CLUSTER_SEPARATION_MIN;

        if (dist < minDist) {
          const pushForce = VISUAL_CONFIG.CLUSTER_SEPARATION_PUSH_FORCE * alpha * (minDist - dist) / dist;
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

export function createSimulation(onTick, getHubNode, getCenterX, getCenterY) {
  const sim = d3.forceSimulation()
    .alphaDecay(VISUAL_CONFIG.FORCE_ALPHA_DECAY)
    .velocityDecay(VISUAL_CONFIG.FORCE_VELOCITY_DECAY)
    .force('charge', d3.forceManyBody()
      .strength(d => d.isHub ? 0 : VISUAL_CONFIG.FORCE_CHARGE_STRENGTH)
      .distanceMax(VISUAL_CONFIG.FORCE_CHARGE_DISTANCE_MAX))
    .force('collide', d3.forceCollide(d => (d.radius || VISUAL_CONFIG.MIN_RADIUS) + VISUAL_CONFIG.FORCE_COLLIDE_PADDING)
      .strength(VISUAL_CONFIG.FORCE_COLLIDE_STRENGTH)
      .iterations(VISUAL_CONFIG.FORCE_COLLIDE_ITERATIONS))
    .force('link', d3.forceLink()
      .id(d => d.id)
      .distance(d => {
        const target = getLinkTargetNode(d);
        if (target && target.inCluster) return VISUAL_CONFIG.LINK_DISTANCE_CLUSTER;
        return VISUAL_CONFIG.LINK_DISTANCE_NORMAL;
      })
      .strength(d => {
        const target = getLinkTargetNode(d);
        if (target && target.inCluster) return VISUAL_CONFIG.LINK_STRENGTH_CLUSTER;
        return VISUAL_CONFIG.LINK_STRENGTH_NORMAL;
      }))
    .force('cluster', createClusterForce(getHubNode, getCenterX, getCenterY))
    .on('tick', onTick);
  sim.stop();
  return sim;
}

export function updateLinkDistance(sim) {
  sim.force('link').distance(d => {
    const target = getLinkTargetNode(d);
    if (target && target.inCluster) return VISUAL_CONFIG.LINK_DISTANCE_CLUSTER;
    return VISUAL_CONFIG.LINK_DISTANCE_NORMAL;
  });
}
