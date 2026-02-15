export function getLinkTargetId(link) {
  return typeof link.target === 'object' ? link.target.id : link.target;
}

export function getLinkTargetNode(link) {
  return typeof link.target === 'object' ? link.target : null;
}
