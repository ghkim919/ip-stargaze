import { VISUAL_CONFIG } from '../config.js';
import { formatNumber } from '../utils.js';
import { getCssVar } from '../helpers/themeHelpers.js';

const d3 = window.d3;

export function renderHub(hubGroup, totalPackets, currentIface, makeDrag) {
  hubGroup.selectAll('*').remove();

  hubGroup.append('circle')
    .attr('class', 'hub-outer')
    .attr('r', VISUAL_CONFIG.HUB_RADIUS + 12)
    .attr('fill', getCssVar('--hub-outer-fill'))
    .attr('stroke', getCssVar('--hub-outer-stroke'))
    .attr('stroke-width', 1);

  hubGroup.append('circle')
    .attr('class', 'hub-circle')
    .attr('r', VISUAL_CONFIG.HUB_RADIUS)
    .attr('fill', getCssVar('--hub-fill'))
    .attr('stroke', getCssVar('--accent'))
    .attr('stroke-width', 2)
    .attr('filter', 'url(#hub-glow)');

  hubGroup.append('text')
    .attr('class', 'hub-text')
    .attr('y', -6)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', getCssVar('--text-accent'))
    .attr('font-size', '12px')
    .attr('font-weight', 'bold')
    .text(currentIface || 'SERVER');

  hubGroup.append('text')
    .attr('class', 'hub-subtext')
    .attr('y', 10)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', getCssVar('--accent'))
    .attr('font-size', '9px')
    .text(formatNumber(totalPackets) + ' pkts');

  hubGroup.call(makeDrag());
}
