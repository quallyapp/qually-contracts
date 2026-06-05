import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, ArrowLeft, Send, Loader2, CheckCircle2, AlertCircle, Cloud } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useWallet } from "@/hooks/useWallet";
import { useContract } from "@/hooks/useContract";
import { uploadJson } from "@/lib/walrus";
import type { CreateBountyParams } from "@/lib/types";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create Bounty — Qually" },
      { name: "description", content: "Create a new bounty on Qually." },
    ],
  }),
  component: CreateBountyPage,
});

function CreateBountyPage() {
  const { connected } = useWallet();
  const { createBounty, pending } = useContract();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    bountyType: "0" as "0" | "1" | "2",
    prizeSui: "",
    submissionDays: "7",
    judgingDays: "3",
    category: "Development",
    maxJudges: "3",
    autoExtend: false,
  });

  const [step, setStep] = useState<"form" | "uploading" | "signing">("form");

  const categories = [
    "Development", "Design", "Security", "Documentation",
    "Research", "Infrastructure", "Other",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const prizeMist = Math.floor(parseFloat(form.prizeSui) * 1_000_000_000);
    if (!prizeMist || prizeMist <= 0) {
      setError("Please enter a valid prize amount");
      return;
    }

    const now = Date.now();
    const submissionMs = parseInt(form.submissionDays) * 24 * 60 * 60 * 1000;
    const judgingMs = parseInt(form.judgingDays) * 24 * 60 * 60 * 1000;

    // Step 1: Upload brief to Walrus
    setStep("uploading");
    let briefResult;
    try {
      console.log("[Qually] Uploading brief to Walrus...");
      briefResult = await uploadJson({
        title: form.title,
        description: form.description,
        category: form.category,
        requirements: form.description,
        createdAt: new Date().toISOString(),
      });
      console.log("[Qually] Walrus upload success:", briefResult.blobId.slice(0, 16) + "...");
    } catch (err: any) {
      console.error("[Qually] Walrus upload failed:", err.message);
      setError(`Walrus upload failed: ${err.message}. Please try again — your bounty needs Walrus storage for the title and description.`);
      setStep("form");
      return;
    }

    const blobIdBytes = Array.from(new TextEncoder().encode(briefResult.blobId));
    const params: CreateBountyParams = {
      bounty_type: parseInt(form.bountyType) as 0 | 1 | 2,
      brief_blob_id: blobIdBytes,
      brief_content_hash: briefResult.blobHash,
      submission_deadline: now + submissionMs,
      judging_deadline: now + submissionMs + judgingMs,
      poster_weight: 50,
      max_judges: parseInt(form.maxJudges),
      contest_splits: [],
      is_recurring: false,
      auto_extend: form.autoExtend,
      category_tags: [form.category],
      prizeAmountMist: prizeMist,
    };

    try {
      setStep("signing");
      const result = await createBounty(params);
      if (result.success) {
        setSubmitted(true);
        // Cache bounty ID in localStorage for discovery
        if (result.createdObjects?.length) {
          const cached = JSON.parse(localStorage.getItem('qually_bounty_ids') || '[]');
          for (const objId of result.createdObjects) {
            if (!cached.includes(objId)) cached.push(objId);
          }
          localStorage.setItem('qually_bounty_ids', JSON.stringify(cached));
        }
        queryClient.invalidateQueries({ queryKey: ["onChainBounties"] });
        setTimeout(() => navigate({ to: "/post" }), 3000);
      } else {
        setError(result.error || "Transaction failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create bounty");
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[800px] px-6 py-10">
          <div className="rounded-lg border border-border bg-card p-16 text-center">
            <Wallet className="size-12 mx-auto text-on-surface-variant mb-4" />
            <h2 className="text-headline-md mb-2">Connect your wallet</h2>
            <p className="text-on-surface-variant max-w-md mx-auto">
              Connect your Sui wallet to create a bounty.
            </p>
          </div>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[800px] px-6 py-10">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-16 text-center">
            <CheckCircle2 className="size-12 mx-auto text-primary mb-4" />
            <h2 className="text-headline-md mb-2">Bounty Created!</h2>
            <p className="text-on-surface-variant">Redirecting to your dashboard...</p>
          </div>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[800px] px-6 py-10">
        <button
          onClick={() => history.back()}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="size-4" /> Back
        </button>

        <h1 className="text-display mb-2">Create Bounty</h1>
        <p className="text-on-surface-variant mb-8">Post a new bounty to the Qually network.</p>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bounty Type */}
          <div>
            <label className="text-label-caps text-on-surface-variant block mb-3">Bounty Type</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "0", label: "Fixed Price", desc: "Single winner, set reward" },
                { value: "1", label: "Contest", desc: "Multiple winners, split prize" },
                { value: "2", label: "Grant", desc: "Milestone-based payout" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, bountyType: t.value as "0" | "1" | "2" })}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    form.bountyType === t.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <p className="font-semibold text-sm">{t.label}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-label-caps text-on-surface-variant block mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Build a Walrus upload widget"
              className="w-full h-11 px-4 rounded-md border border-border bg-card text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-label-caps text-on-surface-variant block mb-2">Description / Brief</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the bounty requirements, deliverables, and acceptance criteria..."
              rows={6}
              className="w-full px-4 py-3 rounded-md border border-border bg-card text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              required
            />
          </div>

          {/* Prize + Deadlines */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Prize (SUI)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={form.prizeSui}
                onChange={(e) => setForm({ ...form, prizeSui: e.target.value })}
                placeholder="10"
                className="w-full h-11 px-4 rounded-md border border-border bg-card text-sm font-mono placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                required
              />
              <p className="text-xs text-on-surface-variant mt-1.5">
                Pay with SUI from your wallet.{" "}
                <span className="text-primary cursor-pointer hover:underline" title="Cross-chain payments via LI.FI are coming soon.">
                  Cross-chain?
                </span>
              </p>
            </div>
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Submission Window</label>
              <select
                value={form.submissionDays}
                onChange={(e) => setForm({ ...form, submissionDays: e.target.value })}
                className="w-full h-11 px-4 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {[3, 5, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Judging Window</label>
              <select
                value={form.judgingDays}
                onChange={(e) => setForm({ ...form, judgingDays: e.target.value })}
                className="w-full h-11 px-4 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {[1, 3, 5, 7].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category + Max Judges + Auto-extend */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-11 px-4 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Max Judges</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.maxJudges}
                onChange={(e) => setForm({ ...form, maxJudges: e.target.value })}
                className="w-full h-11 px-4 rounded-md border border-border bg-card text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoExtend}
                  onChange={(e) => setForm({ ...form, autoExtend: e.target.checked })}
                  className="size-4 rounded border-border accent-primary"
                />
                <span className="text-sm">Auto-extend deadline</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-border">
            <button
              type="submit"
              disabled={pending || step !== "form" || !form.title || !form.description || !form.prizeSui}
              className="h-12 px-8 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === "uploading" ? (
                <>
                  <Cloud className="size-4 animate-pulse" /> Uploading to Walrus...
                </>
              ) : step === "signing" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing Transaction...
                </>
              ) : (
                <>
                  <Send className="size-4" /> Create Bounty
                </>
              )}
            </button>
            <p className="text-xs text-on-surface-variant mt-3">
              {step === "uploading"
                ? "Uploading your bounty brief to Walrus decentralized storage..."
                : step === "signing"
                ? "You'll be asked to sign a transaction in your wallet. Prize amount will be escrowed on-chain."
                : "Your brief will be stored on Walrus. Prize SUI will be escrowed on-chain."}
            </p>
          </div>
        </form>
      </div>
      <SiteFooter compact />
    </div>
  );
}
