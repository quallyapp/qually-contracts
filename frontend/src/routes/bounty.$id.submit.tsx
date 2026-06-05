import { useState, useRef } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Send, Upload, X, Users, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useOnChainBounty } from "../hooks/useOnChainBounties";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../hooks/useWallet";
import { uploadText, uploadToWalrus } from "../lib/walrus";
import { saveSubmission } from "../lib/submissions";

export const Route = createFileRoute("/bounty/$id/submit")({
  head: () => ({
    meta: [
      { title: "Submit Work — Qually" },
      { name: "description", content: "Submit your work for a bounty on Qually." },
    ],
  }),
  component: BountySubmit,
});

function formatPrizePool(prizePool: number): string {
  return `${prizePool.toLocaleString()} SUI`;
}

function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[720px] px-6 py-10 space-y-6">
        <div className="h-6 w-48 rounded bg-surface-container animate-pulse" />
        <div className="h-4 w-full rounded bg-surface-container animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-surface-container animate-pulse" />
        <div className="h-10 w-full rounded bg-surface-container animate-pulse" />
        <div className="h-10 w-full rounded bg-surface-container animate-pulse" />
        <div className="h-32 w-full rounded bg-surface-container animate-pulse" />
      </div>
      <SiteFooter compact />
    </div>
  );
}

function NotConnected() {
  const { connect, connecting } = useWallet();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[720px] px-6 py-20 text-center space-y-6">
        <div className="size-16 rounded-full bg-primary/10 border border-primary/20 grid place-items-center mx-auto">
          <AlertCircle className="size-8 text-primary" />
        </div>
        <h1 className="text-display">Connect Your Wallet</h1>
        <p className="text-on-surface-variant max-w-md mx-auto">
          You need to connect your wallet to submit work for this bounty.
        </p>
        <Button onClick={connect} disabled={connecting} size="lg">
          {connecting ? "Connecting…" : "Connect Wallet"}
        </Button>
        <Link
          to="/bounty/$id"
          params={{ id: useParams({ from: "/bounty/$id/submit" }).id }}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Back to bounty
        </Link>
      </div>
      <SiteFooter compact />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[720px] px-6 py-20 text-center space-y-6">
        <h1 className="text-display">Bounty Not Found</h1>
        <p className="text-on-surface-variant">The bounty you're looking for doesn't exist or has been removed.</p>
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90"
        >
          Browse Bounties
        </Link>
      </div>
      <SiteFooter compact />
    </div>
  );
}

interface CollabEntry {
  address: string;
  split: number;
}

function BountySubmit() {
  const { id } = useParams({ from: "/bounty/$id/submit" });
  const navigate = useNavigate();
  const { connected } = useWallet();
  const { data: bounty, isLoading } = useOnChainBounty(id);
  const { submitWork, pending } = useContract();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTeam, setIsTeam] = useState(false);
  const [collabs, setCollabs] = useState<CollabEntry[]>([{ address: "", split: 100 }]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!connected) return <NotConnected />;
  if (isLoading) return <SkeletonLoader />;
  if (!bounty) return <NotFound />;

  const isFormValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    (!isTeam || validateSplits(collabs));

  function validateSplits(entries: CollabEntry[]): boolean {
    const total = entries.reduce((sum, e) => sum + e.split, 0);
    const allAddressesFilled = entries.every((e) => e.address.trim().length > 0);
    return total === 100 && allAddressesFilled;
  }

  function handleAddCollab() {
    setCollabs((prev) => [...prev, { address: "", split: 0 }]);
  }

  function handleRemoveCollab(index: number) {
    setCollabs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) next.push({ address: "", split: 100 });
      return next;
    });
  }

  function handleCollabChange(index: number, field: keyof CollabEntry, value: string | number) {
    setCollabs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    console.log("[Qually] Submit handler started");

    try {
      console.log("[Qually] Submit: uploading description to Walrus...");
      const descResult = await Promise.race([
        uploadText(JSON.stringify({ title, description })),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Walrus upload timed out after 20s")), 20000)),
      ]);
      console.log("[Qually] Submit: Walrus done, blobId:", descResult.blobId.slice(0, 16));

      let collabAddresses: string[] = [];
      let splitValues: number[] = [];

      if (isTeam) {
        collabAddresses = collabs.map((c) => c.address.trim());
        splitValues = collabs.map((c) => c.split);
      }

      const blobIdNums = Array.from(new TextEncoder().encode(descResult.blobId));
      console.log("[Qually] Submit: calling submitWork on-chain...");
      const result = await submitWork(
        id,
        collabAddresses,
        splitValues,
        blobIdNums,
        descResult.blobHash
      );

      console.log("[Qually] Submit: result:", JSON.stringify(result, null, 2));
      if (result.success) {
        await saveSubmission({
          id: result.createdObjects?.[0] ?? `sub_${Date.now()}`,
          bountyId: id,
          title,
          description,
          blobId: descResult.blobId,
          submittedAt: new Date().toISOString(),
        });

        setSuccess(result.digest ?? "Transaction submitted");
        toast.success("Work submitted successfully!", {
          description: `Digest: ${result.digest}`,
        });
        setTimeout(() => {
          navigate({ to: "/bounty/$id", params: { id } });
        }, 3000);
      } else {
        console.error("[Qually] Submit: error detail:", result.error);
        setError(result.error ?? "Transaction failed");
        toast.error("Submission failed", { description: result.error });
      }
    } catch (e: any) {
      console.error("[Qually] Submit failed:", e);
      const msg = e?.message ?? "An unexpected error occurred";
      setError(msg);
      toast.error("Submission failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const totalSplit = collabs.reduce((sum, c) => sum + c.split, 0);
  const splitsValid = totalSplit === 100;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-[720px] px-6 py-10">
        <Link
          to="/bounty/$id"
          params={{ id }}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary mb-6"
        >
          <ArrowLeft className="size-4" /> Back to bounty
        </Link>

        {/* Bounty info header */}
        <div className="rounded-lg border border-border bg-card p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-label-mono px-2.5 py-1 rounded-sm bg-primary/10 text-primary border border-primary/20">
                  {bounty.type.toUpperCase()}
                </span>
                <span className="text-label-mono text-on-surface-variant">
                  ID: {bounty.id.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-headline-md">{bounty.title}</h1>
            </div>
            <div className="text-right">
              <p className="text-label-caps text-on-surface-variant mb-1">Prize Pool</p>
              <p className="font-mono font-bold text-primary text-lg">{formatPrizePool(bounty.prizePool)}</p>
            </div>
          </div>
          <div className="border-t border-border mt-4 pt-4 flex items-center gap-6 text-sm text-on-surface-variant">
            <span>Deadline: {bounty.submissionDeadline.toLocaleDateString()}</span>
            <span>Submissions: {bounty.submissionCount}</span>
            <span>Category: {bounty.category}</span>
          </div>
        </div>

        {/* Success state */}
        {success && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 mb-6 text-center space-y-3">
            <CheckCircle2 className="size-10 text-primary mx-auto" />
            <h2 className="text-headline-md">Submission Successful</h2>
            <p className="text-on-surface-variant text-sm">
              Transaction digest: <span className="font-mono text-primary">{success}</span>
            </p>
            <p className="text-on-surface-variant text-sm">Redirecting to bounty page…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="size-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Submission failed</p>
              <p className="text-sm text-on-surface-variant mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        {!success && (
          <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Submission Title</Label>
              <Input
                id="title"
                placeholder="e.g. DeFi AMM with concentrated liquidity"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your submission, approach, and key features…"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-on-surface-variant">
                This will be uploaded to Walrus decentralized storage.
              </p>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Work Files</Label>
              <div className="border border-dashed border-border rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
                {selectedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Upload className="size-5 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="size-8 rounded-md border border-border grid place-items-center hover:bg-accent"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="size-8 text-on-surface-variant mx-auto mb-2" />
                    <p className="text-sm text-on-surface-variant">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-on-surface-variant/70 mt-1">
                      ZIP, PDF, or other files
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Team submission */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="team"
                  checked={isTeam}
                  onCheckedChange={(checked) => setIsTeam(checked === true)}
                />
                <Label htmlFor="team" className="flex items-center gap-2 cursor-pointer">
                  <Users className="size-4" />
                  Team Submission
                </Label>
              </div>

              {isTeam && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <p className="text-sm text-on-surface-variant">
                    Add collaborators and split the payout. Splits must total 100%.
                  </p>

                  {collabs.map((collab, idx) => (
                    <div key={idx} className="space-y-3 p-3 rounded-md border border-border bg-surface-low">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Collaborator Sui address"
                          value={collab.address}
                          onChange={(e) => handleCollabChange(idx, "address", e.target.value)}
                          className="flex-1"
                        />
                        {collabs.length > 1 && (
                          <button
                            onClick={() => handleRemoveCollab(idx)}
                            className="size-9 rounded-md border border-border grid place-items-center hover:bg-accent flex-shrink-0"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-on-surface-variant">Payout split</span>
                          <span className="font-mono font-semibold">{collab.split}%</span>
                        </div>
                        <Slider
                          value={[collab.split]}
                          onValueChange={([v]) => handleCollabChange(idx, "split", v)}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleAddCollab}
                      className="text-sm text-primary hover:underline"
                    >
                      + Add collaborator
                    </button>
                    <span
                      className={`text-sm font-mono font-semibold ${
                        splitsValid ? "text-primary" : "text-destructive"
                      }`}
                    >
                      Total: {totalSplit}%
                    </span>
                  </div>

                  {!splitsValid && (
                    <p className="text-xs text-destructive">
                      Payout splits must sum to exactly 100%.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Submit button */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Link
                to="/bounty/$id"
                params={{ id }}
                className="text-sm text-on-surface-variant hover:text-primary"
              >
                Cancel
              </Link>
              <Button
                onClick={handleSubmit}
                disabled={submitting || pending || !isFormValid}
                size="lg"
              >
                {submitting || pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Submit Work
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <SiteFooter compact />
    </div>
  );
}
