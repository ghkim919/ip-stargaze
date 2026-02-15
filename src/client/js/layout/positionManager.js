import { VISUAL_CONFIG } from '../config.js';

export function updatePositions(groups, centerX) {
  groups.linksGroup.selectAll('.ray-link')
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  groups.linkLabelsGroup.selectAll('.link-label')
    .attr('x', d => d.source.x + (d.target.x - d.source.x) * 0.45)
    .attr('y', d => d.source.y + (d.target.y - d.source.y) * 0.45);

  groups.nodesGroup.selectAll('.ray-group')
    .attr('transform', d => {
      const scale = groups.highlight.getNodeScale(d.id);
      return `translate(${d.x},${d.y}) scale(${scale})`;
    });

  groups.labelsGroup.selectAll('.ray-label')
    .attr('x', d => {
      const offset = (d.radius || VISUAL_CONFIG.MIN_RADIUS) + 8;
      return d.x > centerX ? d.x + offset : d.x - offset;
    })
    .attr('y', d => d.y)
    .attr('text-anchor', d => d.x > centerX ? 'start' : 'end');

  groups.hubGroup.attr('transform', () => {
    const hub = groups.getHubNode();
    if (hub) return `translate(${hub.x},${hub.y})`;
    return `translate(${centerX},${groups.centerY})`;
  });
}
