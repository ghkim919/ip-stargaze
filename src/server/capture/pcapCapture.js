import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';

export default class PcapCapture extends EventEmitter {
  #proc = null;
  #iface;
  #running = false;

  constructor({ iface = 'en0' } = {}) {
    super();
    this.#iface = iface;
  }

  start() {
    if (this.#running) return;

    const args = [
      '-i', this.#iface,
      '-n', '-l', '-q',
      '-t',
      'ip',
    ];

    console.log(`[tcpdump] Starting: tcpdump ${args.join(' ')}`);

    this.#proc = spawn('tcpdump', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.#running = true;
    let buffer = '';
    let packetCount = 0;

    this.#proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const event = this.#parseLine(line);
        if (event) {
          packetCount++;
          if (packetCount <= 3) {
            console.log(`[tcpdump] Sample packet: ${line.substring(0, 100)}`);
          }
          this.emit('packet', event);
        }
      }
    });

    this.#proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) {
        console.log('[tcpdump stderr]', msg);
      }
    });

    this.#proc.on('error', (err) => {
      console.error('tcpdump spawn failed:', err.message);
      this.#running = false;
      this.emit('error', err);
    });

    this.#proc.on('close', (code) => {
      console.log(`[tcpdump] Process exited with code ${code}`);
      this.#running = false;
      if (code && code !== 0) {
        this.emit('error', new Error(`tcpdump exited with code ${code}`));
      }
    });
  }

  #parseLine(line) {
    // tcpdump -n -q -t format examples:
    // IP 172.30.1.79.443 > 10.0.0.1.54321: tcp 120
    // IP 8.8.8.8.53 > 172.30.1.79.12345: UDP, length 64
    // IP 1.2.3.4 > 172.30.1.79: ICMP echo request, ...
    try {
      const ipMatch = line.match(/IP\s+(\d+\.\d+\.\d+\.\d+)[\.\s]/);
      if (!ipMatch) return null;

      const sourceIp = ipMatch[1];

      let protocol = 'OTHER';
      if (/tcp/i.test(line)) protocol = 'TCP';
      else if (/udp/i.test(line)) protocol = 'UDP';
      else if (/icmp/i.test(line)) protocol = 'ICMP';

      let destPort = 0;
      const portMatch = line.match(/>\s+\d+\.\d+\.\d+\.\d+\.(\d+)/);
      if (portMatch) destPort = parseInt(portMatch[1], 10);

      let bytes = 0;
      const lenMatch = line.match(/length\s+(\d+)/i);
      if (lenMatch) bytes = parseInt(lenMatch[1], 10);
      if (!bytes) {
        const tcpLen = line.match(/tcp\s+(\d+)/i);
        if (tcpLen) bytes = parseInt(tcpLen[1], 10);
      }

      return {
        sourceIp,
        destPort,
        protocol,
        timestamp: Date.now(),
        bytes: bytes || 64,
      };
    } catch {
      return null;
    }
  }

  stop() {
    if (this.#proc) {
      this.#proc.kill('SIGTERM');
      this.#proc = null;
    }
    this.#running = false;
  }

  get running() {
    return this.#running;
  }
}
