import { uploadJson, readJsonFromWalrus } from "./walrus";

export interface JudgeProfileDetails {
  address: string;
  x?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;
  portfolio?: string;
  motivation?: string;
  experience?: string;
  mintedAt: string;
}

const STORAGE_KEY = "qually_judge_profiles";

function getProfilesMap(): Record<string, { blobId: string; details: JudgeProfileDetails }> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveJudgeProfileLocal(address: string, blobId: string, details: JudgeProfileDetails) {
  const map = getProfilesMap();
  map[address.toLowerCase()] = { blobId, details };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getJudgeProfileLocal(address: string): { blobId: string; details: JudgeProfileDetails } | null {
  const map = getProfilesMap();
  return map[address.toLowerCase()] || null;
}

export async function uploadJudgeProfile(details: JudgeProfileDetails): Promise<string> {
  const result = await uploadJson(details as unknown as Record<string, unknown>);
  return result.blobId;
}

export async function fetchJudgeProfileFromWalrus(blobId: string): Promise<JudgeProfileDetails> {
  return readJsonFromWalrus<JudgeProfileDetails>(blobId);
}

export async function getJudgeProfile(address: string): Promise<JudgeProfileDetails | null> {
  const local = getJudgeProfileLocal(address);
  if (local) return local.details;

  try {
    const profiles = getProfilesMap();
    const entry = Object.values(profiles).find(p => p.details.address.toLowerCase() === address.toLowerCase());
    if (entry) return entry.details;
  } catch {}

  return null;
}
