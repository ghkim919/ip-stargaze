FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential libpcap-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY agent.config.json.example ./

EXPOSE 15118 15119
