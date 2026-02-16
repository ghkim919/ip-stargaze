import { VISUAL_CONFIG } from '../config.js';
import { getLinkTargetId } from './linkHelpers.js';
import { getCssVar } from './themeHelpers.js';

export default class HighlightManager {
  #hoveredNodeId = null;

  get hoveredNodeId() {
    return this.#hoveredNodeId;
  }

  setHighlight(id) {
    this.#hoveredNodeId = id;
  }

  clearHighlight() {
    this.#hoveredNodeId = null;
  }

  getNodeOpacity(nodeId) {
    if (!this.#hoveredNodeId) return 1;
    return nodeId === this.#hoveredNodeId ? 1 : VISUAL_CONFIG.HIGHLIGHT_DIM_OPACITY;
  }

  getLinkOpacity(link) {
    if (!this.#hoveredNodeId) return VISUAL_CONFIG.LINK_OPACITY;
    const tid = getLinkTargetId(link);
    return tid === this.#hoveredNodeId ? VISUAL_CONFIG.HIGHLIGHT_LINK_BRIGHT : VISUAL_CONFIG.HIGHLIGHT_LINK_DIM;
  }

  getLinkWidth(link, baseWidth) {
    if (!this.#hoveredNodeId) return baseWidth;
    const tid = getLinkTargetId(link);
    return tid === this.#hoveredNodeId ? (baseWidth || VISUAL_CONFIG.LINK_WIDTH_MIN) * VISUAL_CONFIG.HIGHLIGHT_LINK_SCALE : baseWidth;
  }

  getLinkLabelOpacity(link) {
    if (!this.#hoveredNodeId) return 1;
    const tid = getLinkTargetId(link);
    return tid === this.#hoveredNodeId ? 1 : 0;
  }

  getLinkLabelFontSize(link) {
    if (!this.#hoveredNodeId) return '9px';
    const tid = getLinkTargetId(link);
    return tid === this.#hoveredNodeId ? VISUAL_CONFIG.HIGHLIGHT_FONT_SIZE : '9px';
  }

  getLinkLabelFontWeight(link) {
    if (!this.#hoveredNodeId) return '400';
    const tid = getLinkTargetId(link);
    return tid === this.#hoveredNodeId ? VISUAL_CONFIG.HIGHLIGHT_FONT_WEIGHT : '400';
  }

  getLinkLabelFill(link) {
    if (!this.#hoveredNodeId) return getCssVar('--text-secondary');
    const tid = getLinkTargetId(link);
    return tid === this.#hoveredNodeId ? getCssVar('--text-primary') : getCssVar('--text-secondary');
  }

  getLabelOpacity(nodeId) {
    if (!this.#hoveredNodeId) return 1;
    return nodeId === this.#hoveredNodeId ? 1 : VISUAL_CONFIG.HIGHLIGHT_LABEL_DIM;
  }

  getLabelFontSize(nodeId) {
    return this.#hoveredNodeId && nodeId === this.#hoveredNodeId ? VISUAL_CONFIG.HIGHLIGHT_FONT_SIZE : VISUAL_CONFIG.LABEL_FONT_SIZE + 'px';
  }

  getLabelFontWeight(nodeId) {
    return this.#hoveredNodeId && nodeId === this.#hoveredNodeId ? VISUAL_CONFIG.HIGHLIGHT_FONT_WEIGHT : '400';
  }

  getNodeScale(nodeId) {
    return this.#hoveredNodeId === nodeId ? VISUAL_CONFIG.HIGHLIGHT_SCALE : 1;
  }

  getHubOpacity() {
    return this.#hoveredNodeId ? VISUAL_CONFIG.HIGHLIGHT_HUB_DIM : 1;
  }

  getClusterOpacity() {
    return this.#hoveredNodeId ? VISUAL_CONFIG.HIGHLIGHT_CLUSTER_DIM : 1;
  }
}
