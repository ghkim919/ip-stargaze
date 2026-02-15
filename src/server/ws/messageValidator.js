import config from '../config.js';
import { VALIDATION_RULES } from '../config/constants.js';

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
