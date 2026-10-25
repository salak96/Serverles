import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface StorageAdapter {
  readonly name: string;
  isConfigured(): boolean;
  /** Upload a local file or stream. Returns the storage key. */
  putObject(key: string, source: { path: string } | { stream: Readable; size?: number }): Promise<{ key: string; size: number }>;
  /** Stream the object back. */
  getObjectStream(key: string): Promise<{ stream: Readable; size: number }>;
  deleteObject(key: string): Promise<void>;
  /** Generate a short-lived signed URL (S3-compatible). */
  signedUrl?(key: string, ttlSeconds: number): Promise<string>;
}

class LocalStorage implements StorageAdapter {
  readonly name = 'local';
  private root: string;
  constructor() { this.root = resolve(env.STORAGE.LOCAL_DIR); }
  isConfigured() { return true; }
  private fullPath(key: string): string {
    const safe = key.replace(/[\\]/g, '/').replace(/\.\.+/g, '').replace(/^\/+/, '');
    return join(this.root, safe);
  }
  async putObject(key: string, source: { path: string } | { stream: Readable; size?: number }): Promise<{ key: string; size: number }> {
    const full = this.fullPath(key);
    await mkdir(dirname(full), { recursive: true });
    let size = 0;
    if ('path' in source) {
      await rename(source.path, full).catch(async () => {
        // cross-device: copy
        await pipeline(createReadStream(source.path), createWriteStream(full));
      });
      const s = await stat(full);
      size = s.size;
    } else {
      await pipeline(source.stream, createWriteStream(full));
      const s = await stat(full);
      size = s.size;
    }
    return { key, size };
  }
  async getObjectStream(key: string): Promise<{ stream: Readable; size: number }> {
    const full = this.fullPath(key);
    const s = await stat(full);
    return { stream: createReadStream(full), size: s.size };
  }
  async deleteObject(key: string): Promise<void> {
    await unlink(this.fullPath(key)).catch(() => undefined);
  }
}

class S3Storage implements StorageAdapter {
  readonly name = 's3';
  isConfigured() {
    return Boolean(env.STORAGE.ACCESS_KEY && env.STORAGE.SECRET_KEY && env.STORAGE.BUCKET);
  }
  async putObject(): Promise<{ key: string; size: number }> {
    throw new Error('S3 adapter not implemented. Install @aws-sdk/client-s3 and implement here.');
  }
  async getObjectStream(): Promise<{ stream: Readable; size: number }> {
    throw new Error('S3 adapter not implemented.');
  }
  async deleteObject(): Promise<void> {
    throw new Error('S3 adapter not implemented.');
  }
}

let cached: StorageAdapter | null = null;
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  if (env.STORAGE.PROVIDER === 's3') cached = new S3Storage();
  else cached = new LocalStorage();
  logger.info({ provider: cached.name, configured: cached.isConfigured() }, 'storage_adapter_selected');
  return cached;
}
