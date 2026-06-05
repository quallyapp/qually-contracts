import { useQuery } from '@tanstack/react-query';
import { QUALLY_PACKAGE_ID } from '../lib/contracts';
import type { Bounty } from '../types';

const SUI_RPC = 'https://fullnode.testnet.sui.io:443';
const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

async function suiRequest(method: string, params: any[]) {
  const resp = await fetch(SUI_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const BOUNTY_STATE_MAP: Record<number, Bounty['status']> = {
  0: 'open',
  1: 'review',
  2: 'closed',
  3: 'closed',
};

const BOUNTY_TYPE_MAP: Record<number, Bounty['type']> = {
  0: 'fixed',
  1: 'contest',
  2: 'grant',
};

function blobIdBytesToString(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

async function fetchBriefFromWalrus(blobIdBytes: number[]): Promise<{ title: string; description: string; category?: string }> {
  try {
    const blobId = blobIdBytesToString(blobIdBytes);
    if (!blobId || blobId.trim().length === 0) {
      return { title: '', description: '' };
    }
    const resp = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${encodeURIComponent(blobId)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return { title: '', description: '' };
    const text = await resp.text();
    try {
      const json = JSON.parse(text);
      return {
        title: json.title || '',
        description: json.description || '',
        category: json.category,
      };
    } catch {
      return { title: text.slice(0, 100), description: text };
    }
  } catch {
    return { title: '', description: '' };
  }
}

async function parseBountyObject(obj: any): Promise<Bounty | null> {
  try {
    const fields = obj.data?.content?.fields;
    if (!fields) return null;

    const state = Number(fields.state ?? 0);
    const bountyType = Number(fields.bounty_type ?? 0);
    const briefBlobId = fields.brief_blob_id ?? [];

    const brief = await fetchBriefFromWalrus(briefBlobId);

    return {
      id: obj.data.objectId,
      title: brief.title || `Bounty ${obj.data.objectId.slice(0, 8)}...`,
      type: BOUNTY_TYPE_MAP[bountyType] || 'fixed',
      status: BOUNTY_STATE_MAP[state] || 'open',
      prizePool: Number(fields.prize_pool ?? 0) / 1_000_000_000,
      category: brief.category || fields.category_tags?.[0] || 'Other',
      skills: [],
      submissionDeadline: new Date(Number(fields.submission_deadline ?? 0)),
      judgingDeadline: new Date(Number(fields.judging_deadline ?? 0)),
      submissionCount: Number(fields.submission_count ?? 0),
      posterAddress: fields.poster || '',
      posterReputation: 100,
      description: brief.description || '',
      splits: fields.contest_splits?.map((s: any) => Number(s)) || [100],
      createdAt: new Date(),
    };
  } catch {
    return null;
  }
}

export function useOnChainBounties() {
  return useQuery({
    queryKey: ['onChainBounties'],
    queryFn: async (): Promise<Bounty[]> => {
      try {
        // 1. Try to load cached bounty IDs from localStorage
        const cachedIds: string[] = JSON.parse(localStorage.getItem('qually_bounty_ids') || '[]');

        // 2. Try querying by type (works on some RPC providers)
        let allIds = new Set(cachedIds);
        try {
          const typePattern = `${QUALLY_PACKAGE_ID}::bounty::Bounty`;
          const objects = await suiRequest('sui_queryObjects', [
            {
              filter: { StructType: typePattern },
              options: { showContent: true, showType: true },
            },
            null,
            50,
          ]);
          for (const obj of (objects?.data ?? [])) {
            if (obj.data?.objectId) allIds.add(obj.data.objectId);
          }
        } catch {
          // Method not supported, rely on cached IDs
        }

        // 3. Also try event-based discovery (works if events were emitted)
        try {
          const events = await suiRequest('sui_queryEvents', [
            { MoveModule: { package: QUALLY_PACKAGE_ID, module: 'bounty' } },
            null,
            50,
            'descending',
          ]);
          for (const event of (events?.data ?? [])) {
            const parsed = event.parsedJson as any;
            if (parsed?.bounty_id) allIds.add(parsed.bounty_id);
          }
        } catch {
          // No events emitted
        }

        // 4. Fetch each bounty object
        const bounties: Bounty[] = [];
        for (const id of allIds) {
          try {
            const obj = await suiRequest('sui_getObject', [id, { showContent: true }]);
            if (!obj?.data?.content?.fields) {
              console.warn(`[Qually] Object ${id} has no content fields`, obj);
              continue;
            }
            const bounty = await parseBountyObject(obj);
            if (bounty) bounties.push(bounty);
          } catch (e) {
            console.warn(`[Qually] Failed to fetch bounty ${id}:`, e);
          }
        }

        console.log(`[Qually] Found ${bounties.length} bounties from ${allIds.size} IDs`, bounties.map(b => b.id.slice(0, 8)));
        return bounties.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });
}

export function useOnChainBounty(id: string | null) {
  return useQuery({
    queryKey: ['onChainBounty', id],
    queryFn: async (): Promise<Bounty | null> => {
      if (!id) return null;
      try {
        const obj = await suiRequest('sui_getObject', [
          id,
          { showContent: true },
        ]);
        return await parseBountyObject(obj);
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}
