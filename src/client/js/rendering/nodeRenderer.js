import { VISUAL_CONFIG } from '../config.js';

export function renderNodes(nodesGroup, subnetNodes, highlight, makeDrag, ppsToAnimDuration, ppsThresholds, { showTooltip, hideTooltip, onNodeClick }) {
  const groups = nodesGroup.selectAll('.ray-group')
    .data(subnetNodes, d => d.id);

  groups.exit()
    .transition().duration(VISUAL_CONFIG.TRANSITION_DURATION)
    .attr('opacity', 0)
    .remove();

  const enter = groups.enter()
    .append('g')
    .attr('class', 'ray-group')
    .attr('opacity', 0)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) { showTooltip(event, d); })
    .on('mousemove', function(event, d) { showTooltip(event, d); })
    .on('mouseleave', hideTooltip)
    .on('click', function(event, d) { onNodeClick(event, d); });

  enter.append('circle')
    .attr('class', 'ray-node-glow')
    .attr('r', 0);

  enter.append('circle')
    .attr('class', 'ray-node')
    .attr('r', 0);

  const merged = enter.merge(groups);
  merged.call(makeDrag());

  merged.transition().duration(VISUAL_CONFIG.TRANSITION_DURATION)
    .attr('opacity', d => highlight.getNodeOpacity(d.id));

  const { high, mid, low } = ppsThresholds;

  merged.select('.ray-node-glow')
    .style('animation-duration', d => ppsToAnimDuration(d.pps) + 's')
    .transition().duration(VISUAL_CONFIG.TRANSITION_DURATION)
    .attr('r', d => d.radius + (d.pps >= high ? VISUAL_CONFIG.GLOW_RADIUS_HIGH : d.pps >= mid ? VISUAL_CONFIG.GLOW_RADIUS_MID : VISUAL_CONFIG.GLOW_RADIUS_LOW))
    .attr('fill', d => d.glowColor)
    .attr('opacity', d => {
      if (d.pps >= high) return VISUAL_CONFIG.GLOW_OPACITY_HIGH;
      if (d.pps >= mid) return VISUAL_CONFIG.GLOW_OPACITY_MID;
      if (d.pps >= low) return VISUAL_CONFIG.GLOW_OPACITY_LOW;
      return VISUAL_CONFIG.GLOW_OPACITY_NONE;
    })
    .attr('filter', 'url(#glow-filter)');

  merged.select('.ray-node')
    .transition().duration(VISUAL_CONFIG.TRANSITION_DURATION)
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .attr('stroke', d => d.glowColor)
    .attr('stroke-width', 1.5);

  return { enter, groups };
}
