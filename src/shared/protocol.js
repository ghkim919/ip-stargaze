export const MSG = {
  SET_WINDOW: 'setWindow',
  SET_SUBNET_LEVEL: 'setSubnetLevel',
  SET_SCENARIO: 'setScenario',
  SET_EVENTS_PER_SECOND: 'setEventsPerSecond',
  SET_FILTER: 'setFilter',
  SET_INTERFACE: 'setInterface',
  GET_INTERFACES: 'getInterfaces',
  INTERFACES: 'interfaces',
  SNAPSHOT: 'snapshot',
  GET_SUBNET_DETAIL: 'getSubnetDetail',
  SUBNET_DETAIL: 'subnetDetail',
  CONFIG: 'config',
  ERROR: 'error',

  SET_SOURCE: 'setSource',
  SET_MAX_NODES: 'setMaxNodes',

  ADD_AGENT: 'addAgent',
  REMOVE_AGENT: 'removeAgent',
  SET_AGENT_ENABLED: 'setAgentEnabled',
  TEST_AGENT: 'testAgent',
  GET_AGENTS: 'getAgents',
  AGENTS: 'agents',
  TEST_AGENT_RESULT: 'testAgentResult',
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
