import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const library = await readFile(new URL("../dist/index.js", import.meta.url), "utf8");

for (const standalone of [true, false]) {
  test(`Workers queue event with ${standalone ? "default Qu export" : "composed export"}`, async (t) => {
    const received = [];
    const mf = new Miniflare(convertV4MiniflareOptions({
      compatibilityDate: "2026-10-12",
      modules: [
        {
          type: "ESModule",
          path: "worker.js",
          contents: `
            import { Qu } from "./qu.js";
            const qu = new Qu();
            qu.on("jobs", async (batch, env, ctx) => {
              await env.RESULT.fetch("https://result.test", {
                method: "POST",
                body: JSON.stringify({ queue: batch.queue, bodies: batch.messages.map(m => m.body), binding: env.VALUE }),
              });
              ctx.waitUntil(env.RESULT.fetch("https://result.test/wait"));
            });
            export default ${standalone ? "qu" : '{ queue: qu.queue, fetch() { return new Response("ok"); } }'};
          `,
        },
        { type: "ESModule", path: "qu.js", contents: library },
      ],
      bindings: { VALUE: "binding" },
      serviceBindings: {
        RESULT: async (request) => {
          received.push(new URL(request.url).pathname === "/wait" ? "waitUntil" : await request.json());
          return new Response("ok");
        },
      },
    }));
    t.after(() => mf.dispose());

    const worker = await mf.getWorker();
    const result = await worker.queue("jobs", [{ id: "1", timestamp: new Date(), attempts: 1, body: { id: "123" } }]);
    assert.equal(result.outcome, "ok");
    assert.deepEqual(received, [
      { queue: "jobs", bodies: [{ id: "123" }], binding: "binding" },
      "waitUntil",
    ]);

    if (!standalone) {
      const response = await mf.dispatchFetch("https://worker.test");
      assert.equal(await response.text(), "ok");
    }
  });
}
