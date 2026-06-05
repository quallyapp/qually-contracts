import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { useOnChainBounty } from "@/hooks/useOnChainBounties";
import { WALRUS_AGGREGATORS } from "@/lib/config";

const WALRUS_AGGREGATOR = WALRUS_AGGREGATORS[0];

export const Route = createFileRoute("/submission/$bountyId")({
  head: () => ({
    meta: [
      { title: "My Submission — Qually" },
      { name: "description", content: "View your submission details." },
    ],
  }),
  component: SubmissionDetailPage,
});

interface CachedSubmission {
  id: string;
  bountyId: string;
  title: string;
  description: string;
  blobId: string;
  submittedAt: string;
}

interface WalrusContent {
  title: string;
  description: string;
  category?: string;
  requirements?: string;
  createdAt?: string;
}

function SubmissionDetailPage() {
  const { bountyId } = useParams({ from: "/submission/$bountyId" });
  const { data: bounty, isLoading: bountyLoading } = useOnChainBounty(bountyId);
  const [submission, setSubmission] = useState<CachedSubmission | null>(null);
  const [walrusContent, setWalrusContent] = useState<WalrusContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    import("@/lib/submissions").then(({ getSubmissionsForBounty }) => {
      const found = getSubmissionsForBounty(bountyId)[0] ?? null;
      setSubmission(found as any ?? null);

      if (found?.blobId) {
        fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${encodeURIComponent(found.blobId)}`, {
          signal: AbortSignal.timeout(10000),
        })
          .then((r) => r.text())
          .then((text) => {
            try {
              setWalrusContent(JSON.parse(text));
            } catch {
              setWalrusContent({ title: found.title, description: text });
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [bountyId]);

  function handleCopyBlobId() {
    if (submission?.blobId) {
      navigator.clipboard.writeText(submission.blobId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (bountyLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[800px] px-6 py-10 space-y-4">
          <div className="h-6 w-48 rounded bg-surface-container animate-pulse" />
          <div className="h-4 w-full rounded bg-surface-container animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-surface-container animate-pulse" />
          <div className="h-64 w-full rounded bg-surface-container animate-pulse" />
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[800px] px-6 py-20 text-center space-y-4">
          <h1 className="text-display">Submission Not Found</h1>
          <p className="text-on-surface-variant">
            No cached submission found for this bounty. Submissions made after
            page refresh will appear here.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="size-4" /> Back to Dashboard
          </Link>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-[800px] px-6 py-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary mb-6"
        >
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Link>

        {/* Bounty Context */}
        {bounty && (
          <div className="rounded-lg border border-border bg-card p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  {bounty.status.toUpperCase()}
                </Badge>
                <span className="text-label-mono text-on-surface-variant">
                  Bounty #{bountyId.slice(0, 8)}
                </span>
              </div>
              <span className="font-mono font-bold text-primary">
                {bounty.prizePool.toLocaleString()} SUI
              </span>
            </div>
            <h2 className="font-semibold text-lg">{bounty.title}</h2>
            {bounty.description && (
              <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                {bounty.description}
              </p>
            )}
            <Link
              to="/bounty/$id"
              params={{ id: bountyId }}
              className="inline-flex items-center gap-1 text-sm text-primary font-semibold mt-3 hover:underline"
            >
              View Bounty <ExternalLink className="size-3" />
            </Link>
          </div>
        )}

        {/* Submission Details */}
        <div className="rounded-lg border border-primary/20 bg-card overflow-hidden">
          <div className="border-b border-border bg-primary/5 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-headline-md">{walrusContent?.title || submission.title}</h1>
                <p className="text-label-mono text-on-surface-variant mt-1">
                  Submitted {new Date(submission.submittedAt).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                SUBMITTED
              </Badge>
            </div>
          </div>

          <div className="p-5 space-y-6">
            {/* Description */}
            {(walrusContent?.description || submission.description) && (
              <div>
                <h3 className="text-label-caps text-on-surface-variant mb-2">DESCRIPTION</h3>
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {walrusContent?.description || submission.description}
                </div>
              </div>
            )}

            {/* Requirements */}
            {walrusContent?.requirements && walrusContent.requirements !== walrusContent.description && (
              <div>
                <h3 className="text-label-caps text-on-surface-variant mb-2">REQUIREMENTS</h3>
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {walrusContent.requirements}
                </div>
              </div>
            )}

            {/* Category */}
            {walrusContent?.category && (
              <div>
                <h3 className="text-label-caps text-on-surface-variant mb-2">CATEGORY</h3>
                <Badge variant="outline">{walrusContent.category}</Badge>
              </div>
            )}

            {/* Technical Metadata */}
            <div className="border-t border-border pt-5 space-y-4">
              <h3 className="text-label-caps text-on-surface-variant">TECHNICAL METADATA</h3>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between p-3 rounded-md bg-surface-low">
                  <span className="text-sm text-on-surface-variant">Walrus Blob ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-foreground">
                      {submission.blobId}
                    </span>
                    <button
                      onClick={handleCopyBlobId}
                      className="text-on-surface-variant hover:text-primary transition-colors"
                    >
                      {copied ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-surface-low">
                  <span className="text-sm text-on-surface-variant">Bounty ID</span>
                  <span className="text-sm font-mono text-foreground">{bountyId}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-surface-low">
                  <span className="text-sm text-on-surface-variant">Submission ID</span>
                  <span className="text-sm font-mono text-foreground">{submission.id}</span>
                </div>

                {walrusContent?.createdAt && (
                  <div className="flex items-center justify-between p-3 rounded-md bg-surface-low">
                    <span className="text-sm text-on-surface-variant">Created At</span>
                    <span className="text-sm font-mono text-foreground">
                      {new Date(walrusContent.createdAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter compact />
    </div>
  );
}
