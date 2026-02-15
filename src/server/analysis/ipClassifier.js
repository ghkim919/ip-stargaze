const KNOWN_LABELS = new Map([
  ['8.8.0.0/16', 'Google DNS'],
  ['8.8.8.0/24', 'Google DNS'],
  ['1.1.0.0/16', 'Cloudflare DNS'],
  ['1.0.0.0/16', 'Cloudflare DNS'],
  ['9.0.0.0/8', 'IBM'],
  ['13.0.0.0/8', 'Microsoft Azure'],
  ['20.0.0.0/8', 'Microsoft Azure'],
  ['34.0.0.0/8', 'Google Cloud'],
  ['35.0.0.0/8', 'Google Cloud'],
  ['52.0.0.0/8', 'Amazon AWS'],
  ['54.0.0.0/8', 'Amazon AWS'],
  ['104.0.0.0/8', 'Cloudflare / Akamai'],
  ['142.250.0.0/16', 'Google'],
  ['151.101.0.0/16', 'Fastly CDN'],
  ['172.217.0.0/16', 'Google'],
  ['185.199.0.0/16', 'GitHub'],
  ['192.30.0.0/16', 'GitHub'],
  ['198.41.0.0/16', 'Cloudflare'],
  ['199.232.0.0/16', 'Fastly CDN'],
  ['203.0.113.0/24', 'TEST-NET-3 (RFC 5737)'],
  ['198.51.100.0/24', 'TEST-NET-2 (RFC 5737)'],
  ['192.0.2.0/24', 'TEST-NET-1 (RFC 5737)'],
]);

function parseIpToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(parts[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    result = (result << 8) | octet;
  }
  return result >>> 0;
}

function intToIp(int) {
  return [
    (int >>> 24) & 0xff,
    (int >>> 16) & 0xff,
    (int >>> 8) & 0xff,
    int & 0xff,
  ].join('.');
}

function getNetworkAddress(ipInt, prefixLength) {
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipInt & mask) >>> 0;
}

function isPrivateIp(ipInt) {
  const first = (ipInt >>> 24) & 0xff;
  const second = (ipInt >>> 16) & 0xff;

  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
}

function isReservedIp(ipInt) {
  const first = (ipInt >>> 24) & 0xff;

  if (first === 0) return true;
  if (first === 127) return true;
  if (first >= 224) return true;
  if (first === 169 && ((ipInt >>> 16) & 0xff) === 254) return true;
  if (first === 192 && ((ipInt >>> 16) & 0xff) === 0 && ((ipInt >>> 8) & 0xff) === 2) return true;
  if (first === 198 && ((ipInt >>> 16) & 0xff) === 51 && ((ipInt >>> 8) & 0xff) === 100) return true;
  if (first === 203 && ((ipInt >>> 16) & 0xff) === 0 && ((ipInt >>> 8) & 0xff) === 113) return true;
  return false;
}

function findLabel(subnets) {
  for (const [level, info] of Object.entries(subnets)) {
    const label = KNOWN_LABELS.get(info.network);
    if (label) {
      info.label = label;
    }
  }
}

export function classifyIp(ip) {
  if (typeof ip !== 'string') return null;

  const ipInt = parseIpToInt(ip);
  if (ipInt === null) return null;

  const net8 = getNetworkAddress(ipInt, 8);
  const net16 = getNetworkAddress(ipInt, 16);
  const net24 = getNetworkAddress(ipInt, 24);

  const subnets = {
    '/8': { network: `${intToIp(net8)}/8`, label: null },
    '/16': { network: `${intToIp(net16)}/16`, label: null },
    '/24': { network: `${intToIp(net24)}/24`, label: null },
  };

  findLabel(subnets);

  return {
    ip,
    subnets,
    isPrivate: isPrivateIp(ipInt),
    isReserved: isReservedIp(ipInt),
  };
}

export function getSubnetKey(ip, level) {
  const ipInt = parseIpToInt(ip);
  if (ipInt === null) return null;

  const prefixLength = parseInt(level.replace('/', ''), 10);
  const netInt = getNetworkAddress(ipInt, prefixLength);
  return `${intToIp(netInt)}${level}`;
}
