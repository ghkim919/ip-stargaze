import { VISUAL_CONFIG } from '../config.js';
import { formatNumber } from '../utils.js';

const d3 = window.d3;

export function renderHub(hubGroup, totalPackets, currentIface, makeDrag) {
  hubGroup.selectAll('*').remove();

  hubGroup.append('circle')
    .attr('class', 'hub-outer')
    .attr('r', VISUAL_CONFIG.HUB_RADIUS + 12)
    .attr('fill', 'rgba(100, 180, 255, 0.08)')
    .attr('stroke', 'rgba(100, 180, 255, 0.15)')
    .attr('stroke-width', 1);

  hubGroup.append('circle')
    .attr('class', 'hub-circle')
    .attr('r', VISUAL_CONFIG.HUB_RADIUS)
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
