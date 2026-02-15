import { VISUAL_CONFIG } from '../config.js';

const d3 = window.d3;

export function updateRipples(nodesGroup, nodesData, ppsThresholds) {
  const now = Date.now();
  const { high, mid } = ppsThresholds;

  nodesData.forEach(d => {
    if (d.isHub || !d._rippleInterval) return;
    if (now - (d._lastRipple || 0) < d._rippleInterval) return;
    const group = nodesGroup.selectAll('.ray-group').filter(n => n.id === d.id);
    if (group.empty()) return;
    if (group.selectAll('.ripple').size() >= VISUAL_CONFIG.RIPPLE_MAX_PER_NODE) return;
    d._lastRipple = now;
    const baseR = d.radius || VISUAL_CONFIG.MIN_RADIUS;
    const spread = baseR + VISUAL_CONFIG.RIPPLE_BASE_SPREAD + (d.pps >= high ? VISUAL_CONFIG.RIPPLE_HIGH_SPREAD : 0);
    group.append('circle')
      .attr('class', 'ripple')
      .attr('r', baseR)
      .attr('fill', 'none')
      .attr('stroke', d.color)
      .attr('stroke-width', d.pps >= high ? VISUAL_CONFIG.RIPPLE_STROKE_HIGH : d.pps >= mid ? VISUAL_CONFIG.RIPPLE_STROKE_MID : VISUAL_CONFIG.RIPPLE_STROKE_LOW)
      .attr('stroke-opacity', d.pps >= high ? VISUAL_CONFIG.RIPPLE_OPACITY_HIGH : VISUAL_CONFIG.RIPPLE_OPACITY_NORMAL)
      .transition()
      .duration(d.pps >= high ? VISUAL_CONFIG.RIPPLE_DURATION_HIGH : VISUAL_CONFIG.RIPPLE_DURATION_NORMAL)
      .ease(d3.easeCubicOut)
      .attr('r', spread)
      .attr('stroke-opacity', 0)
      .remove();
  });
}

export function computeRippleInterval(pps, ppsThresholds) {
  const { high, mid, low } = ppsThresholds;
  if (pps >= high) return VISUAL_CONFIG.RIPPLE_INTERVAL_HIGH;
  if (pps >= mid) return VISUAL_CONFIG.RIPPLE_INTERVAL_MID;
  if (pps >= low) return VISUAL_CONFIG.RIPPLE_INTERVAL_LOW;
  return VISUAL_CONFIG.RIPPLE_INTERVAL_NONE;
}
