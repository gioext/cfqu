export type QueueHandler<Env> = (
  batch: MessageBatch,
  env: Env,
  ctx: ExecutionContext,
) => void | Promise<void>;

export class Qu<Env = unknown> {
  private routes = new Map<string, QueueHandler<Env>>();

  on(name: string, handler: QueueHandler<Env>): this {
    this.routes.set(name, handler);
    return this;
  }

  queue = async (
    batch: MessageBatch,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> => {
    const handler = this.routes.get(batch.queue);

    if (!handler) {
      throw new Error(`Unknown queue: ${batch.queue}`);
    }

    await handler(batch, env, ctx);
  };
}
