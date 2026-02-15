import { describe, it, expect } from 'vitest';
import { classifyIp, getSubnetKey } from '../src/server/analysis/ipClassifier.js';

describe('classifyIp', () => {
  it('classifies a private 10.x.x.x address correctly', () => {
    const result = classifyIp('10.0.1.5');
    expect(result).not.toBeNull();
    expect(result.ip).toBe('10.0.1.5');
    expect(result.subnets['/8'].network).toBe('10.0.0.0/8');
    expect(result.subnets['/16'].network).toBe('10.0.0.0/16');
    expect(result.subnets['/24'].network).toBe('10.0.1.0/24');
    expect(result.isPrivate).toBe(true);
  });

  it('classifies a private 192.168.x.x address correctly', () => {
    const result = classifyIp('192.168.1.100');
    expect(result).not.toBeNull();
    expect(result.subnets['/8'].network).toBe('192.0.0.0/8');
    expect(result.subnets['/16'].network).toBe('192.168.0.0/16');
    expect(result.subnets['/24'].network).toBe('192.168.1.0/24');
    expect(result.isPrivate).toBe(true);
  });

  it('classifies a private 172.16-31.x.x address correctly', () => {
    const result = classifyIp('172.16.5.10');
    expect(result.isPrivate).toBe(true);

    const result2 = classifyIp('172.31.255.1');
    expect(result2.isPrivate).toBe(true);

    const result3 = classifyIp('172.15.0.1');
    expect(result3.isPrivate).toBe(false);

    const result4 = classifyIp('172.32.0.1');
    expect(result4.isPrivate).toBe(false);
  });

  it('classifies Google DNS correctly', () => {
    const result = classifyIp('8.8.8.8');
    expect(result.subnets['/16'].network).toBe('8.8.0.0/16');
    expect(result.subnets['/16'].label).toBe('Google DNS');
    expect(result.isPrivate).toBe(false);
  });

  it('classifies Cloudflare DNS correctly', () => {
    const result = classifyIp('1.1.1.1');
    expect(result.subnets['/16'].label).toBe('Cloudflare DNS');
    expect(result.isPrivate).toBe(false);
  });

  it('returns null for invalid IP addresses', () => {
    expect(classifyIp('999.999.999.999')).toBeNull();
    expect(classifyIp('256.0.0.1')).toBeNull();
    expect(classifyIp('abc.def.ghi.jkl')).toBeNull();
    expect(classifyIp('1.2.3')).toBeNull();
    expect(classifyIp('')).toBeNull();
    expect(classifyIp(null)).toBeNull();
    expect(classifyIp(undefined)).toBeNull();
    expect(classifyIp(12345)).toBeNull();
  });

  it('identifies reserved IP ranges', () => {
    expect(classifyIp('0.0.0.0').isReserved).toBe(true);
    expect(classifyIp('127.0.0.1').isReserved).toBe(true);
    expect(classifyIp('224.0.0.1').isReserved).toBe(true);
    expect(classifyIp('255.255.255.255').isReserved).toBe(true);
    expect(classifyIp('169.254.1.1').isReserved).toBe(true);
  });

  it('classifies public IP correctly', () => {
    const result = classifyIp('203.0.113.45');
    expect(result.subnets['/8'].network).toBe('203.0.0.0/8');
    expect(result.subnets['/16'].network).toBe('203.0.0.0/16');
    expect(result.subnets['/24'].network).toBe('203.0.113.0/24');
    expect(result.subnets['/24'].label).toBe('TEST-NET-3 (RFC 5737)');
    expect(result.isPrivate).toBe(false);
  });

  it('processes 10,000 IPs within 100ms', () => {
    const ips = Array.from({ length: 10000 }, (_, i) => {
      const a = (i >>> 24) & 0xff || 1;
      const b = (i >>> 16) & 0xff;
      const c = (i >>> 8) & 0xff;
      const d = i & 0xff;
      return `${a}.${b}.${c}.${d}`;
    });

    const start = performance.now();
    for (const ip of ips) {
      classifyIp(ip);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});

describe('getSubnetKey', () => {
  it('returns correct subnet key for /8', () => {
    expect(getSubnetKey('192.168.1.100', '/8')).toBe('192.0.0.0/8');
  });

  it('returns correct subnet key for /16', () => {
    expect(getSubnetKey('192.168.1.100', '/16')).toBe('192.168.0.0/16');
  });

  it('returns correct subnet key for /24', () => {
    expect(getSubnetKey('192.168.1.100', '/24')).toBe('192.168.1.0/24');
  });

  it('returns null for invalid IP', () => {
    expect(getSubnetKey('invalid', '/8')).toBeNull();
  });
});
