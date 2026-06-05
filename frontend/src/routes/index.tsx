import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, EyeOff, Box, RefreshCw, ArrowRight, Droplet, Cloud, FileText, Plus, ArrowLeftRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useOnChainBounties } from "../hooks/useOnChainBounties";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qually — Trustless Bounty Infrastructure on Sui" },
      { name: "description", content: "The ultimate decentralized workspace for high-stakes technical work. Trustless locked escrow, cryptographically sealed submissions, persistent storage via Walrus." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: bounties = [], isLoading } = useOnChainBounties();
  const heroBounty = bounties[0];
  const featuredBounties = bounties.slice(0, 5);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative grid-bg-lg border-b border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-label-mono px-3 py-1 rounded-sm bg-primary/10 text-primary border border-primary/20">
              BUILD ON SUI INFRASTRUCTURE
            </span>
            <h1 className="text-display mt-6">
              Trustless Bounty<br />
              <span className="text-primary">Infrastructure</span> on Sui
            </h1>
            <p className="mt-5 text-on-surface-variant max-w-lg leading-relaxed">
              The ultimate decentralized workspace for high-stakes technical work. Featuring trustless locked escrow, cryptographically sealed submissions, and persistent storage via Walrus.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/explore" className="h-12 px-6 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 hover:opacity-90">
                Explore Bounties <ArrowRight className="size-4" />
              </Link>
              <Link to="/post" className="h-12 px-6 rounded-md border border-border bg-card font-semibold inline-flex items-center hover:border-primary/40">
                Post a Bounty
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 mt-8 text-label-mono text-on-surface-variant">
              <span className="inline-flex items-center gap-2"><Lock className="size-3.5" /> LOCKED ESCROW</span>
              <span className="inline-flex items-center gap-2"><FileText className="size-3.5" /> WALRUS STORAGE</span>
              <span className="inline-flex items-center gap-2"><Box className="size-3.5" /> SUI NATIVE</span>
            </div>
          </div>

          {/* Bounty preview card */}
          <div className="relative">
            <div className="rounded-xl border border-border bg-card shadow-[0_8px_40px_-12px_rgba(0,80,180,0.15)] p-6">
              {isLoading ? (
                <div className="space-y-4 py-8">
                  <div className="h-4 rounded bg-surface-container w-1/3" />
                  <div className="h-3 rounded bg-surface-container w-3/4" />
                  <div className="h-3 rounded bg-surface-container w-1/2" />
                </div>
              ) : heroBounty ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-headline-md text-primary truncate max-w-[200px]">{heroBounty.title}</h3>
                      <p className="text-label-mono text-on-surface-variant mt-1">ID: {heroBounty.id.slice(0, 4)}…{heroBounty.id.slice(-4)}</p>
                    </div>
                    <span className="text-label-mono px-2.5 py-1 rounded-sm bg-primary/10 text-primary border border-primary/20 uppercase">{heroBounty.status}</span>
                  </div>
                  <div className="space-y-2 my-5">
                    <p className="text-sm text-on-surface-variant line-clamp-2">{heroBounty.description || "No description provided."}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-border bg-surface-low p-3">
                      <p className="text-label-caps text-on-surface-variant">POOL SIZE</p>
                      <p className="font-mono font-semibold mt-1">{heroBounty.prizePool.toFixed(1)} SUI</p>
                    </div>
                    <div className="rounded-md border border-border bg-surface-low p-3">
                      <p className="text-label-caps text-on-surface-variant">SUBMISSIONS</p>
                      <p className="font-mono font-semibold mt-1">{heroBounty.submissionCount}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-label-mono text-on-surface-variant">No active bounties yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Built for High Stakes */}
      <section className="py-24 border-b border-border">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-headline-lg">Built for High Stakes</h2>
            <p className="mt-3 text-on-surface-variant">Precise, reliable, and secure. Qually leverages Sui's unique object model for unmatched infrastructure performance.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Feature icon={<Lock className="size-5" />} title="Locked Escrow" body="Smart contracts autonomously manage prize pools. Funds are programmatically locked upon bounty creation, ensuring absolute payment guarantee for contributors who meet the criteria." />
            <Feature icon={<EyeOff className="size-5" />} title="Sealed Submissions" body="Protect your IP. Submissions are encrypted and only viewable by verified judges until the bounty cycle completes." />
            <Feature icon={<Box className="size-5" />} title="Proof of Work NFTs" body="Every completion issues a dynamic, soulbound NFT proving technical prowess and contribution history on-chain." />
            <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 flex gap-6">
              <div>
                <div className="size-10 rounded-md bg-primary/10 grid place-items-center text-primary border border-primary/20"><RefreshCw className="size-5" /></div>
                <h3 className="font-semibold mt-4 text-lg">Multi-token Payouts</h3>
                <p className="text-sm text-on-surface-variant mt-2 max-w-md">Powered by LI.FI integration. Pay out in any major stablecoin or native asset, across bridges, with single-click settlement logic.</p>
              </div>
              <div className="ml-auto flex-shrink-0 size-32 rounded-md border-2 border-dashed border-border grid place-items-center bg-surface-low">
                <ArrowLeftRight className="size-7 text-primary/60" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Powering the ecosystem */}
      <section className="py-16 border-b border-border bg-surface-low">
        <div className="mx-auto max-w-[1280px] px-6">
          <p className="text-label-mono text-center text-on-surface-variant mb-8">POWERING THE SUI ECOSYSTEM</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Droplet className="size-5" />, label: "SUI NETWORK" },
              { icon: <Cloud className="size-5" />, label: "WALRUS" },
              { icon: <FileText className="size-5" />, label: "TATUM" },
              { icon: <Plus className="size-5" />, label: "LI.FI" },
            ].map((p) => (
              <div key={p.label} className="aspect-[3/1] rounded-md border border-border bg-card grid place-items-center">
                <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                  <span className="text-primary">{p.icon}</span>
                  <span className="text-label-mono">{p.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live bounties */}
      <section className="py-16">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-headline-lg">Live Bounties</h2>
              <p className="text-on-surface-variant mt-1 text-sm">Secure your spot in technical history.</p>
            </div>
            <Link to="/explore" className="text-label-mono text-primary inline-flex items-center gap-1 hover:underline">VIEW ALL <ArrowRight className="size-3.5" /></Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              [0, 1].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-5">
                  <div className="space-y-2">
                    <div className="h-3 rounded bg-surface-container w-1/4" />
                    <div className="h-4 rounded bg-surface-container w-1/2" />
                    <div className="h-3 rounded bg-surface-container w-1/3" />
                  </div>
                </div>
              ))
            ) : featuredBounties.length > 0 ? (
              featuredBounties.map((b) => {
                const daysLeft = Math.max(0, Math.ceil((b.submissionDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                return (
                  <div key={b.id} className="rounded-lg border border-border bg-card p-5 grid md:grid-cols-[1fr_auto] gap-4 items-center hover:border-primary/40 transition">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-label-mono text-primary">{b.type.toUpperCase()}</span>
                        <span className="text-label-mono text-on-surface-variant">{b.category}</span>
                      </div>
                      <h3 className="font-semibold text-lg">{b.title}</h3>
                      <div className="flex gap-4 mt-2 text-label-mono text-on-surface-variant">
                        <span>⏱ {daysLeft} days left</span>
                        <span>👥 {b.submissionCount} submissions</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-mono font-bold text-primary">{b.prizePool.toFixed(1)} SUI</p>
                      <Link to="/bounty/$id" params={{ id: b.id }} className="text-label-mono px-4 h-9 rounded-md border border-primary text-primary hover:bg-primary/10 inline-flex items-center">APPLY NOW</Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <p className="text-label-mono text-on-surface-variant">No bounties posted yet. Be the first!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="size-10 rounded-md bg-primary/10 grid place-items-center text-primary border border-primary/20">{icon}</div>
      <h3 className="font-semibold mt-4 text-lg">{title}</h3>
      <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">{body}</p>
    </div>
  );
}
