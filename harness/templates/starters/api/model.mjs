// Fixture reference only: no durable storage, real identity, expiry or multi-process locking.
export function createOrders() {
  const receipts = new Map(), orders = new Map();
  return function write(key, body) {
    if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(key)) return { status: 400, body: { error: "invalid_idempotency_key" } };
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(k => !["orderId", "quantity"].includes(k)) ||
        typeof body.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(body.orderId) ||
        !Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 1000000)
      return { status: 400, body: { error: "invalid_order" } };
    const normalized = { orderId: body.orderId, quantity: body.quantity };
    const fingerprint = JSON.stringify(normalized);
    const previous = receipts.get(key);
    if (previous) return structuredClone(previous.fingerprint === fingerprint ? previous.response : { status: 409, body: { error: "idempotency_conflict" } });
    if (receipts.size >= 1000) return { status: 429, body: { error: "fixture_capacity" } };
    orders.set(body.orderId, normalized);
    const response = { status: 200, body: { ...normalized, revision: receipts.size + 1 } };
    receipts.set(key, { fingerprint, response });
    return structuredClone(response);
  };
}
