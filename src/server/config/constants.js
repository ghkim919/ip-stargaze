export const WINDOW_DURATIONS_MS = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
};

export const SUBNET_PARENT_MAP = {
  '/24': '/16',
  '/16': '/8',
};

export const VALIDATION_RULES = {
  EPS_MIN: 1,
  EPS_MAX: 1000,
};

export const AGGREGATOR_DEFAULTS = {
  TOP_SUBNETS_COUNT: 5,
  MAX_SUBNETS_IN_SNAPSHOT: 30,
  SNAPSHOT_INTERVAL_MS: 1000,
};
