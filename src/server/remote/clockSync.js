const EMA_ALPHA = 0.2;
const WARN_THRESHOLD_MS = 30_000;

export default class ClockSync {
  #smoothedOffset = null;

  get offset() {
    return this.#smoothedOffset ?? 0;
  }

  update({ localSendTime, localRecvTime, serverTimestamp }) {
    const rtt = localRecvTime - localSendTime;
    const estimatedServerNow = serverTimestamp + rtt / 2;
    const newOffset = localRecvTime - estimatedServerNow;

    if (this.#smoothedOffset === null) {
      this.#smoothedOffset = newOffset;
    } else {
      this.#smoothedOffset = EMA_ALPHA * newOffset + (1 - EMA_ALPHA) * this.#smoothedOffset;
    }

    if (Math.abs(this.#smoothedOffset) > WARN_THRESHOLD_MS) {
      console.warn(`[ClockSync] Large clock offset detected: ${this.#smoothedOffset.toFixed(0)}ms`);
    }

    return this.#smoothedOffset;
  }

  adjustTimestamp(remoteTs) {
    return remoteTs + this.offset;
  }

  reset() {
    this.#smoothedOffset = null;
  }
}
