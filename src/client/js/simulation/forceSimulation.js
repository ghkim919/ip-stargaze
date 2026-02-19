import { VISUAL_CONFIG } from '../config.js';
import { getLinkTargetNode } from '../helpers/linkHelpers.js';

const d3 = window.d3;

function createClusterForce(getHubNode, getCenterX, getCenterY) {
  let nodes;

  function force(alpha) {
    const clusterCenters = new Map();
    const clusterCounts = new Map();
    const clusterRadii = new Map();

    // 1. 클러스터 중심 계산 — 드래그 중인 노드(fx != null) 제외
    for (const node of nodes) {
      if (node.isHub || !node.parentNetwork || node.fx != null) continue;
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

    // 2. 클러스터 반경 계산 — 드래그 중인 노드 제외
    for (const [key, center] of clusterCenters) {
      let maxDist = 0;
      for (const node of nodes) {
        if (node.isHub || node.parentNetwork !== key || node.fx != null) continue;
        const dist = Math.hypot(node.x - center.x, node.y - center.y) + (node.radius || VISUAL_CONFIG.MIN_RADIUS);
        if (dist > maxDist) maxDist = dist;
      }
      clusterRadii.set(key, maxDist + VISUAL_CONFIG.CLUSTER_RADIUS_PADDING);
    }

    // 3. 클러스터 내부 인력 — 드래그 중인 노드에는 힘 미적용
    for (const node of nodes) {
      if (node.isHub || !node.parentNetwork || node.fx != null) continue;
      const center = clusterCenters.get(node.parentNetwork);
      if (!center) continue;
      node.vx += (center.x - node.x) * VISUAL_CONFIG.CLUSTER_ATTRACT_STRENGTH * alpha;
      node.vy += (center.y - node.y) * VISUAL_CONFIG.CLUSTER_ATTRACT_STRENGTH * alpha;
    }

    // 3b. 클러스터 내부 pairwise 응집력 — charge 반발을 상쇄하여 뭉침
    const clusterMembers = new Map();
    for (const node of nodes) {
      if (node.isHub || !node.parentNetwork || node.fx != null) continue;
      if (!clusterMembers.has(node.parentNetwork)) {
        clusterMembers.set(node.parentNetwork, []);
      }
      clusterMembers.get(node.parentNetwork).push(node);
    }
    for (const members of clusterMembers.values()) {
      if (members.length < 2) continue;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const pull = VISUAL_CONFIG.CLUSTER_COHESION_STRENGTH * alpha / dist;
          a.vx += dx * pull;
          a.vy += dy * pull;
          b.vx -= dx * pull;
          b.vy -= dy * pull;
        }
      }
    }

    // 4. 타 클러스터와의 반발력
    for (const node of nodes) {
      if (node.isHub || node.fx != null) continue;
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

    // 5. 허브로부터 클러스터 밀어내기
    const hub = getHubNode();
    const hubX = hub ? hub.x : getCenterX();
    const hubY = hub ? hub.y : getCenterY();
    for (const [key, center] of clusterCenters) {
      const count = clusterCounts.get(key);
      const minDistFromHub = VISUAL_CONFIG.HUB_PUSH_BASE + Math.sqrt(count) * VISUAL_CONFIG.HUB_PUSH_PER_NODE;
      const dx = center.x - hubX;
      const dy = center.y - hubY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < minDistFromHub) {
        const push = VISUAL_CONFIG.HUB_PUSH_STRENGTH * alpha * (minDistFromHub - dist) / dist;
        for (const node of nodes) {
          if (node.isHub || node.parentNetwork !== key || node.fx != null) continue;
          node.vx += dx * push;
          node.vy += dy * push;
        }
      }
    }

    // 6. 클러스터 간 분리
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
            if (node.isHub || node.fx != null) continue;
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

export function clampNodesToHubDistance(nodes, hubNode, centerX, centerY) {
  const hx = hubNode?.x ?? centerX;
  const hy = hubNode?.y ?? centerY;
  const hubR = hubNode?.radius ?? VISUAL_CONFIG.HUB_RADIUS;

  const clusterCounts = new Map();
  for (const node of nodes) {
    if (node.isHub || !node.parentNetwork || !node.inCluster) continue;
    const key = node.parentNetwork;
    clusterCounts.set(key, (clusterCounts.get(key) || 0) + 1);
  }

  for (const node of nodes) {
    if (node.isHub || node.fx != null) continue;

    const nodeRadius = node.radius || VISUAL_CONFIG.MIN_RADIUS;
    let minDist;

    if (node.parentNetwork && node.inCluster) {
      const count = clusterCounts.get(node.parentNetwork) || 1;
      minDist = VISUAL_CONFIG.HUB_CLAMP_BASE + Math.sqrt(count) * VISUAL_CONFIG.HUB_CLAMP_PER_NODE + nodeRadius + hubR;
    } else {
      minDist = VISUAL_CONFIG.HUB_CLAMP_BASE + nodeRadius + hubR;
    }

    const dx = node.x - hx;
    const dy = node.y - hy;
    const dist = Math.hypot(dx, dy);

    if (dist < minDist) {
      if (dist === 0) {
        const angle = Math.random() * Math.PI * 2;
        node.x = hx + Math.cos(angle) * minDist;
        node.y = hy + Math.sin(angle) * minDist;
      } else {
        const ratio = minDist / dist;
        node.x = hx + dx * ratio;
        node.y = hy + dy * ratio;
      }
      node.vx *= VISUAL_CONFIG.HUB_CLAMP_VELOCITY_DAMPING;
      node.vy *= VISUAL_CONFIG.HUB_CLAMP_VELOCITY_DAMPING;
    }
  }
}

export function updateLinkDistance(sim) {
  sim.force('link').distance(d => {
    const target = getLinkTargetNode(d);
    if (target && target.inCluster) return VISUAL_CONFIG.LINK_DISTANCE_CLUSTER;
    return VISUAL_CONFIG.LINK_DISTANCE_NORMAL;
  });
}
