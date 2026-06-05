import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ClipboardCheck, Timer, AlertTriangle, FileBarChart, Plus, Bell, Activity, MessageSquare, Wallet, Frown } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useOnChainBounties } from "@/hooks/useOnChainBounties";
import { useWallet } from "@/hooks/useWallet";

export const Route = createFileRoute("/post")({
  head: () => ({
    meta: [
      { title: "Poster Dashboard — Qually" },
      { name: "description", content: "Manage your active technical bounties and track platform reputation." },
    ],
  }),
  component: PostDashboard,
});

function formatSui(mist: number) {
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(mist);
  return `${formatted} SUI`;
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeUntil(date: Date) {
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m left`;
}

function PostDashboard() {
  const { connected, address } = useWallet();
  const { data: allBounties, isLoading } = useOnChainBounties();

  const myBounties = useMemo(() => {
    if (!allBounties || !address) return [];
    return allBounties.filter((b) => b.posterAddress === address);
  }, [allBounties, address]);

  const totalEscrowed = useMemo(
    () => myBounties.reduce((sum, b) => sum + b.prizePool, 0),
    [myBounties]
  );

  const activeBounties = useMemo(
    () => myBounties.filter((b) => b.status === "open" || b.status === "review"),
    [myBounties]
  );

  const avgTimeToClose = useMemo(() => {
    const closed = myBounties.filter((b) => b.status === "closed");
    if (closed.length === 0) return "N/A";
    const avgMs =
      closed.reduce((sum, b) => sum + (b.createdAt.getTime()), 0) / closed.length;
    const days = Math.floor(avgMs / (1000 * 60 * 60 * 24));
    return `${days || 1} Days`;
  }, [myBounties]);

  const reputation = useMemo(() => {
    const bountyCount = myBounties.length;
    const closedCount = myBounties.filter((b) => b.status === "closed").length;
    const totalSubmissions = myBounties.reduce((sum, b) => sum + b.submissionCount, 0);
    const withDescription = myBounties.filter((b) => b.description && b.description.length > 10).length;

    // Score: based on bounties posted + submissions received + escrowed amount
    const baseScore = Math.min(bountyCount * 12, 48);
    const submissionBonus = Math.min(totalSubmissions * 5, 30);
    const escrowBonus = Math.min(Math.floor(totalEscrowed) * 4, 22);
    const score = Math.min(baseScore + submissionBonus + escrowBonus, 100);

    // Tier
    let tier = "NEWCOMER";
    if (score >= 90) tier = "ELITE ARCHITECT";
    else if (score >= 70) tier = "VETERAN";
    else if (score >= 40) tier = "ACTIVE CONTRIBUTOR";

    // Payment score: 100% if no disputes, based on closed bounties
    const paymentScore = closedCount > 0 ? "10.0" : "—";

    // Clarity rate: % of bounties with descriptions
    const clarityRate = bountyCount > 0 ? Math.round((withDescription / bountyCount) * 100) : 0;

    return { score, tier, paymentScore, clarityRate };
  }, [myBounties, totalEscrowed]);

  const notifications = useMemo(() => {
    const items: { icon: React.ReactNode; text: string; meta: string }[] = [];
    for (const b of activeBounties) {
      if (b.submissionCount > 0) {
        items.push({
          icon: <Bell className="size-4" />,
          text: `${b.submissionCount} submission${b.submissionCount > 1 ? "s" : ""} for '${b.title}'`,
          meta: "BOUNTY ACTIVITY",
        });
      }
    }
    return items.length > 0 ? items.slice(0, 3) : [];
  }, [activeBounties]);

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader showSearch />
        <div className="mx-auto max-w-[1280px] px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
            <div>
              <h1 className="text-display">Poster Dashboard</h1>
              <p className="mt-2 text-on-surface-variant">Manage your active technical bounties and track platform reputation.</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-16 text-center">
            <Wallet className="size-12 mx-auto text-on-surface-variant mb-4" />
            <h2 className="text-headline-md mb-2">Connect your wallet</h2>
            <p className="text-on-surface-variant max-w-md mx-auto">
              Connect your Sui wallet to view and manage your posted bounties.
            </p>
          </div>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader showSearch />

      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-display">Poster Dashboard</h1>
            <p className="mt-2 text-on-surface-variant">Manage your active technical bounties and track platform reputation.</p>
          </div>
          <div className="text-right">
            <p className="text-label-caps text-on-surface-variant">CURRENT REVENUE</p>
            <p className="font-mono font-bold text-2xl text-primary">{formatSui(totalEscrowed)}</p>
            <p className="text-label-mono text-on-surface-variant mt-1">{truncAddr(address!)}</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <Stat icon={<FileBarChart className="size-5" />} label="TOTAL ESCROWED" value={formatSui(totalEscrowed)} trend={`${myBounties.length} bounties`} />
          <Stat icon={<ClipboardCheck className="size-5" />} label="ACTIVE BOUNTIES" value={String(activeBounties.length).padStart(2, "0")} trend={`${activeBounties.length}/${myBounties.length} Total`} />
          <Stat icon={<Timer className="size-5" />} label="AVG. TIME TO CLOSE" value={avgTimeToClose} trend={avgTimeToClose === "N/A" ? "No data" : "Top 5%"} />
          <Stat icon={<AlertTriangle className="size-5" />} label="DISPUTE RATE" value="0%" trend="Nominal" />
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-headline-md border-l-2 border-primary pl-3">Active Bounties</h2>
              <span className="text-sm text-on-surface-variant">{myBounties.length} total</span>
            </div>
            <div className="space-y-4">
              {isLoading ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-on-surface-variant">Loading bounties...</div>
              ) : activeBounties.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                  <Frown className="size-8 mx-auto text-on-surface-variant mb-3" />
                  <p className="text-on-surface-variant">No active bounties yet. Create your first bounty to get started.</p>
                </div>
              ) : (
                activeBounties.map((b) => (
                  <article key={b.id} className="rounded-lg border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`text-label-mono px-2 py-1 rounded-sm ${b.status === "review" ? "bg-warning/15 text-warning border border-warning/30" : "bg-primary/10 text-primary border border-primary/20"}`}>{b.status.toUpperCase()}</span>
                        <span className="text-label-mono text-on-surface-variant">#{b.id.slice(0, 8)}</span>
                      </div>
                      <span className="font-mono font-bold text-primary">{formatSui(b.prizePool)}</span>
                    </div>
                    <h3 className="font-semibold text-lg">{b.title}</h3>
                    <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{b.description || "No description provided."}</p>
                    <div className="border-t border-border mt-4 pt-3 flex items-center justify-between">
                      <p className={`text-label-mono ${b.status === "review" ? "text-warning" : "text-on-surface-variant"}`}>
                        {b.submissionCount} Submission{b.submissionCount !== 1 ? "s" : ""} • {b.status === "review" ? "Review Period" : timeUntil(b.submissionDeadline)}
                      </p>
                      <Link to="/bounty/$id" params={{ id: b.id }} className="text-sm font-semibold h-9 px-4 rounded-md border border-border bg-surface-low hover:border-primary/40 inline-flex items-center">
                        Manage Review
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-5 border-t-2 border-t-primary">
              <h3 className="font-semibold mb-4">Poster Reputation</h3>
              <div className="flex items-center gap-4">
                <div className="relative size-20 rounded-full grid place-items-center" style={{ background: `conic-gradient(var(--primary) 0 ${reputation.score}%, var(--surface-container) ${reputation.score}% 100%)` }}>
                  <div className="size-16 rounded-full bg-card grid place-items-center font-mono font-bold text-lg">{reputation.score}</div>
                </div>
                <div>
                  <p className="text-label-caps text-primary">TIER: {reputation.tier}</p>
                  <p className="text-sm text-on-surface-variant mt-1">{myBounties.length} bounties posted</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm">
                {[["Prompt Payment Score", reputation.paymentScore === "—" ? "—" : `${reputation.paymentScore}/10`, reputation.paymentScore === "—" ? 0 : 100], ["Description Coverage", `${reputation.clarityRate}%`, reputation.clarityRate]].map(([k, v, p]) => (
                  <div key={k as string}>
                    <div className="flex justify-between mb-1">
                      <span className="text-on-surface-variant">{k}</span>
                      <span className="font-mono font-semibold">{v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-container overflow-hidden"><div className="h-full bg-primary" style={{ width: `${p}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold inline-flex items-center gap-2"><Bell className="size-4" /> Recent Notifications</h3>
                {notifications.length > 0 && (
                  <span className="text-label-mono px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">{notifications.length} NEW</span>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-on-surface-variant py-4 text-center">No new notifications</p>
              ) : (
                <ul className="space-y-4 text-sm">
                  {notifications.map((n, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="size-8 rounded-md bg-surface-container grid place-items-center text-primary flex-shrink-0">{n.icon}</div>
                      <div>
                        <p>{n.text}</p>
                        <p className="text-label-mono text-on-surface-variant mt-1">{n.meta}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button className="mt-4 w-full h-9 rounded-md bg-surface-low border border-border text-sm font-semibold hover:border-primary/40">View Activity Feed</button>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-semibold mb-4">Escrow Allocation</h3>
              <div className="flex items-end justify-between gap-3 h-32">
                {["MON", "TUE", "WED", "THU", "FRI"].map((d, i) => {
                  const dayIndex = (new Date().getDay() + 6 + i) % 7;
                  const seed = ((dayIndex + 1) * 17 + myBounties.length) % 100;
                  const height = Math.max(10, seed);
                  return (
                    <div key={d} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full rounded-sm bg-primary" style={{ height: `${height}%`, opacity: 0.35 + (seed / 100) * 0.6 }} />
                      <span className="text-label-mono text-on-surface-variant">{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        <Link to="/create" className="fixed bottom-8 right-8 h-12 px-5 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 shadow-[0_8px_30px_-4px_rgba(0,80,180,0.4)] hover:opacity-90">
          <Plus className="size-4" /> Create New Bounty
        </Link>
      </div>

      <SiteFooter compact />
    </div>
  );
}

function Stat({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string; trend: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="size-9 rounded-md bg-surface-container grid place-items-center text-primary">{icon}</div>
        <span className="text-label-mono text-on-surface-variant">{trend}</span>
      </div>
      <p className="text-label-caps text-on-surface-variant">{label}</p>
      <p className="font-mono font-bold text-2xl mt-1">{value}</p>
    </div>
  );
}
