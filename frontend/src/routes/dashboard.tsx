import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, Bell, Search, Scale, FileText, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useOnChainBounties, useMySubmissions } from "@/hooks/useOnChainBounties";
import { useWallet } from "@/hooks/useWallet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Qually" },
      { name: "description", content: "View your bounties, submissions, and platform activity." },
    ],
  }),
  component: DashboardPage,
});

function formatSui(mist: number) {
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(mist);
  return `${formatted} SUI`;
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function statusColor(status: string) {
  switch (status) {
    case "open": return "bg-primary/10 text-primary border-primary/20";
    case "review": return "bg-warning/15 text-warning border-warning/30";
    case "closed": return "bg-on-surface-variant/10 text-on-surface-variant border-border";
    default: return "bg-primary/10 text-primary border-primary/20";
  }
}

function DashboardPage() {
  const { connected, address } = useWallet();
  const { data: allBounties, isLoading } = useOnChainBounties();
  const { data: mySubmissionData, isLoading: isLoadingSubmissions } = useMySubmissions(address);
  const [activeTab, setActiveTab] = useState("bounties");

  const myBounties = useMemo(() => {
    if (!allBounties || !address) return [];
    return allBounties.filter((b) => b.posterAddress === address);
  }, [allBounties, address]);

  const mySubmissions = useMemo(() => {
    if (!allBounties || !address) return [];
    return allBounties.filter((b) =>
      b.submittedAddresses?.map((a: string) => a.toLowerCase()).includes(address.toLowerCase())
    );
  }, [allBounties, address]);

  const notifications = useMemo(() => {
    if (!myBounties.length) return [];
    const items: { text: string; meta: string; time: string }[] = [];
    for (const b of myBounties) {
      if (b.submissionCount > 0 && (b.status === "open" || b.status === "review")) {
        items.push({
          text: `${b.submissionCount} new submission${b.submissionCount > 1 ? "s" : ""} for "${b.title}"`,
          meta: "BOUNTY ACTIVITY",
          time: "Active",
        });
      }
    }
    return items;
  }, [myBounties]);

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[1280px] px-6 py-10">
          <h1 className="text-display mb-8">Dashboard</h1>
          <div className="rounded-lg border border-border bg-card p-16 text-center">
            <Wallet className="size-12 mx-auto text-on-surface-variant mb-4" />
            <h2 className="text-headline-md mb-2">Connect your wallet</h2>
            <p className="text-on-surface-variant max-w-md mx-auto">
              Connect your Sui wallet to view your dashboard, including bounties, submissions, and judging queue.
            </p>
          </div>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-display">Dashboard</h1>
            <p className="mt-2 text-on-surface-variant">
              Overview of your activity on Qually.
            </p>
          </div>
          <div className="text-right">
            <p className="text-label-mono text-on-surface-variant">{truncAddr(address!)}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="bounties" className="gap-2">
              <FileText className="size-4" /> My Bounties
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-2">
              <Search className="size-4" /> My Submissions
            </TabsTrigger>
            <TabsTrigger value="judging" className="gap-2">
              <Scale className="size-4" /> Judging Queue
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="size-4" /> Notifications
              {notifications.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* My Bounties */}
          <TabsContent value="bounties">
            {isLoading ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-on-surface-variant">
                Loading your bounties...
              </div>
            ) : myBounties.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-16 text-center">
                <FileText className="size-10 mx-auto text-on-surface-variant mb-4" />
                <h3 className="text-headline-sm mb-2">No bounties yet</h3>
                <p className="text-on-surface-variant max-w-md mx-auto mb-6">
                  You haven't posted any bounties yet. Create your first bounty to start receiving submissions.
                </p>
                <Link
                  to="/post"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
                >
                  Post a Bounty
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myBounties.map((b) => (
                  <Link
                    key={b.id}
                    to="/bounty/$id"
                    params={{ id: b.id }}
                    className="block rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={statusColor(b.status)}>
                          {b.status.toUpperCase()}
                        </Badge>
                        <span className="text-label-mono text-on-surface-variant">#{b.id.slice(0, 8)}</span>
                      </div>
                      <span className="font-mono font-bold text-primary">{formatSui(b.prizePool)}</span>
                    </div>
                    <h3 className="font-semibold text-lg">{b.title}</h3>
                    <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                      {b.description || "No description provided."}
                    </p>
                    <div className="border-t border-border mt-4 pt-3 flex items-center justify-between">
                      <span className="text-label-mono text-on-surface-variant">
                        {b.submissionCount} Submission{b.submissionCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-sm font-semibold text-primary inline-flex items-center gap-1">
                        View Details <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Submissions */}
          <TabsContent value="submissions">
            {isLoadingSubmissions ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-on-surface-variant">
                Loading your submissions...
              </div>
            ) : !mySubmissionData || mySubmissionData.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-16 text-center">
                <Search className="size-10 mx-auto text-on-surface-variant mb-4" />
                <h3 className="text-headline-sm mb-2">No submissions yet</h3>
                <p className="text-on-surface-variant max-w-md mx-auto mb-6">
                  Once you submit work to a bounty, your submissions will appear here.
                </p>
                <Link
                  to="/explore"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-md border border-border bg-surface-low text-sm font-semibold hover:border-primary/40 transition"
                >
                  Explore Bounties <ArrowRight className="size-3 ml-1" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {mySubmissionData.map((sub) => (
                  <Link
                    key={sub.id}
                    to="/submission/$bountyId"
                    params={{ bountyId: sub.bountyId }}
                    className="block rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          SUBMITTED
                        </Badge>
                        <span className="text-label-mono text-on-surface-variant">#{sub.bountyId.slice(0, 8)}</span>
                      </div>
                      <span className="text-label-mono text-on-surface-variant text-xs">
                        {sub.submittedAt.toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg">{sub.title}</h3>
                    {sub.description && (
                      <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                        {sub.description}
                      </p>
                    )}
                    <div className="border-t border-border mt-4 pt-3 flex items-center justify-between">
                      <span className="text-label-mono text-on-surface-variant text-xs">
                        Blob: {sub.blobId.slice(0, 16)}...
                      </span>
                      <span className="text-sm font-semibold text-primary inline-flex items-center gap-1">
                        View Bounty <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Judging Queue */}
          <TabsContent value="judging">
            <div className="rounded-lg border border-border bg-card p-16 text-center">
              <Scale className="size-10 mx-auto text-on-surface-variant mb-4" />
              <h3 className="text-headline-sm mb-2">Bounties awaiting your judgment</h3>
              <p className="text-on-surface-variant max-w-md mx-auto mb-6">
                Apply as a judge to review submissions and earn reputation on the platform.
              </p>
              <Link
                to="/judges"
                className="inline-flex items-center justify-center h-10 px-5 rounded-md border border-border bg-surface-low text-sm font-semibold hover:border-primary/40 transition"
              >
                Apply as Judge <ArrowRight className="size-3 ml-1" />
              </Link>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            {notifications.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-16 text-center">
                <Bell className="size-10 mx-auto text-on-surface-variant mb-4" />
                <h3 className="text-headline-sm mb-2">No new notifications</h3>
                <p className="text-on-surface-variant max-w-md mx-auto">
                  You're all caught up. Notifications about your bounties and submissions will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-5 flex items-start gap-4">
                    <div className="size-9 rounded-md bg-primary/10 grid place-items-center text-primary flex-shrink-0">
                      <Bell className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.text}</p>
                      <p className="text-label-mono text-on-surface-variant mt-1">{n.meta} · {n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <SiteFooter compact />
    </div>
  );
}
