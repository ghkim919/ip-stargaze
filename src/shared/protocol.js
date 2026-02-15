export const MSG = {
  SET_WINDOW: 'setWindow',
  SET_SUBNET_LEVEL: 'setSubnetLevel',
  SET_SCENARIO: 'setScenario',
  SET_EPS: 'setEventsPerSecond',
  SET_EVENTS_PER_SECOND: 'setEventsPerSecond',
  SNAPSHOT: 'snapshot',
  CONFIG: 'config',
  ERROR: 'error',
};

export const ERR = {
  INVALID_JSON: 'Invalid JSON',
  INVALID_WINDOW: 'Invalid window value',
  INVALID_SUBNET: 'Invalid subnet level',
  INVALID_SCENARIO: 'Invalid scenario',
  INVALID_EPS: (min, max) => `EPS must be between ${min} and ${max}`,
  UNKNOWN_TYPE: (type) => `Unknown message type: ${type}`,
};

export { MSG as MESSAGE_TYPES, ERR as ERROR_MESSAGES };
