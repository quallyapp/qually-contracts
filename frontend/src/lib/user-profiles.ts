import { uploadJson, readJsonFromWalrus } from "./walrus";

export interface UserProfile {
  address: string;
  nickname: string;
  bio: string;
  type: "poster" | "hunter" | "both";
  skills: string[];
  avatarUrl?: string;
  website?: string;
  x?: string;
  github?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "qually_user_profiles";

function getProfilesMap(): Record<string, { blobId: string; profile: UserProfile }> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveUserProfileLocal(address: string, blobId: string, profile: UserProfile) {
  const map = getProfilesMap();
  map[address.toLowerCase()] = { blobId, profile };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getUserProfileLocal(address: string): { blobId: string; profile: UserProfile } | null {
  const map = getProfilesMap();
  return map[address.toLowerCase()] || null;
}

export async function uploadUserProfile(profile: UserProfile): Promise<string> {
  const result = await uploadJson(profile as unknown as Record<string, unknown>);
  return result.blobId;
}

export async function fetchUserProfileFromWalrus(blobId: string): Promise<UserProfile> {
  return readJsonFromWalrus<UserProfile>(blobId);
}

export async function getUserProfile(address: string): Promise<UserProfile | null> {
  const local = getUserProfileLocal(address);
  if (local) return local.profile;

  try {
    const map = getProfilesMap();
    const entry = Object.values(map).find(p => p.profile.address.toLowerCase() === address.toLowerCase());
    if (entry) return entry.profile;
  } catch {}

  return null;
}

export function getNickname(address: string): string {
  const local = getUserProfileLocal(address);
  if (local?.profile?.nickname) return local.profile.nickname;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
