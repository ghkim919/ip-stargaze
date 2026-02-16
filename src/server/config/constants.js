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
  PORT_MIN: 1,
  PORT_MAX: 65535,
  VALID_PROTOCOLS: ['TCP', 'UDP', 'ICMP'],
};

export const AGGREGATOR_DEFAULTS = {
  TOP_SUBNETS_COUNT: 5,
  MAX_SUBNETS_IN_SNAPSHOT: 30,
  SNAPSHOT_INTERVAL_MS: 1000,
  TOP_IPS_COUNT: 10,
  TOP_PORTS_COUNT: 5,
};

export const PORT_LABELS = {
  21: 'FTP',
  22: 'SSH',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  993: 'IMAPS',
  995: 'POP3S',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8080: 'HTTP-Alt',
  27017: 'MongoDB',
};
