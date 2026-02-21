import { getCurrentTheme } from './helpers/themeHelpers.js';

const colorCache = new Map();

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getSubnetColor(network) {
  const theme = getCurrentTheme();
  const cacheKey = `${theme}:${network}`;
  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey);
  }

  const isLight = theme === 'light';
  const hue = isLight ? 155 : 210;
  const hash = hashString(network);
  const saturation = 40 + (hash % 31);
  const lightness = isLight
    ? 35 + (hashString(network + 'lit') % 21)
    : 45 + (hashString(network + 'lit') % 26);

  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  colorCache.set(cacheKey, color);
  return color;
}

export function getSubnetGlowColor(network) {
  const base = getSubnetColor(network);
  const match = base.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return base;
  return `hsl(${match[1]}, ${Math.min(100, parseInt(match[2]) + 20)}%, ${Math.min(90, parseInt(match[3]) + 25)}%)`;
}

export function formatNumber(num) {
  if (num == null) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

export function formatPps(pps) {
  if (pps == null) return '0';
  if (pps >= 1000) return (pps / 1000).toFixed(1) + 'K';
  return pps.toFixed(1);
}

export function subnetAbbrev(network) {
  if (!network) return '';
  const parts = network.split('/');
  const ip = parts[0];
  const mask = parts[1];
  const octets = ip.split('.');

  if (mask === '8') return `${octets[0]}.*`;
  if (mask === '16') return `${octets[0]}.${octets[1]}.*`;
  return `${octets[0]}.${octets[1]}.${octets[2]}.*`;
}

export function formatBytes(bytes) {
  if (bytes == null || bytes === 0) return '0 B';
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB';
  if (bytes >= 1_000) return (bytes / 1_000).toFixed(1) + ' KB';
  return bytes + ' B';
}

export function formatPercent(value, total) {
  if (!total) return '0.0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

export function clearColorCache() {
  colorCache.clear();
}
