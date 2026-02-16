const colorCache = new Map();

const PRIVATE_RANGES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
  '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.'];

const KNOWN_SERVICES = ['8.8.', '8.34.', '1.1.', '1.0.', '13.', '52.', '54.',
  '35.', '34.', '104.', '108.', '172.64.', '173.245.', '198.41.'];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isPrivateNetwork(network) {
  return PRIVATE_RANGES.some(prefix => network.startsWith(prefix));
}

function isKnownService(network) {
  return KNOWN_SERVICES.some(prefix => network.startsWith(prefix));
}

export function getSubnetColor(network) {
  if (colorCache.has(network)) {
    return colorCache.get(network);
  }

  let hue;
  let saturation = 70;
  let lightness = 60;

  if (isPrivateNetwork(network)) {
    hue = 200 + (hashString(network) % 40);
    saturation = 75;
    lightness = 55;
  } else if (isKnownService(network)) {
    hue = 120 + (hashString(network) % 40);
    saturation = 65;
    lightness = 55;
  } else {
    hue = hashString(network) % 360;
    saturation = 60 + (hashString(network + 'sat') % 20);
    lightness = 50 + (hashString(network + 'lit') % 15);
  }

  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  colorCache.set(network, color);
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
