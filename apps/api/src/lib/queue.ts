import { Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';

let connection: Redis | null = null;
const queues = new Map<string, Queue>();

export function redisConnection(): Redis {
  if (connection) return connection;
  connection = new Redis(loadEnv().REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

export function bullConnection(): ConnectionOptions {
  return redisConnection() as unknown as ConnectionOptions;
}

export const QUEUE_IMPORT = 'import-parse';
export const QUEUE_SCREEN = 'screening-ai';
export const QUEUE_EXTRACT = 'extraction-ai';

export function createQueue(name: string): Queue {
  const existing = queues.get(name);
  if (existing) return existing;
  const queue = new Queue(name, { connection: bullConnection() });
  queues.set(name, queue);
  return queue;
}

export function defaultJobOptions(): JobsOptions {
  return {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  };
}

export function createWorker(
  name: string,
  processor: (data: Record<string, unknown>) => Promise<unknown>,
): Worker {
  return new Worker(
    name,
    async (job) => processor(job.data as Record<string, unknown>),
    { connection: bullConnection() },
  );
}

export async function pingRedis(): Promise<boolean> {
  const pong = await redisConnection().ping();
  return pong === 'PONG';
}
