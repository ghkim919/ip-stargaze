import { VISUAL_CONFIG } from '../config.js';
import { formatNumber } from '../utils.js';
import { getCssVar } from '../helpers/themeHelpers.js';

export function renderLinks(linksGroup, linksData, highlight) {
  const links = linksGroup.selectAll('.ray-link')
    .data(linksData, d => d.target);

  links.exit()
    .transition().duration(VISUAL_CONFIG.TRANSITION_DURATION)
    .attr('stroke-opacity', 0)
    .remove();

  const linksEnter = links.enter()
    .append('line')
    .attr('class', 'ray-link')
    .attr('stroke-opacity', 0);

  links.merge(linksEnter)
    .attr('stroke', d => d.color)
    .attr('stroke-width', d => highlight.getLinkWidth(d, d.linkWidth))
    .transition().duration(VISUAL_CONFIG.TRANSITION_DURATION)
    .attr('stroke-opacity', d => highlight.getLinkOpacity(d));
}

export function renderLinkLabels(linkLabelsGroup, linksData, highlight) {
  const ll = linkLabelsGroup.selectAll('.link-label')
    .data(linksData, d => d.target);

  ll.exit().remove();

  const llEnter = ll.enter()
    .append('text')
    .attr('class', 'link-label')
    .attr('font-size', VISUAL_CONFIG.LINK_LABEL_FONT_SIZE + 'px')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', getCssVar('--text-secondary'))
    .attr('pointer-events', 'none');

  ll.merge(llEnter)
    .text(d => formatNumber(d.count))
    .attr('font-size', d => highlight.getLinkLabelFontSize(d))
    .attr('font-weight', d => highlight.getLinkLabelFontWeight(d))
    .attr('fill', d => highlight.getLinkLabelFill(d))
    .attr('opacity', d => highlight.getLinkLabelOpacity(d));
}

export function renderWaitingMessage(container, show, centerX, centerY) {
  let msg = container.selectAll('.waiting-msg').data(show ? [1] : []);

  msg.exit().transition().duration(200).attr('opacity', 0).remove();

  msg.enter()
    .append('text')
    .attr('class', 'waiting-msg')
    .attr('x', centerX)
    .attr('y', centerY + 80)
    .attr('text-anchor', 'middle')
    .attr('fill', getCssVar('--text-muted'))
    .attr('font-size', '14px')
    .attr('opacity', 0)
    .text('Waiting for traffic...')
    .transition().duration(500)
    .attr('opacity', 1);
}
