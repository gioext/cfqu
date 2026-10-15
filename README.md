# cfqu

A small TypeScript library that routes Cloudflare Workers queue events by queue name.

## Usage

This example sends and receives messages in a single Worker.

### 1. Set up a project

```sh
mkdir cfqu-example
cd cfqu-example
npm init -y
npm install cfqu
npm install --save-dev wrangler typescript
```

Create `wrangler.jsonc`:

```jsonc
{
  "name": "cfqu-example",
  "main": "index.ts",
  "compatibility_date": "2026-10-15",
  "queues": {
    "producers": [{ "binding": "JOB_QUEUE", "queue": "jobs" }],
    "consumers": [{ "queue": "jobs" }]
  }
}
```

### 2. Add the Worker

Create `index.ts`:

```ts
import { Qu } from "cfqu";

const qu = new Qu<Env>();

qu.on("jobs", (batch) => {
  for (const message of batch.messages) {
    console.log("Received:", message.body);
  }
});

export default {
  async fetch(request, env) {
    await env.JOB_QUEUE.send(await request.json());
    return new Response("Accepted", { status: 202 });
  },
  queue: qu.queue,
} satisfies ExportedHandler<Env>;
```

Generate `Env` and Workers runtime types from your Wrangler configuration:

```sh
npx wrangler types
```

### 3. Send and receive locally

```sh
npx wrangler dev
```

In another terminal, send a message:

```sh
curl -i http://localhost:8787 \
  -H 'Content-Type: application/json' \
  -d '{"id":"123"}'
```

The response is `202 Accepted`. After the batch is delivered, the Worker terminal logs `Received:` with the message body. Local testing does not require a deployed queue.

Queue names match exactly and are case-sensitive. Register the name in `queues.consumers[].queue`. Registering a name again replaces its handler. Unknown queues and handler failures propagate as errors.

## Deployment

To run the same Worker on Cloudflare:

```sh
npx wrangler login
npx wrangler queues create jobs
npx wrangler deploy
```

Skip queue creation if `jobs` already exists. Send the same request to the deployed Worker URL to enqueue a message.

## Development

Requires Node.js 24.

```sh
npm ci
npm run check
```
