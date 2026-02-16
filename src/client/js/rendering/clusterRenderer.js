import { VISUAL_CONFIG } from '../config.js';

const d3 = window.d3;

function computePaddedHull(nodes, padding) {
  if (nodes.length < 2) return null;

  const points = [];
  for (const node of nodes) {
    const r = (node.radius || VISUAL_CONFIG.MIN_RADIUS) + padding;
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

export function renderClusters(clustersGroup, nodesData) {
  if (!VISUAL_CONFIG.CLUSTER_HULL_VISIBLE) {
    clustersGroup.selectAll('.cluster-bg').remove();
    return;
  }

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
      const hull = computePaddedHull(clusterNodes, VISUAL_CONFIG.CLUSTER_HULL_PADDING);
      const cx = d3.mean(clusterNodes, d => d.x);
      const cy = d3.mean(clusterNodes, d => d.y);
      const color = clusterNodes[0].color;
      return { name, hull, cx, cy, color, count: clusterNodes.length };
    })
    .filter(c => c.count >= VISUAL_CONFIG.CLUSTER_MIN_NODES && c.hull);

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
    .attr('font-size', `${VISUAL_CONFIG.CLUSTER_LABEL_FONT_SIZE}px`)
    .attr('font-weight', '600')
    .text(d => d.name);
}
