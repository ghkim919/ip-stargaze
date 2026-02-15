export function ensureGlowFilter(defs) {
  if (defs.select('#glow-filter').empty()) {
    const filter = defs.append('filter')
      .attr('id', 'glow-filter')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
  }

  if (defs.select('#hub-glow').empty()) {
    const hubGlow = defs.append('filter')
      .attr('id', 'hub-glow')
      .attr('x', '-100%').attr('y', '-100%')
      .attr('width', '300%').attr('height', '300%');
    hubGlow.append('feGaussianBlur')
      .attr('stdDeviation', '6')
      .attr('result', 'blur');
    const merge2 = hubGlow.append('feMerge');
    merge2.append('feMergeNode').attr('in', 'blur');
    merge2.append('feMergeNode').attr('in', 'SourceGraphic');
  }
}

export function ensurePulseAnimation() {
  const styleId = 'star-pulse-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      .ray-node-glow {
        animation-name: pulse-glow;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
      }
    `;
    document.head.appendChild(style);
  }
}
