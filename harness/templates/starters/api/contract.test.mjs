import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createFixtureServer } from "./server.mjs";
import { createOrders } from "./model.mjs";

test("HTTP contract: auth, shape, replay, conflict, methods and bounded input", async t => {
  const server = createFixtureServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = "http://127.0.0.1:" + server.address().port + "/api/orders";
  const post = (body, extra = {}) => fetch(url, { method: "POST", headers: { authorization: "Bearer fixture-only", "content-type": "application/json", "idempotency-key": "key-1", ...extra }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const body = { orderId: "order-1", quantity: 3 };
  assert.equal((await post(body, { authorization: "" })).status, 401);
  assert.equal((await post(body, { "idempotency-key": "" })).status, 400);
  assert.equal((await post(body, { "content-type": "text/plain" })).status, 415);
  assert.equal((await post("{")).status, 400);
  assert.equal((await post({ ...body, quantity: -1 })).status, 400);
  assert.equal((await post({ ...body, admin: true })).status, 400);
  const first = await post(body); assert.equal(first.status, 200);
  const expected = await first.json();
  assert.deepEqual(await (await post({ quantity: 3, orderId: "order-1" })).json(), expected);
  const concurrent = await Promise.all(Array.from({ length: 5 }, () => post(body).then(r => r.json())));
  concurrent.forEach(value => assert.deepEqual(value, expected));
  const firstRace = await Promise.all(Array.from({ length: 24 }, () => post(body, { "idempotency-key": "new-concurrent-key" }).then(r => r.json())));
  firstRace.forEach(value => assert.deepEqual(value, firstRace[0]));
  assert.equal(firstRace[0].revision, 2);
  assert.equal((await post({ ...body, quantity: 4 })).status, 409);
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await post(" ".repeat(16385))).status, 413);
});
test("Returned objects cannot corrupt future replay and capacity is bounded", () => {
  const write = createOrders(), input = { orderId: "x", quantity: 1 };
  const response = write("first", input); response.body.quantity = 100; input.quantity = 100;
  assert.equal(write("first", { orderId: "x", quantity: 1 }).body.quantity, 1);
  for (let n = 0; n < 999; n++) assert.equal(write("key-" + n, { orderId: "x", quantity: 1 }).status, 200);
  assert.equal(write("over", { orderId: "x", quantity: 1 }).status, 429);
});
