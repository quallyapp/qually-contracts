import { uploadJson, readJsonFromWalrus } from "./walrus";

export interface SubmissionRecord {
  id: string;
  bountyId: string;
  title: string;
  description: string;
  blobId: string;
  walrusBlobId?: string;
  submittedAt: string;
}

const STORAGE_KEY = "qually_submissions";
const WALRUS_INDEX_KEY = "qually_submissions_walrus_index";

function getLocalSubmissions(): SubmissionRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalSubmissions(subs: SubmissionRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
}

function getWalrusIndex(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(WALRUS_INDEX_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveWalrusIndex(index: Record<string, string>) {
  localStorage.setItem(WALRUS_INDEX_KEY, JSON.stringify(index));
}

export async function saveSubmission(sub: SubmissionRecord): Promise<void> {
  const local = getLocalSubmissions();
  local.push(sub);
  saveLocalSubmissions(local);

  try {
    const result = await uploadJson(sub as unknown as Record<string, unknown>);
    const index = getWalrusIndex();
    index[sub.id] = result.blobId;
    saveWalrusIndex(index);
    console.log(`[Qually] Submission metadata stored on Walrus: ${result.blobId.slice(0, 16)}...`);
  } catch (e) {
    console.warn("[Qually] Walrus upload failed, using localStorage only:", e);
  }
}

export async function getSubmissions(): Promise<SubmissionRecord[]> {
  const local = getLocalSubmissions();
  if (local.length === 0) return local;

  const index = getWalrusIndex();
  const enriched = await Promise.all(
    local.map(async (sub) => {
      if (sub.walrusBlobId) return sub;
      const walrusBlobId = index[sub.id];
      if (walrusBlobId) {
        try {
          const remote = await readJsonFromWalrus<SubmissionRecord>(walrusBlobId);
          return { ...sub, ...remote, walrusBlobId };
        } catch {}
      }
      return sub;
    })
  );

  return enriched;
}

export function getSubmissionsForBounty(bountyId: string): SubmissionRecord[] {
  return getLocalSubmissions().filter((s) => s.bountyId === bountyId);
}
