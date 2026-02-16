import config from '../config.js';
import { VALIDATION_RULES } from '../config/constants.js';
import { networkInterfaces } from 'node:os';

export function validateWindow(value) {
  return config.validWindows.includes(value);
}

export function validateSubnetLevel(value) {
  return config.validSubnetLevels.includes(value);
}

export function validateScenario(value) {
  return config.validScenarios.includes(value);
}

export function validateEPS(value) {
  const eps = parseInt(value, 10);
  return !isNaN(eps) && eps >= VALIDATION_RULES.EPS_MIN && eps <= VALIDATION_RULES.EPS_MAX;
}

export function parseEPS(value) {
  return parseInt(value, 10);
}

export function validateFilter(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.ports !== undefined) {
    if (!Array.isArray(value.ports)) return false;
    for (const p of value.ports) {
      if (!Number.isInteger(p) || p < VALIDATION_RULES.PORT_MIN || p > VALIDATION_RULES.PORT_MAX) return false;
    }
  }
  if (value.protocols !== undefined) {
    if (!Array.isArray(value.protocols)) return false;
    for (const p of value.protocols) {
      if (!VALIDATION_RULES.VALID_PROTOCOLS.includes(p)) return false;
    }
  }
  return true;
}

export function validateInterface(value) {
  if (typeof value !== 'string' || !value) return false;
  const ifaces = networkInterfaces();
  return Object.keys(ifaces).includes(value);
}

export function getAvailableInterfaces() {
  const ifaces = networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (name === 'lo' || name === 'lo0') continue;
    const ipv4 = addrs.find(a => a.family === 'IPv4' && !a.internal);
    result.push({ name, address: ipv4 ? ipv4.address : '' });
  }
  return result;
}

export function validateSource(value) {
  return typeof value === 'string' && value.length > 0;
}

export function validateAgentAdd(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.url !== 'string' || !value.url) return false;
  if (typeof value.apiKey !== 'string') return false;
  try {
    new URL(value.url);
  } catch {
    return false;
  }
  return true;
}

export function validateAgentRemove(value) {
  if (!value || typeof value !== 'object') return false;
  return typeof value.id === 'string' && value.id.length > 0;
}

export function validateAgentEnabled(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  return typeof value.enabled === 'boolean';
}

export function validateAgentTest(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.url !== 'string' || !value.url) return false;
  try {
    new URL(value.url);
  } catch {
    return false;
  }
  return true;
}
