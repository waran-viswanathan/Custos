export interface VerificationOutboxDb {
  verificationTask: {
    findMany(args: any): Promise<Array<{ id: string; agentId: string }>>;
    update(args: any): Promise<unknown>;
  };
}

export type EnqueueVerification = (agentId: string, taskId: string) => Promise<void>;

/** A task ID is also the BullMQ job ID. A crash after enqueue and before the
 * database update is safe to retry, including when two API replicas dispatch. */
export async function dispatchPendingVerifications(db: VerificationOutboxDb, enqueue: EnqueueVerification): Promise<void> {
  const tasks = await db.verificationTask.findMany({
    where: { dispatchedAt: null }, orderBy: { createdAt: 'asc' }, take: 100,
  });
  for (const task of tasks) {
    await enqueue(task.agentId, task.id);
    await db.verificationTask.update({ where: { id: task.id }, data: { dispatchedAt: new Date() } });
  }
}

export function startVerificationDispatcher(db: VerificationOutboxDb, enqueue: EnqueueVerification): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    try { await dispatchPendingVerifications(db, enqueue); }
    catch (error) { console.error('[verification outbox] dispatch deferred:', error instanceof Error ? error.message : String(error)); }
    if (!stopped) timer = setTimeout(() => void run(), 2_000);
  };
  void run();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
