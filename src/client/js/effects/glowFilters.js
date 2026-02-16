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

  if (defs.select('#alert-glow').empty()) {
    const alertGlow = defs.append('filter')
      .attr('id', 'alert-glow')
      .attr('x', '-80%').attr('y', '-80%')
      .attr('width', '260%').attr('height', '260%');
    alertGlow.append('feGaussianBlur')
      .attr('stdDeviation', '5')
      .attr('result', 'blur');
    alertGlow.append('feColorMatrix')
      .attr('in', 'blur')
      .attr('type', 'matrix')
      .attr('values', '1 0 0 0 0  0 0.3 0 0 0  0 0 0.5 0 0  0 0 0 1 0')
      .attr('result', 'tintedBlur');
    const merge3 = alertGlow.append('feMerge');
    merge3.append('feMergeNode').attr('in', 'tintedBlur');
    merge3.append('feMergeNode').attr('in', 'SourceGraphic');
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
      @keyframes heartbeat {
        0%   { transform: scale(1);    }
        15%  { transform: scale(1.15); }
        30%  { transform: scale(0.97); }
        45%  { transform: scale(1.08); }
        60%  { transform: scale(1);    }
        100% { transform: scale(1);    }
      }
      @keyframes heartbeat-glow {
        0%   { opacity: 0.5; }
        15%  { opacity: 0.9; }
        30%  { opacity: 0.4; }
        45%  { opacity: 0.75; }
        60%  { opacity: 0.5; }
        100% { opacity: 0.5; }
      }
      .ray-node-heartbeat {
        animation-name: heartbeat;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        transform-origin: center;
        transform-box: fill-box;
      }
      .ray-glow-heartbeat {
        animation-name: heartbeat-glow;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
      }
    `;
    document.head.appendChild(style);
  }
}
