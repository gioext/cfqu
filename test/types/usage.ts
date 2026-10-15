import { Hono } from "hono";
import { Qu, type QueueHandler } from "cfqu";

interface Env {
  JOB_QUEUE: Queue;
  JOB_WORKFLOW: Workflow;
}

const standalone = new Qu<Env>();
standalone.on("collect", async (batch, env, ctx) => {
  for (const message of batch.messages) {
    await env.JOB_WORKFLOW.create({ params: message.body });
  }
  ctx.waitUntil(Promise.resolve());
});
standalone satisfies ExportedHandler<Env>;

const hono = new Hono<{ Bindings: Env }>();
const qu = new Qu<Env>();
hono.post("/jobs", async (c) => {
  await c.env.JOB_QUEUE.send({ id: "123" });
  return c.json({ accepted: true }, 202);
});
qu.on("jobs", async (batch, env) => {
  for (const message of batch.messages) {
    await env.JOB_WORKFLOW.create({ params: message.body });
  }
});

export default {
  fetch: hono.fetch,
  queue: qu.queue,
} satisfies ExportedHandler<Env>;

const handler: QueueHandler<Env> = (_batch, env) => {
  // @ts-expect-error Unknown bindings must not be accepted.
  env.MISSING_BINDING;
};
qu.on("typed", handler);

new Qu().on("unknown", (_batch, env) => {
  // @ts-expect-error The default Env is unknown.
  env.JOB_QUEUE;
});
