// Per-provider rate limiter: at most `concurrency` requests at once, and at least
// `minIntervalMs` between the starts of two requests. Clock and sleep are injectable for tests.
class Limiter {
  constructor({ minIntervalMs = 0, concurrency = 1, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    this.minIntervalMs = minIntervalMs;
    this.concurrency = concurrency;
    this.now = now;
    this.sleep = sleep;
    this.active = 0;
    this.queue = [];
    this.nextAt = 0;
    this.waiting = false;
  }

  /** Runs fn when the limits allow it. */
  async schedule(fn) {
    await new Promise((resolve) => {
      this.queue.push(resolve);
      this.#pump();
    });
    try {
      return await fn();
    } finally {
      this.active -= 1;
      this.#pump();
    }
  }

  get pending() {
    return this.queue.length;
  }

  #pump() {
    if (this.waiting || this.active >= this.concurrency || !this.queue.length) return;
    const wait = this.nextAt - this.now();
    if (wait > 0) {
      this.waiting = true;
      this.sleep(wait).then(() => {
        this.waiting = false;
        this.#pump();
      });
      return;
    }
    this.active += 1;
    this.nextAt = this.now() + this.minIntervalMs;
    this.queue.shift()();
    this.#pump();
  }
}

module.exports = { Limiter };
