import { useState, useEffect } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Shield, Clock, CheckCircle2, Lock, ExternalLink, Loader2, Vote } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "../hooks/useWallet";
import { useOnChainBounties } from "../hooks/useOnChainBounties";
import { getApplicationsByJudge } from "../lib/judge-applications";

export const Route = createFileRoute("/judging")({
  head: () => ({
    meta: [
      { title: "Judging Queue — Qually" },
      { name: "description", content: "Bounties you've been approved to judge. Review submissions and cast votes." },
    ],
  }),
  component: JudgingQueuePage,
});

function getTimeRemaining(deadline: Date): string {
  const now = Date.now();
  const diff = deadline.getTime() - now;
  if (diff <= 0) return "EXPIRED";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function JudgingQueuePage() {
  const { connected, address } = useWallet();
  const { data: bounties, isLoading } = useOnChainBounties();
  const [applications, setApplications] = useState<Array<{ bountyId: string; state: string }>>([]);

  useEffect(() => {
    if (address) {
      const apps = getApplicationsByJudge(address);
      setApplications(apps);
    }
  }, [address]);

  const approvedBountyIds = applications
    .filter(a => a.state === "approved")
    .map(a => a.bountyId);

  const approvedBounties = (bounties || []).filter(b => approvedBountyIds.includes(b.id));

  const now = Date.now();
  const isJudgingPeriod = (b: typeof approvedBounties[0]) => {
    return now >= b.submissionDeadline.getTime() && now <= b.judgingDeadline.getTime();
  };
  const isBeforeJudging = (b: typeof approvedBounties[0]) => now < b.submissionDeadline.getTime();
  const isJudgingEnded = (b: typeof approvedBounties[0]) => now > b.judgingDeadline.getTime();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="grid-bg-lg border-b border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-md bg-primary/10 border border-primary/20 grid place-items-center text-primary">
              <Vote className="size-5" />
            </div>
            <h1 className="text-display">Judging Queue</h1>
          </div>
          <p className="mt-2 text-on-surface-variant max-w-2xl">
            Bounties you've been approved to judge. Review submissions and cast your votes during the judging period.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 py-10">
        {!connected ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <Shield className="size-12 text-on-surface-variant mx-auto mb-4" />
            <h2 className="text-headline-md mb-2">Connect Wallet</h2>
            <p className="text-on-surface-variant">Connect your wallet to see your judging queue.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-on-surface-variant">Loading bounties...</span>
          </div>
        ) : approvedBounties.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <Shield className="size-12 text-on-surface-variant mx-auto mb-4" />
            <h2 className="text-headline-md mb-2">No Bounties to Judge</h2>
            <p className="text-on-surface-variant max-w-md mx-auto mb-6">
              You haven't been approved to judge any bounties yet. Apply as a judge on a bounty to get started.
            </p>
            <Link
              to="/judges"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              <Shield className="size-4" /> Become a Judge
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-headline-md">
                {approvedBounties.length} {approvedBounties.length === 1 ? "Bounty" : "Bounties"}
              </h2>
              <Badge variant="outline">{applications.filter(a => a.state === "approved").length} Approved</Badge>
            </div>

            {approvedBounties.map((bounty) => {
              const inJudgingPeriod = isJudgingPeriod(bounty);
              const beforeJudging = isBeforeJudging(bounty);
              const judgingEnded = isJudgingEnded(bounty);

              return (
                <div key={bounty.id} className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={inJudgingPeriod ? "default" : beforeJudging ? "secondary" : "outline"} className="text-[10px]">
                          {inJudgingPeriod ? "JUDGING OPEN" : beforeJudging ? "WAITING FOR DEADLINE" : "JUDGING ENDED"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{bounty.type.toUpperCase()}</Badge>
                      </div>
                      <h3 className="font-semibold text-lg truncate">{bounty.title || "Untitled Bounty"}</h3>
                      <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                        {bounty.description || "No description available."}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold text-primary text-lg">{bounty.prizePool.toLocaleString()} SUI</p>
                      <p className="text-label-caps text-on-surface-variant">PRIZE</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      <span>
                        {beforeJudging
                          ? `Judging in ${getTimeRemaining(bounty.submissionDeadline)}`
                          : judgingEnded
                            ? "Judging ended"
                            : `Ends in ${getTimeRemaining(bounty.judgingDeadline)}`
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5" />
                      <span>{bounty.submissionCount} submission{bounty.submissionCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    {inJudgingPeriod ? (
                      <Link
                        to="/bounty/$id"
                        params={{ id: bounty.id }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
                      >
                        <Vote className="size-3.5" /> Judge Now
                      </Link>
                    ) : beforeJudging ? (
                      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <Lock className="size-3.5" />
                        Judging opens after submission deadline ({bounty.submissionDeadline.toLocaleDateString()})
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <Lock className="size-3.5" />
                        Judging period has ended
                      </div>
                    )}

                    <Link
                      to="/bounty/$id"
                      params={{ id: bounty.id }}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-foreground"
                    >
                      View Bounty <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
