import { useState, useEffect } from "react";
import { Link, createFileRoute, useParams, Outlet, useMatchRoute } from "@tanstack/react-router";
import { Info, Cloud, Link as LinkIcon, BadgeCheck, Lock, Send, Share2, Copy, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useOnChainBounty } from "../hooks/useOnChainBounties";
import { useWallet } from "../hooks/useWallet";
import { PosterActions } from "../components/bounty/PosterActions";

export const Route = createFileRoute("/bounty/$id")({
  head: () => ({
    meta: [
      { title: "Bounty Detail — Qually" },
      { name: "description", content: "View bounty details and submit your work on Qually." },
    ],
  }),
  component: BountyDetail,
});

const STATUS_LABELS: Record<string, string> = {
  open: "OPEN",
  review: "REVIEW",
  closed: "CLOSED",
};

function formatPrizePool(prizePool: number): string {
  return `${prizePool.toLocaleString()} SUI`;
}

function getTimeRemaining(deadline: Date): { days: string; hours: string; minutes: string; seconds: string } {
  const now = Date.now();
  const diff = deadline.getTime() - now;
  if (diff <= 0) return { days: "00", hours: "00", minutes: "00", seconds: "00" };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-10 grid lg:grid-cols-[1fr_320px] gap-8">
          <div className="border-l-2 border-primary/30 pl-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-6 w-32 rounded-sm bg-surface-container animate-pulse" />
              <div className="h-5 w-28 rounded-sm bg-surface-container animate-pulse" />
            </div>
            <div className="h-10 w-96 rounded bg-surface-container animate-pulse mb-3" />
            <div className="h-5 w-80 rounded bg-surface-container animate-pulse" />
          </div>
          <aside className="rounded-lg border border-border bg-card p-5 self-start space-y-3">
            <div className="h-5 w-24 rounded bg-surface-container animate-pulse" />
            <div className="h-8 w-32 rounded bg-surface-container animate-pulse" />
            <div className="border-t border-border pt-3">
              <div className="h-5 w-28 rounded bg-surface-container animate-pulse" />
            </div>
          </aside>
        </div>
      </section>
      <div className="mx-auto max-w-[1280px] px-6 py-10 grid lg:grid-cols-[260px_1fr_280px] gap-6">
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="h-5 w-32 rounded bg-surface-container animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-md bg-surface-container animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-surface-container animate-pulse" />
                <div className="h-3 w-24 rounded bg-surface-container animate-pulse" />
              </div>
            </div>
          </div>
        </aside>
        <main className="rounded-lg border border-border bg-card min-h-[400px]">
          <div className="p-6 space-y-4">
            <div className="h-6 w-48 rounded bg-surface-container animate-pulse" />
            <div className="h-4 w-full rounded bg-surface-container animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-surface-container animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-surface-container animate-pulse" />
          </div>
        </main>
        <aside className="space-y-4">
          <div className="h-12 rounded-md bg-surface-container animate-pulse" />
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="h-5 w-36 rounded bg-surface-container animate-pulse" />
            <div className="h-4 w-full rounded bg-surface-container animate-pulse" />
            <div className="h-4 w-full rounded bg-surface-container animate-pulse" />
          </div>
        </aside>
      </div>
      <SiteFooter compact />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1280px] px-6 py-20 text-center space-y-6">
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

function BountyDetail() {
  const { id } = useParams({ from: "/bounty/$id" });
  const matchRoute = useMatchRoute();
  const isChildRoute = matchRoute({ to: "/bounty/$id/submit", fuzzy: true });
  const { data: bounty, isLoading } = useOnChainBounty(id);
  const [activeTab, setActiveTab] = useState<"brief" | "submissions" | "timeline">("brief");
  const [copied, setCopied] = useState(false);
  const { address } = useWallet();
  const [time, setTime] = useState({ days: "00", hours: "00", minutes: "00", seconds: "00" });

  useEffect(() => {
    if (!bounty) return;
    setTime(getTimeRemaining(bounty.submissionDeadline));
    const interval = setInterval(() => {
      setTime(getTimeRemaining(bounty.submissionDeadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [bounty?.submissionDeadline]);

  if (isChildRoute) {
    return <Outlet />;
  }

  if (isLoading) return <SkeletonLoader />;
  if (!bounty) return <NotFound />;

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: bounty!.title, url: window.location.href });
    } else {
      handleCopy();
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Title bar */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-10 grid lg:grid-cols-[1fr_320px] gap-8">
          <div className="border-l-2 border-primary pl-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-label-mono px-2.5 py-1 rounded-sm bg-primary/10 text-primary border border-primary/20">
                {STATUS_LABELS[bounty.status] ?? "OPEN"}
              </span>
              <span className="text-label-mono text-on-surface-variant">
                ID: {bounty.id.slice(0, 8)}-{bounty.type.toUpperCase().slice(0, 3)}
              </span>
            </div>
            <h1 className="text-display">{bounty.title}</h1>
            <p className="mt-3 text-on-surface-variant max-w-2xl">{bounty.description || "No description available."}</p>
          </div>
          <aside className="rounded-lg border border-border bg-card p-5 self-start">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-on-surface-variant">Prize Pool</span>
              <span className="font-mono font-bold text-primary text-xl">{formatPrizePool(bounty.prizePool)}</span>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">Time Remaining</span>
              {time.days === "00" && time.hours === "00" && time.minutes === "00" && time.seconds === "00" ? (
                <span className="text-sm font-mono font-bold text-destructive">EXPIRED</span>
              ) : (
                <div className="flex gap-2">
                  {[[time.days, "DAYS"], [time.hours, "HRS"], [time.minutes, "MIN"], [time.seconds, "SEC"]].map(([n, l], i, a) => (
                    <div key={l} className="flex items-center gap-2">
                      <div className="text-center">
                        <div className="font-mono font-bold text-lg">{n}</div>
                        <div className="text-label-caps text-on-surface-variant">{l}</div>
                      </div>
                      {i < a.length - 1 && <span className="text-on-surface-variant">:</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-6 py-10 grid lg:grid-cols-[260px_1fr_280px] gap-6">
        {/* Left column */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Poster Profile</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-md bg-primary/10 border border-primary/20 grid place-items-center text-primary"><Cloud className="size-5" /></div>
              <div>
                <p className="font-semibold text-sm">{truncateAddress(bounty.posterAddress)}</p>
                <p className="text-label-mono text-on-surface-variant">Verified Poster</p>
              </div>
            </div>
            <div className="border-t border-border pt-3 space-y-2 text-sm">
              {[["Reputation", `${bounty.posterReputation}%`], ["Payout Rate", "100%"], ["Bounties Run", "14"]].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-on-surface-variant">{k}</span>
                  <span className="font-mono font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Review Panel</h3>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-md bg-surface-container grid place-items-center text-primary"><ShieldCheck className="size-4" /></div>
              <div>
                <p className="text-sm font-semibold">Community Tier-1</p>
                <p className="text-label-mono text-on-surface-variant">3 Technical Judges</p>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant italic mt-4 leading-relaxed">"This bounty is reviewed by the Sui Core Community Steering Committee to ensure technical accuracy."</p>
          </div>
        </aside>

        {/* Center */}
        <main className="rounded-lg border border-border bg-card">
          <div className="flex items-center border-b border-border px-6">
            {[
              { key: "brief" as const, label: "Brief", lock: false },
              { key: "submissions" as const, label: "Submissions", lock: true },
              { key: "timeline" as const, label: "Timeline", lock: false },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`py-4 px-5 text-sm font-semibold relative inline-flex items-center gap-2 ${activeTab === t.key ? "text-primary" : "text-on-surface-variant hover:text-foreground"}`}
              >
                {t.label}{t.lock && <Lock className="size-3.5" />}
                {activeTab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            ))}
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {activeTab === "brief" && (
              <>
                <div className="flex items-start gap-3 rounded-md bg-primary/5 border border-primary/15 p-4 text-sm">
                  <Info className="size-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="font-mono text-primary">This document is cryptographically served from Walrus Decentralized Storage.</p>
                </div>

                <section>
                  <h2 className="text-headline-md mb-3">Project Overview</h2>
                  <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">{bounty.description || "No description available."}</p>
                </section>
              </>
            )}

            {activeTab === "submissions" && (
              <div className="py-16 text-center space-y-4">
                <Lock className="size-10 text-on-surface-variant mx-auto" />
                <h2 className="text-headline-md">Submissions are sealed</h2>
                <p className="text-on-surface-variant max-w-md mx-auto">Submissions are sealed until judging begins. Check back after the submission deadline.</p>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="py-16 text-center space-y-4">
                <h2 className="text-headline-md">Timeline coming soon</h2>
                <p className="text-on-surface-variant max-w-md mx-auto">Detailed timeline and milestone tracking will be available here.</p>
              </div>
            )}
          </div>
        </main>

        {/* Right column */}
        <aside className="space-y-4">
          <Link
            to="/bounty/$id/submit"
            params={{ id }}
            className="w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90"
          >
            <Send className="size-4" /> Submit Work
          </Link>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Technical Metadata</h3>
            <h4 className="text-label-caps text-on-surface-variant mb-2">RESOURCE LINKS</h4>
            <ul className="space-y-2 mb-5">
              {["Walrus Docs (Official)", "GitHub Reference Repo", "Architecture Diagram"].map((l) => (
                <li key={l}><a href="#" className="text-sm text-primary inline-flex items-center gap-2 hover:underline"><LinkIcon className="size-3.5" /> {l}</a></li>
              ))}
            </ul>
            <h4 className="text-label-caps text-on-surface-variant mb-2">TECH STACK TAGGING</h4>
            <div className="flex flex-wrap gap-2 mb-5">
              {[bounty.category, bounty.type].filter(Boolean).map((t) => (
                <span key={t} className="text-label-mono px-2.5 py-1 rounded-sm border border-border bg-surface-low">{t}</span>
              ))}
            </div>
            <h4 className="text-label-caps text-on-surface-variant mb-2">GOVERNANCE VERIFICATION</h4>
            <div className="rounded-md border border-border bg-primary/5 p-4 grid place-items-center text-center">
              <BadgeCheck className="size-8 text-primary" />
              <p className="text-label-mono mt-2 text-on-surface-variant">Secured by Sui Smart Contract</p>
              <p className="text-label-mono text-on-surface-variant">{truncateAddress(bounty.id)}</p>
              <div className="w-full h-1 rounded-full bg-primary mt-3" />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-on-surface-variant">Share this Bounty:</span>
            <div className="flex gap-2">
              <button onClick={handleShare} className="size-8 rounded-md border border-border grid place-items-center hover:border-primary/40"><Share2 className="size-3.5" /></button>
              <button onClick={handleCopy} className="size-8 rounded-md border border-border grid place-items-center hover:border-primary/40">
                {copied ? <BadgeCheck className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Poster Actions - only shown to the bounty poster */}
          {address === bounty.posterAddress && (
            <PosterActions bounty={bounty} />
          )}
        </aside>
      </div>

      <SiteFooter compact />
    </div>
  );
}
