import assert from "node:assert/strict";
import { test } from "node:test";
import { Qu } from "cfqu";

const batch = { queue: "jobs", messages: [] };
const env = { value: "binding" };
const ctx = { waitUntil() {} };

test("routes by queue name and forwards the original arguments", async () => {
  const calls = [];
  const qu = new Qu();
  assert.equal(qu.on("jobs", (...args) => { calls.push(args); }), qu);
  qu.on("other", () => { assert.fail("wrong queue"); });

  await qu.queue(batch, env, ctx);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], batch);
  assert.equal(calls[0][1], env);
  assert.equal(calls[0][2], ctx);
});

test("queue can be detached and waits for the asynchronous handler", async () => {
  const qu = new Qu();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let completed = false;
  qu.on("jobs", async () => { await pending; completed = true; });
  const { queue } = qu;
  const result = queue(batch, env, ctx);
  assert.equal(completed, false);
  release();
  await result;
  assert.equal(completed, true);
});

test("unknown queue names reject, including case differences", async () => {
  const qu = new Qu().on("Jobs", () => { assert.fail("wrong queue"); });
  await assert.rejects(qu.queue(batch, env, ctx), { message: "Unknown queue: jobs" });
});

test("registering the same queue replaces its handler", async () => {
  let called = false;
  const qu = new Qu()
    .on("jobs", () => { assert.fail("replaced handler"); })
    .on("jobs", () => { called = true; });
  await qu.queue(batch, env, ctx);
  assert.equal(called, true);
});

for (const asynchronous of [false, true]) {
  test(`propagates ${asynchronous ? "asynchronous" : "synchronous"} handler errors`, async () => {
    const error = new Error("handler failed");
    const qu = new Qu().on("jobs", asynchronous
      ? async () => { throw error; }
      : () => { throw error; });
    await assert.rejects(qu.queue(batch, env, ctx), (actual) => actual === error);
  });
}
