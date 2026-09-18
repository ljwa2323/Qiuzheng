import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { loadEnv } from '../config/env.js';

let client: S3Client | null = null;

export function resolveLocalObjectPath(root: string, key: string): string {
  const absoluteRoot = resolve(root);
  const target = resolve(absoluteRoot, key.replaceAll('\\', '/'));
  const rel = relative(absoluteRoot, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Invalid local object key');
  }
  return target;
}

function localBucketRoot(): string {
  const env = loadEnv();
  return resolve(env.LOCAL_STORAGE_PATH, env.S3_BUCKET);
}

export function s3(): S3Client {
  if (client) return client;
  const env = loadEnv();
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  });
  return client;
}

export async function ensureBucket(): Promise<void> {
  const env = loadEnv();
  if (env.STORAGE_DRIVER === 'local') {
    await mkdir(localBucketRoot(), { recursive: true });
    return;
  }
  try {
    await s3().send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    try {
      await s3().send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch {
      // bucket may already exist from race
    }
  }
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const env = loadEnv();
  if (env.STORAGE_DRIVER === 'local') {
    const target = resolveLocalObjectPath(localBucketRoot(), key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
    return;
  }
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const env = loadEnv();
  if (env.STORAGE_DRIVER === 'local') {
    return readFile(resolveLocalObjectPath(localBucketRoot(), key));
  }
  const result = await s3().send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error('Empty object body');
  return Buffer.from(bytes);
}

export async function deleteObject(key: string): Promise<void> {
  const env = loadEnv();
  if (env.STORAGE_DRIVER === 'local') {
    try {
      await unlink(resolveLocalObjectPath(localBucketRoot(), key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    return;
  }
  await s3().send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}
