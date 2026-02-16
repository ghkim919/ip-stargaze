import { EventEmitter } from 'node:events';
import Simulator from './simulator.js';
import config from '../config.js';

export default class CaptureManager extends EventEmitter {
  #mode;
  #source = null;

  constructor(mode = 'simulation') {
    super();
    this.#mode = mode;
  }

  get mode() {
    return this.#mode;
  }

  start(options = {}) {
    if (this.#source) {
      this.stop();
    }

    if (this.#mode === 'simulation') {
      this.#source = new Simulator({
        scenario: options.scenario || 'normal',
        eventsPerSecond: options.eventsPerSecond || 10,
      });

      this.#source.on('packet', (event) => {
        this.emit('packet', event);
      });

      this.#source.start();
    } else {
      this.#startPcap(options);
    }
  }

  async #startPcap(options) {
    try {
      const { default: PcapCapture } = await import('./pcapCapture.js');
      this.#source = new PcapCapture({
        iface: config.interface,
        filter: options.filter || '',
      });

      this.#source.on('packet', (event) => {
        this.emit('packet', event);
      });

      this.#source.start();
      console.log(`Live capture started on interface: ${config.interface}`);
    } catch (err) {
      console.warn(`pcap capture failed: ${err.message}`);
      console.warn('Falling back to simulation mode.');
      this.#mode = 'simulation';
      this.start(options);
    }
  }

  stop() {
    if (this.#source) {
      this.#source.stop();
      this.#source = null;
    }
  }

  setScenario(scenario) {
    if (this.#source && typeof this.#source.setScenario === 'function') {
      this.#source.setScenario(scenario);
    }
  }

  setEventsPerSecond(eps) {
    if (this.#source && typeof this.#source.setEventsPerSecond === 'function') {
      this.#source.setEventsPerSecond(eps);
    }
  }

  get scenario() {
    return this.#source?.scenario ?? 'normal';
  }

  get eventsPerSecond() {
    return this.#source?.eventsPerSecond ?? config.eventsPerSecond;
  }

  get interface() {
    return config.interface;
  }

  setInterface(iface) {
    if (this.#mode !== 'live') {
      throw new Error('Interface change is only available in live mode');
    }
    config.interface = iface;
    this.stop();
    this.#startPcap({});
  }
}
