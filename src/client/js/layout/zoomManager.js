import { VISUAL_CONFIG } from '../config.js';

const d3 = window.d3;

export function createZoomBehavior(svg, container) {
  const zoomBehavior = d3.zoom()
    .scaleExtent([VISUAL_CONFIG.ZOOM_MIN, VISUAL_CONFIG.ZOOM_MAX])
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
    });

  svg.call(zoomBehavior);
  return zoomBehavior;
}
