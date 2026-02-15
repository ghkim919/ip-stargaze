import { VISUAL_CONFIG } from '../config.js';
import { subnetAbbrev } from '../utils.js';

export function renderNodeLabels(labelsGroup, subnetNodes, highlight) {
  const labels = labelsGroup.selectAll('.ray-label')
    .data(subnetNodes, d => d.id);

  labels.exit()
    .transition().duration(VISUAL_CONFIG.TRANSITION_DURATION)
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
    .attr('font-size', d => highlight.getLabelFontSize(d.id))
    .attr('font-weight', d => highlight.getLabelFontWeight(d.id))
    .transition().duration(VISUAL_CONFIG.TRANSITION_DURATION)
    .attr('opacity', d => highlight.getLabelOpacity(d.id));
}
