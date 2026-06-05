import { readJsonFromWalrus } from "./walrus";
import { getJudgeProfileLocal, type JudgeProfileDetails } from "./judge-profiles";

const APPS_KEY = "qually_judge_applications";

export interface JudgeApplication {
  applicationId: string;
  bountyId: string;
  judgeAddress: string;
  profileId: string;
  stakeAmount: number;
  applicationBlobId: string;
  state: "pending" | "approved" | "rejected";
  createdAt: string;
}

function getAppsMap(): Record<string, JudgeApplication[]> {
  try {
    return JSON.parse(localStorage.getItem(APPS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveJudgeApplication(app: JudgeApplication) {
  const map = getAppsMap();
  const key = app.bountyId.toLowerCase();
  if (!map[key]) map[key] = [];
  const existing = map[key].findIndex(a => a.applicationId === app.applicationId);
  if (existing >= 0) {
    map[key][existing] = app;
  } else {
    map[key].push(app);
  }
  localStorage.setItem(APPS_KEY, JSON.stringify(map));
}

export function getApplicationsForBounty(bountyId: string): JudgeApplication[] {
  const map = getAppsMap();
  return map[bountyId.toLowerCase()] || [];
}

export function getApplicationsByJudge(judgeAddress: string): JudgeApplication[] {
  const map = getAppsMap();
  const all = Object.values(map).flat();
  return all.filter(a => a.judgeAddress.toLowerCase() === judgeAddress.toLowerCase());
}

export async function getJudgeDetailsForApplication(app: JudgeApplication): Promise<JudgeProfileDetails | null> {
  const local = getJudgeProfileLocal(app.judgeAddress);
  if (local) return local.details;

  if (app.applicationBlobId) {
    try {
      return await readJsonFromWalrus<JudgeProfileDetails>(app.applicationBlobId);
    } catch {}
  }

  return null;
}

export function updateApplicationState(applicationId: string, state: JudgeApplication["state"]) {
  const map = getAppsMap();
  for (const bountyId of Object.keys(map)) {
    const app = map[bountyId].find(a => a.applicationId === applicationId);
    if (app) {
      app.state = state;
      localStorage.setItem(APPS_KEY, JSON.stringify(map));
      return;
    }
  }
}
