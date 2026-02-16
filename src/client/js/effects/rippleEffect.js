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
    const isHigh = d.pps >= high;

    if (isHigh) {
      const spread = baseR + VISUAL_CONFIG.WAVE_MAX_SPREAD;
      for (let i = 0; i < VISUAL_CONFIG.WAVE_COUNT; i++) {
        const delay = i * VISUAL_CONFIG.WAVE_INTERVAL;
        const opacity = VISUAL_CONFIG.WAVE_INITIAL_OPACITY * (1 - i * 0.15);
        group.append('circle')
          .attr('class', 'ripple')
          .attr('r', baseR)
          .attr('fill', 'none')
          .attr('stroke', VISUAL_CONFIG.ALERT_COLOR)
          .attr('stroke-width', VISUAL_CONFIG.WAVE_STROKE_WIDTH)
          .attr('stroke-opacity', 0)
          .transition()
          .delay(delay)
          .duration(0)
          .attr('stroke-opacity', opacity)
          .transition()
          .duration(VISUAL_CONFIG.WAVE_DURATION)
          .ease(d3.easeCubicOut)
          .attr('r', spread)
          .attr('stroke-opacity', 0)
          .remove();
      }
    } else {
      const spread = baseR + VISUAL_CONFIG.RIPPLE_BASE_SPREAD;
      group.append('circle')
        .attr('class', 'ripple')
        .attr('r', baseR)
        .attr('fill', 'none')
        .attr('stroke', d.color)
        .attr('stroke-width', d.pps >= mid ? VISUAL_CONFIG.RIPPLE_STROKE_MID : VISUAL_CONFIG.RIPPLE_STROKE_LOW)
        .attr('stroke-opacity', VISUAL_CONFIG.RIPPLE_OPACITY_NORMAL)
        .transition()
        .duration(VISUAL_CONFIG.RIPPLE_DURATION_NORMAL)
        .ease(d3.easeCubicOut)
        .attr('r', spread)
        .attr('stroke-opacity', 0)
        .remove();
    }
  });
}

export function computeRippleInterval(pps, ppsThresholds) {
  if (!VISUAL_CONFIG.RIPPLE_ENABLED) return 0;
  const { high, mid, low } = ppsThresholds;
  if (pps >= high) return VISUAL_CONFIG.RIPPLE_INTERVAL_HIGH;
  if (pps >= mid) return VISUAL_CONFIG.RIPPLE_INTERVAL_MID;
  if (pps >= low) return VISUAL_CONFIG.RIPPLE_INTERVAL_LOW;
  return VISUAL_CONFIG.RIPPLE_INTERVAL_NONE;
}
