import { WALRUS_PUBLISHERS, WALRUS_AGGREGATORS } from './config';

async function sha3_256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let activePublisher = WALRUS_PUBLISHERS[0];
let activeAggregator = WALRUS_AGGREGATORS[0];
let publisherTested = false;

async function testPublisher(url: string): Promise<boolean> {
  try {
    const resp = await fetch(`${url}/v1/blobs?epochs=1`, {
      method: 'PUT',
      body: new Uint8Array([0]),
      signal: AbortSignal.timeout(8000),
    });
    return resp.ok || resp.status === 400;
  } catch {
    return false;
  }
}

async function ensurePublisher(): Promise<string> {
  if (publisherTested) return activePublisher;
  for (const url of WALRUS_PUBLISHERS) {
    if (await testPublisher(url)) {
      activePublisher = url;
      activeAggregator = WALRUS_AGGREGATORS[WALRUS_PUBLISHERS.indexOf(url)] || WALRUS_AGGREGATORS[0];
      publisherTested = true;
      return activePublisher;
    }
  }
  publisherTested = true;
  return activePublisher;
}

export interface WalrusUploadResult {
  blobId: string;
  blobHash: number[];
  size: number;
}

export async function uploadToWalrus(data: Blob | ArrayBuffer | Uint8Array): Promise<WalrusUploadResult> {
  const publisher = await ensurePublisher();
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const bytes = new Uint8Array(buffer);

  const resp = await fetch(`${publisher}/v1/blobs?epochs=5`, {
    method: 'PUT',
    body: bytes,
    headers: { 'Content-Type': 'application/octet-stream' },
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Walrus upload failed: ${resp.status} ${text}`);
  }

  const result = await resp.json();
  const blobInfo = result.newlyCreated?.blobObject || result.alreadyCertified;
  if (!blobInfo?.blobId) throw new Error('Invalid Walrus response');

  const hash = await sha3_256(bytes);
  const hashBytes = Array.from(new Uint8Array(hash.match(/.{2}/g)!.map(h => parseInt(h, 16))));

  return {
    blobId: blobInfo.blobId,
    blobHash: hashBytes,
    size: bytes.length,
  };
}

export async function uploadJson(data: Record<string, unknown>): Promise<WalrusUploadResult> {
  return uploadToWalrus(new TextEncoder().encode(JSON.stringify(data)));
}

export async function uploadText(text: string): Promise<WalrusUploadResult> {
  return uploadToWalrus(new TextEncoder().encode(text));
}

export async function readFromWalrus(blobId: string): Promise<Uint8Array> {
  const resp = await fetch(`${activeAggregator}/v1/blobs/${blobId}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`Walrus read failed: ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}

export async function readJsonFromWalrus<T = Record<string, unknown>>(blobId: string): Promise<T> {
  const bytes = await readFromWalrus(blobId);
  return JSON.parse(new TextDecoder().decode(bytes));
}
