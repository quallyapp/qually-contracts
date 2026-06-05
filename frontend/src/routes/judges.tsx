import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shield, Star, Award, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "../hooks/useWallet";
import { useContract } from "../hooks/useContract";
import { uploadJudgeProfile, saveJudgeProfileLocal, getJudgeProfileLocal } from "../lib/judge-profiles";
import { saveJudgeApplication, type JudgeApplication } from "../lib/judge-applications";
import { useOnChainBounties } from "../hooks/useOnChainBounties";

export const Route = createFileRoute("/judges")({
  head: () => ({
    meta: [
      { title: "Judges — Qually" },
      { name: "description", content: "Become a judge on Qually. Evaluate submissions, earn reputation, and help maintain quality in the Sui ecosystem." },
    ],
  }),
  component: JudgesPage,
});

const TIERS = [
  {
    level: "T0",
    name: "New",
    color: "text-on-surface-variant",
    bg: "bg-surface-container",
    border: "border-border",
    requirements: { bounties: "0+", reputation: "—", accuracy: "—" },
    description: "Entry-level judge. Just onboarded and ready to evaluate first bounties.",
    icon: Shield,
  },
  {
    level: "T1",
    name: "Active",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    requirements: { bounties: "5+", reputation: "≥ 60%", accuracy: "≥ 50%" },
    description: "Consistent evaluator with a track record of fair, on-time reviews.",
    icon: Star,
  },
  {
    level: "T2",
    name: "Veteran",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    requirements: { bounties: "20+", reputation: "≥ 80%", accuracy: "≥ 70%" },
    description: "Experienced judge trusted with high-value bounties and complex evaluations.",
    icon: Award,
  },
  {
    level: "T3",
    name: "Elite",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    requirements: { bounties: "50+", reputation: "≥ 95%", accuracy: "≥ 85%" },
    description: "Top-tier judge. Handles the most critical bounties and disputes.",
    icon: Award,
  },
];

function JudgesPage() {
  const { connected, address } = useWallet();
  const { mintJudgeProfile, applyAsJudge, pending } = useContract();
  const { data: bounties } = useOnChainBounties();

  const [xAccount, setXAccount] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [motivation, setMotivation] = useState("");
  const [experience, setExperience] = useState("");

  const [profileMinted, setProfileMinted] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBounty, setSelectedBounty] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (address) {
      const pid = localStorage.getItem(`qually_judge_profile_id_${address}`);
      if (pid) {
        setProfileMinted(true);
        setProfileId(pid);
      } else {
        setProfileMinted(false);
        setProfileId(null);
      }
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      const existing = getJudgeProfileLocal(address);
      if (existing) {
        setXAccount(existing.details.x || "");
        setGithub(existing.details.github || "");
        setLinkedin(existing.details.linkedin || "");
        setInstagram(existing.details.instagram || "");
        setPortfolio(existing.details.portfolio || "");
        setMotivation(existing.details.motivation || "");
        setExperience(existing.details.experience || "");
      }
    }
  }, [address]);

  async function handleMintProfile() {
    setError(null);
    setUploading(true);

    try {
      const details = {
        address: address || "",
        x: xAccount || undefined,
        github: github || undefined,
        linkedin: linkedin || undefined,
        instagram: instagram || undefined,
        portfolio: portfolio || undefined,
        motivation: motivation || undefined,
        experience: experience || undefined,
        mintedAt: new Date().toISOString(),
      };

      let blobId = "";
      try {
        blobId = await uploadJudgeProfile(details);
      } catch (walrusErr) {
        console.warn("Walrus upload failed, minting without off-chain profile:", walrusErr);
      }

      const result = await mintJudgeProfile();
      if (result.success) {
        setProfileMinted(true);
        if (result.createdObjects && result.createdObjects.length > 0) {
          const pid = result.createdObjects[0];
          setProfileId(pid);
          localStorage.setItem(`qually_judge_profile_id_${address}`, pid);
          if (address && blobId) {
            saveJudgeProfileLocal(address, blobId, details);
          }
        }
      } else {
        setError(result.error ?? "Failed to mint profile");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mint profile");
    } finally {
      setUploading(false);
    }
  }

  async function handleApply() {
    setError(null);
    if (!selectedBounty.trim()) {
      setError("Please select a bounty to apply for");
      return;
    }
    if (!profileId) {
      setError("Profile not found. Please mint your profile first.");
      return;
    }

    let applicationBlobId: number[] = [];
    if (address) {
      const local = getJudgeProfileLocal(address);
      if (local?.blobId) {
        applicationBlobId = Array.from(new TextEncoder().encode(local.blobId)).slice(0, 32);
      }
    }

    const result = await applyAsJudge(profileId, selectedBounty, 100_000_000, applicationBlobId);
    if (result.success) {
      setApplied(true);
      if (result.createdObjects && result.createdObjects.length > 0 && address) {
        const app: JudgeApplication = {
          applicationId: result.createdObjects[0],
          bountyId: selectedBounty,
          judgeAddress: address,
          profileId,
          stakeAmount: 0.1,
          applicationBlobId: new TextDecoder().decode(new Uint8Array(applicationBlobId)),
          state: "pending",
          createdAt: new Date().toISOString(),
        };
        saveJudgeApplication(app);
      }
    } else {
      setError(result.error ?? "Failed to apply");
    }
  }

  const openBounties = (bounties || []).filter(b => b.status === "open");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader showSearch />

      <div className="grid-bg-lg border-b border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-md bg-primary/10 border border-primary/20 grid place-items-center text-primary">
              <Shield className="size-5" />
            </div>
            <h1 className="text-display">Judge System</h1>
          </div>
          <p className="mt-2 text-on-surface-variant max-w-2xl">
            Become a trusted evaluator on Qually. Review submissions, earn reputation, and help maintain quality across the Sui ecosystem.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 py-10 space-y-10">
        {/* Tier System */}
        <section>
          <h2 className="text-headline-md mb-5">Judge Tiers</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((tier) => {
              const Icon = tier.icon;
              return (
                <div key={tier.level} className={`rounded-lg border ${tier.border} ${tier.bg} p-5`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`size-9 rounded-md ${tier.bg} border ${tier.border} grid place-items-center ${tier.color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <span className={`font-mono font-bold ${tier.color}`}>{tier.level}</span>
                      <span className="ml-2 text-sm font-semibold">{tier.name}</span>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">{tier.description}</p>
                  <div className="border-t border-border/50 pt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Bounties Judged</span>
                      <span className="font-mono font-semibold">{tier.requirements.bounties}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Reputation</span>
                      <span className="font-mono font-semibold">{tier.requirements.reputation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Accuracy</span>
                      <span className="font-mono font-semibold">{tier.requirements.accuracy}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          {/* Active Judges Directory */}
          <section>
            <h2 className="text-headline-md mb-5">Active Judges</h2>
            {connected ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                  <Shield className="size-10 text-on-surface-variant mx-auto mb-3" />
                  <p className="text-on-surface-variant text-sm">Judge directory coming soon. Mint your profile to get started.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <Shield className="size-10 text-on-surface-variant mx-auto mb-3" />
                <p className="text-on-surface-variant">Connect wallet to see judge applications and the full directory.</p>
              </div>
            )}
          </section>

          {/* Application Form */}
          <section>
            <h2 className="text-headline-md mb-5">Become a Judge</h2>
            <div className="rounded-lg border border-border bg-card p-6 space-y-5">
              {!connected ? (
                <div className="text-center py-8">
                  <Shield className="size-10 text-on-surface-variant mx-auto mb-3" />
                  <p className="text-on-surface-variant text-sm">Connect wallet to apply as judge.</p>
                </div>
              ) : (
                <>
                  {!profileMinted ? (
                    <div className="space-y-4">
                      <p className="text-sm text-on-surface-variant">
                        Share your details and mint your on-chain judge profile. Social links help bounty posters trust your evaluations.
                      </p>

                      <div>
                        <label className="text-sm font-medium mb-1.5 block">X (Twitter)</label>
                        <Input
                          placeholder="@yourhandle"
                          value={xAccount}
                          onChange={(e) => setXAccount(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1.5 block">GitHub</label>
                        <Input
                          placeholder="github.com/yourusername"
                          value={github}
                          onChange={(e) => setGithub(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1.5 block">LinkedIn</label>
                        <Input
                          placeholder="linkedin.com/in/yourprofile"
                          value={linkedin}
                          onChange={(e) => setLinkedin(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Instagram</label>
                        <Input
                          placeholder="@yourhandle"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Portfolio Website</label>
                        <Input
                          placeholder="https://yoursite.com"
                          value={portfolio}
                          onChange={(e) => setPortfolio(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Motivation</label>
                        <Textarea
                          placeholder="Why do you want to be a judge on Qually?"
                          value={motivation}
                          onChange={(e) => setMotivation(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Experience</label>
                        <Textarea
                          placeholder="Relevant experience evaluating code, design, or technical work..."
                          value={experience}
                          onChange={(e) => setExperience(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <Button onClick={handleMintProfile} disabled={pending || uploading} className="w-full">
                        {pending || uploading ? (
                          <><Loader2 className="size-4 animate-spin" /> {uploading ? "Uploading to Walrus..." : "Minting..."} </>
                        ) : (
                          "Mint Judge Profile"
                        )}
                      </Button>
                      <p className="text-xs text-on-surface-variant text-center">
                        Your details are stored on Walrus decentralized storage and linked to your on-chain profile.
                      </p>
                    </div>
                  ) : !applied ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-green-500">
                        <CheckCircle2 className="size-4" />
                        <span>Profile minted{profileId ? ` (${profileId.slice(0, 8)}...)` : ''}. Now apply to judge a bounty.</span>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Select Bounty to Judge</label>
                        {openBounties.length > 0 ? (
                          <select
                            value={selectedBounty}
                            onChange={(e) => setSelectedBounty(e.target.value)}
                            className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm"
                          >
                            <option value="">Choose a bounty...</option>
                            {openBounties.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.title || b.id.slice(0, 12) + "..."} — {b.prizePool.toLocaleString()} SUI
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <Input
                              placeholder="No open bounties found. Paste bounty ID manually."
                              value={selectedBounty}
                              onChange={(e) => setSelectedBounty(e.target.value)}
                            />
                          </div>
                        )}
                      </div>

                      <Button onClick={handleApply} disabled={pending || !selectedBounty.trim()} className="w-full">
                        {pending ? (
                          <><Loader2 className="size-4 animate-spin" /> Submitting...</>
                        ) : (
                          "Apply as Judge (0.1 SUI stake)"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="size-10 text-green-500 mx-auto mb-3" />
                      <p className="font-semibold mb-1">Application submitted!</p>
                      <p className="text-sm text-on-surface-variant mb-3">Once approved, you can start evaluating bounties.</p>
                      <a href="/judging" className="text-sm text-primary hover:underline">View Judging Queue →</a>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
