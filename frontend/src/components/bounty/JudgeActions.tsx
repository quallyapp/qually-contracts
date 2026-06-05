import { useState, useCallback, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, Loader2, Send, Eye, User, ExternalLink, Copy, CheckCircle2, Info } from "lucide-react";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWallet } from "../../hooks/useWallet";
import { useContract } from "../../hooks/useContract";
import { getJudgeProfileLocal, type JudgeProfileDetails } from "../../lib/judge-profiles";
import { saveJudgeApplication, type JudgeApplication } from "../../lib/judge-applications";

interface JudgeActionsProps {
  bountyId: string;
}

function generateNonce(): number[] {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr);
}

async function computeHash(submissionId: string, score: number, nonce: number[]): Promise<number[]> {
  const cleanHex = submissionId.startsWith("0x") ? submissionId.slice(2) : submissionId;
  const subIdBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    subIdBytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  const scoreBytes = new Uint8Array(8);
  new DataView(scoreBytes.buffer).setBigUint64(0, BigInt(score));
  scoreBytes.reverse();
  const nonceBytes = new Uint8Array(nonce);
  const combined = new Uint8Array(subIdBytes.length + scoreBytes.length + nonceBytes.length);
  combined.set(subIdBytes, 0);
  combined.set(scoreBytes, subIdBytes.length);
  combined.set(nonceBytes, subIdBytes.length + scoreBytes.length);
  const hash = sha3_256(combined);
  return Array.from(hash);
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 text-primary hover:underline text-xs" title={`Copy ${label || text}`}>
      {copied ? <CheckCircle2 className="size-3" /> : <Copy className="size-3" />}
      {label && (copied ? "Copied!" : label)}
    </button>
  );
}

interface SavedCommit {
  bountyId: string;
  commitId: string;
  submissionId: string;
  score: number;
  nonce: number[];
  committedAt: string;
}

function getSavedCommits(bountyId: string): SavedCommit[] {
  try {
    const all = JSON.parse(localStorage.getItem("qually_commitments") || "[]");
    return all.filter((c: SavedCommit) => c.bountyId === bountyId);
  } catch { return []; }
}

function saveCommit(commit: SavedCommit) {
  const all = JSON.parse(localStorage.getItem("qually_commitments") || "[]");
  all.push(commit);
  localStorage.setItem("qually_commitments", JSON.stringify(all));
}

export function JudgeActions({ bountyId }: JudgeActionsProps) {
  const { connected, address } = useWallet();
  const { mintJudgeProfile, applyAsJudge, commitVote, revealVote, pending } = useContract();

  const [showApply, setShowApply] = useState(false);
  const [showCommit, setShowCommit] = useState(false);
  const [showReveal, setShowReveal] = useState(false);

  const [applyStake, setApplyStake] = useState("0.1");

  const [commitSubmissionId, setCommitSubmissionId] = useState("");
  const [commitScore, setCommitScore] = useState(5);
  const [commitNonce, setCommitNonce] = useState<number[]>([]);
  const [commitHash, setCommitHash] = useState<number[]>([]);
  const [commitId, setCommitId] = useState("");

  const [revealCommitId, setRevealCommitId] = useState("");
  const [revealSubmissionId, setRevealSubmissionId] = useState("");
  const [revealScore, setRevealScore] = useState(5);
  const [revealNonce, setRevealNonce] = useState("");

  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [judgeProfile, setJudgeProfile] = useState<{ blobId: string; details: JudgeProfileDetails } | null>(null);

  const [savedCommits, setSavedCommits] = useState<SavedCommit[]>([]);

  useEffect(() => {
    if (address) {
      const pid = localStorage.getItem(`qually_judge_profile_id_${address}`);
      setProfileId(pid);
      setJudgeProfile(getJudgeProfileLocal(address));
    }
    setSavedCommits(getSavedCommits(bountyId));
  }, [address, bountyId]);

  const handleApply = useCallback(async () => {
    const stake = parseFloat(applyStake);
    if (isNaN(stake) || stake <= 0) {
      setResult({ success: false, message: "Enter a valid stake amount" });
      return;
    }
    if (!profileId) {
      setResult({ success: false, message: "No judge profile found. Mint one at /judges first." });
      return;
    }

    let applicationBlobId: number[] = [];
    if (judgeProfile?.blobId) {
      applicationBlobId = Array.from(new TextEncoder().encode(judgeProfile.blobId)).slice(0, 32);
    }

    const res = await applyAsJudge(profileId, bountyId, Math.round(stake * 1_000_000_000), applicationBlobId);
    setResult({
      success: res.success,
      message: res.success ? "Application submitted! Awaiting poster approval." : (res.error ?? "Failed"),
    });
    if (res.success) {
      setShowApply(false);
      if (res.createdObjects && res.createdObjects.length > 0 && address) {
        const app: JudgeApplication = {
          applicationId: res.createdObjects[0],
          bountyId,
          judgeAddress: address,
          profileId,
          stakeAmount: stake,
          applicationBlobId: judgeProfile?.blobId || "",
          state: "pending",
          createdAt: new Date().toISOString(),
        };
        saveJudgeApplication(app);
      }
    }
  }, [applyAsJudge, bountyId, applyStake, profileId, judgeProfile, address]);

  const handleCommit = useCallback(async () => {
    if (commitScore < 1 || commitScore > 10) {
      setResult({ success: false, message: "Score must be 1-10" });
      return;
    }
    if (!commitSubmissionId.trim()) {
      setResult({ success: false, message: "Enter the submission ID you are voting on" });
      return;
    }
    const nonce = generateNonce();
    const hash = await computeHash(commitSubmissionId, commitScore, nonce);
    setCommitNonce(nonce);
    setCommitHash(hash);
    const res = await commitVote(bountyId, hash);
    if (res.success && res.createdObjects && res.createdObjects.length > 0) {
      const cid = res.createdObjects[0];
      setCommitId(cid);
      const saved: SavedCommit = {
        bountyId,
        commitId: cid,
        submissionId: commitSubmissionId,
        score: commitScore,
        nonce,
        committedAt: new Date().toISOString(),
      };
      saveCommit(saved);
      setSavedCommits(getSavedCommits(bountyId));
    }
    setResult({
      success: res.success,
      message: res.success ? "Vote committed! Your reveal data has been saved automatically." : (res.error ?? "Failed"),
    });
    if (res.success) setShowCommit(false);
  }, [commitVote, bountyId, commitScore, commitSubmissionId]);

  const handleReveal = useCallback(async () => {
    const nonceArr = revealNonce
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    if (!revealCommitId || !revealSubmissionId || nonceArr.length === 0) {
      setResult({ success: false, message: "Fill all fields" });
      return;
    }
    const res = await revealVote(revealCommitId, revealSubmissionId, revealScore, nonceArr);
    setResult({
      success: res.success,
      message: res.success ? "Vote revealed successfully!" : (res.error ?? "Failed"),
    });
    if (res.success) setShowReveal(false);
  }, [revealVote, revealCommitId, revealSubmissionId, revealScore, revealNonce]);

  function autoFillReveal(commit: SavedCommit) {
    setRevealCommitId(commit.commitId);
    setRevealSubmissionId(commit.submissionId);
    setRevealScore(commit.score);
    setRevealNonce(commit.nonce.join(","));
    setShowReveal(true);
  }

  if (!connected) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-center">
        <Shield className="size-8 text-on-surface-variant mx-auto mb-2" />
        <p className="text-sm text-on-surface-variant">Connect wallet to access judge actions.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Shield className="size-4 text-primary" />
        Judge Actions
      </h3>

      {!profileId && (
        <p className="text-xs text-on-surface-variant">
          Mint a judge profile at <a href="/judges" className="text-primary hover:underline">/judges</a> to apply.
        </p>
      )}

      {profileId && (
        <Link to="/judging" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          View Judging Queue →
        </Link>
      )}

      {judgeProfile && (
        <div className="rounded-md bg-surface-container p-3 text-xs space-y-1">
          <p className="text-on-surface-variant text-[10px] uppercase tracking-wide">Your Judge Profile</p>
          {judgeProfile.details.x && <p>X: <span className="text-foreground">{judgeProfile.details.x}</span></p>}
          {judgeProfile.details.github && <p>GitHub: <span className="text-foreground">{judgeProfile.details.github}</span></p>}
          {judgeProfile.details.linkedin && <p>LinkedIn: <span className="text-foreground">{judgeProfile.details.linkedin}</span></p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowApply(true)} disabled={!profileId}>
          Apply as Judge
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowCommit(true)}>
          <Send className="size-3.5" /> Commit Vote
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowReveal(true)}>
          <Eye className="size-3.5" /> Reveal Vote
        </Button>
      </div>

      {result && (
        <div
          className={`rounded-md p-3 text-sm ${
            result.success
              ? "bg-green-500/10 border border-green-500/20 text-green-500"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Saved Commits — One-Click Reveal */}
      {savedCommits.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Saved Votes</p>
          {savedCommits.map((commit, i) => (
            <div key={i} className="rounded-md bg-surface-container p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Vote #{i + 1}</span>
                <span className="text-on-surface-variant">{new Date(commit.committedAt).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Score:</span>
                  <span className="text-foreground font-semibold">{commit.score}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Sub ID:</span>
                  <span className="text-foreground truncate ml-1">{commit.submissionId.slice(0, 10)}...</span>
                  <CopyButton text={commit.submissionId} label="Copy" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant font-mono truncate">Commit: {commit.commitId.slice(0, 16)}...</span>
                <CopyButton text={commit.commitId} label="Copy" />
              </div>
              <Button
                size="sm"
                className="w-full mt-1"
                onClick={() => autoFillReveal(commit)}
              >
                <Eye className="size-3.5" /> Reveal This Vote
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Apply Dialog */}
      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply as Judge</DialogTitle>
            <DialogDescription>
              Stake SUI to apply as a judge for this bounty. Your stake is returned upon successful evaluation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {judgeProfile && (
              <div className="rounded-md bg-surface-container p-3 text-xs space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-on-surface-variant">Your Credentials</p>
                <div className="flex flex-wrap gap-2">
                  {judgeProfile.details.x && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-card">
                      <User className="size-3" /> {judgeProfile.details.x}
                    </span>
                  )}
                  {judgeProfile.details.github && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-card">
                      GH: {judgeProfile.details.github}
                    </span>
                  )}
                  {judgeProfile.details.linkedin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-card">
                      LI: {judgeProfile.details.linkedin}
                    </span>
                  )}
                  {judgeProfile.details.portfolio && (
                    <a href={judgeProfile.details.portfolio} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-card text-primary hover:underline">
                      Portfolio <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                {judgeProfile.details.motivation && (
                  <p className="text-on-surface-variant mt-1">{judgeProfile.details.motivation}</p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Stake (SUI)</label>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={applyStake}
                onChange={(e) => setApplyStake(e.target.value)}
              />
            </div>
            <Button onClick={handleApply} disabled={pending} className="w-full">
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Submit Application"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Commit Vote Dialog */}
      <Dialog open={showCommit} onOpenChange={setShowCommit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commit Vote</DialogTitle>
            <DialogDescription>
              Submit a commit-reveal vote. Your score is hashed on-chain; reveal later to finalize.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-md bg-primary/5 border border-primary/15 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-primary flex items-center gap-1"><Info className="size-3" /> How Commit-Reveal Works</p>
              <ol className="list-decimal list-inside space-y-1 text-on-surface-variant">
                <li><strong>Commit</strong> — You submit a HASH of your vote. Other judges cannot see your score.</li>
                <li><strong>Reveal</strong> — After all judges commit, you reveal the original parameters. Contract verifies the hash matches.</li>
              </ol>
              <p className="text-on-surface-variant">Your reveal data is saved automatically — no need to copy anything.</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Submission ID</label>
              <Input
                placeholder="The submission object ID you are voting on"
                value={commitSubmissionId}
                onChange={(e) => setCommitSubmissionId(e.target.value)}
              />
              <p className="text-xs text-on-surface-variant mt-1">Find submission IDs from the bounty detail page</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Score (1–10)</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={commitScore}
                onChange={(e) => setCommitScore(parseInt(e.target.value) || 1)}
              />
            </div>
            <Button onClick={handleCommit} disabled={pending} className="w-full">
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Commit Vote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reveal Vote Dialog */}
      <Dialog open={showReveal} onOpenChange={setShowReveal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal Vote</DialogTitle>
            <DialogDescription>
              Reveal your previously committed vote. Click "Reveal This Vote" above to auto-fill.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Commit ID</label>
              <div className="flex gap-2">
                <Input
                  placeholder="The commit object ID"
                  value={revealCommitId}
                  onChange={(e) => setRevealCommitId(e.target.value)}
                />
                {revealCommitId && <CopyButton text={revealCommitId} />}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Submission ID</label>
              <div className="flex gap-2">
                <Input
                  placeholder="The submission object ID"
                  value={revealSubmissionId}
                  onChange={(e) => setRevealSubmissionId(e.target.value)}
                />
                {revealSubmissionId && <CopyButton text={revealSubmissionId} />}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Score (1–10)</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={revealScore}
                onChange={(e) => setRevealScore(parseInt(e.target.value) || 1)}
                readOnly
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nonce (auto-filled)</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Auto-filled from saved commit"
                  value={revealNonce}
                  onChange={(e) => setRevealNonce(e.target.value)}
                  readOnly
                />
                {revealNonce && <CopyButton text={revealNonce} />}
              </div>
            </div>
            <Button onClick={handleReveal} disabled={pending} className="w-full">
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Reveal Vote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
