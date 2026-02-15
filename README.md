# IP Stargaze

Real-time IP traffic monitoring tool that visualizes network packets as an interactive star graph.

Incoming packets are captured via `tcpdump`, classified by subnet (/8, /16, /24), and rendered as a force-directed star graph where **node size reflects traffic volume**.

## Features

- **Live Capture** - Real-time packet capture via `tcpdump` (sudo required)
- **Simulation Mode** - Built-in traffic generator with Normal / Attack / Scan scenarios
- **Force-Directed Star Graph** - D3.js physics simulation with draggable nodes
- **Real-time Dashboard** - Total packets, unique IPs, PPS, active subnets
- **Subnet Detail Panel** - Click any node to inspect subnet statistics
- **Configurable** - Time window (1m~1h), subnet level (/8, /16, /24), scenarios

## Quick Start

```bash
# Install dependencies
npm install

# Simulation mode (no root required)
npm run dev

# Live capture mode (requires sudo for tcpdump)
sudo MODE=capture INTERFACE=en0 node src/server/index.js
```

Open **http://localhost:15118** in your browser.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODE` | `simulation` | `simulation` or `capture` |
| `PORT` | `15118` | Server port |
| `INTERFACE` | `eth0` | Network interface for live capture (e.g. `en0` on macOS) |
| `EVENTS_PER_SECOND` | `10` | Simulation event rate |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Fastify, @fastify/websocket |
| Frontend | Vanilla JS (ES Modules), D3.js v7 |
| Packet Capture | tcpdump (subprocess) |
| Test | Vitest |

## Project Structure

```
src/
├── server/
│   ├── index.js              # Server entry point
│   ├── config.js             # Environment config
│   ├── capture/
│   │   ├── captureManager.js # Mode switching (simulation/capture)
│   │   ├── simulator.js      # Fake traffic generator
│   │   └── pcapCapture.js    # tcpdump-based live capture
│   ├── analysis/
│   │   ├── ipClassifier.js   # IP → subnet classification (O(1) bitwise)
│   │   └── aggregator.js     # Sliding window aggregation
│   └── ws/
│       └── wsHandler.js      # WebSocket broadcast
└── client/
    ├── index.html
    ├── css/style.css          # Dark space theme
    └── js/
        ├── app.js             # WebSocket client + orchestrator
        ├── starGraph.js       # D3 force-directed star graph
        ├── dashboard.js       # Stats cards
        ├── detailPanel.js     # Subnet detail panel
        └── utils.js           # Color mapping, formatting
```

## Testing

```bash
npm test
```

## License

MIT
