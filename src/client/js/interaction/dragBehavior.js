const d3 = window.d3;

export function createDragBehavior(getSimulation) {
  return d3.drag()
    .on('start', function(event, d) {
      event.sourceEvent.stopPropagation();
      if (!event.active) getSimulation().alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', function(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', function(event, d) {
      if (!event.active) getSimulation().alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}
