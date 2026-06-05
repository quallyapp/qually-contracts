import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Users, Gavel, Crown, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useOnChainBounties } from "../hooks/useOnChainBounties";
import { getNickname } from "../lib/user-profiles";
import type { Bounty } from "../types";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Qually" },
      { name: "description", content: "See the top hunters, posters, and judges on Qually's decentralized bounty platform." },
    ],
  }),
  component: LeaderboardPage,
});

type Tab = "hunters" | "posters" | "judges";
type Period = "all" | "30d" | "7d";

function truncateAddress(addr: string) {
  if (!addr || addr.length < 10) return addr || "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function periodCutoff(period: Period): Date {
  const now = Date.now();
  if (period === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return new Date(0);
}

function rankMedal(rank: number) {
  if (rank === 1) return <span className="text-yellow-500 font-bold">🥇</span>;
  if (rank === 2) return <span className="text-gray-400 font-bold">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 font-bold">🥉</span>;
  return <span className="text-on-surface-variant font-mono text-sm w-6 text-center">{rank}</span>;
}

function rankColor(rank: number) {
  if (rank === 1) return "border-yellow-500/40 bg-yellow-500/5";
  if (rank === 2) return "border-gray-400/30 bg-gray-400/5";
  if (rank === 3) return "border-amber-600/30 bg-amber-600/5";
  return "border-border bg-card";
}

interface LeaderboardEntry {
  address: string;
  stat: number;
  statLabel: string;
  extra?: string;
}

function computePosters(bounties: Bounty[], period: Period): LeaderboardEntry[] {
  const cutoff = periodCutoff(period);
  const filtered = bounties.filter((b) => b.createdAt >= cutoff);

  const map = new Map<string, { count: number; totalSui: number }>();
  for (const b of filtered) {
    const existing = map.get(b.posterAddress) ?? { count: 0, totalSui: 0 };
    existing.count += 1;
    existing.totalSui += b.prizePool;
    map.set(b.posterAddress, existing);
  }

  return Array.from(map.entries())
    .map(([addr, data]) => ({
      address: addr,
      stat: data.count,
      statLabel: `${data.count} bount${data.count === 1 ? "y" : "ies"}`,
      extra: `${data.totalSui.toLocaleString()} SUI escrowed`,
    }))
    .sort((a, b) => b.stat - a.stat);
}

function LeaderboardPage() {
  const { data: rawBounties = [], isLoading } = useOnChainBounties();
  const [activeTab, setActiveTab] = useState<Tab>("hunters");
  const [activePeriod, setActivePeriod] = useState<Period>("all");

  const posterData = useMemo(() => computePosters(rawBounties, activePeriod), [rawBounties, activePeriod]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "hunters", label: "Hunters", icon: <Trophy className="size-4" /> },
    { key: "posters", label: "Posters", icon: <Users className="size-4" /> },
    { key: "judges", label: "Judges", icon: <Gavel className="size-4" /> },
  ];

  const periods: { key: Period; label: string }[] = [
    { key: "all", label: "All Time" },
    { key: "30d", label: "30 Days" },
    { key: "7d", label: "7 Days" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="grid-bg-lg border-b border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-14">
          <h1 className="text-display">Leaderboard</h1>
          <p className="mt-3 text-on-surface-variant max-w-2xl">
            Top contributors across the Qually ecosystem. Earn your spot among the best.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 py-10">
        {/* Tabs */}
        <div className="flex items-center gap-1 border border-border rounded-lg bg-card p-1 w-fit mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 h-10 px-5 rounded-md text-sm font-semibold transition ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-on-surface-variant hover:text-foreground hover:bg-accent"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Period filters */}
        <div className="flex items-center gap-2 mb-8">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePeriod(p.key)}
              className={`h-8 px-4 rounded-md text-xs font-semibold border transition ${
                activePeriod === p.key
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border bg-card text-on-surface-variant hover:border-primary/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-on-surface-variant gap-3">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading leaderboard data…</span>
          </div>
        )}

        {/* Empty */}
        {!isLoading && rawBounties.length === 0 && (
          <div className="text-center py-20 text-on-surface-variant">
            <Trophy className="size-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold mb-1">No data yet</p>
            <p className="text-sm">Bounties will appear here once they are posted on-chain.</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && rawBounties.length > 0 && activeTab === "hunters" && (
          <div className="text-center py-20 text-on-surface-variant">
            <Trophy className="size-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold mb-1">Hunter rankings coming soon</p>
            <p className="text-sm">Submission data will be tracked on-chain to rank hunters by earnings.</p>
          </div>
        )}

        {!isLoading && rawBounties.length > 0 && activeTab === "judges" && (
          <div className="text-center py-20 text-on-surface-variant">
            <Gavel className="size-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold mb-1">Judge rankings coming soon</p>
            <p className="text-sm">Judge performance data will be available after judging is integrated.</p>
          </div>
        )}

        {!isLoading && rawBounties.length > 0 && activeTab === "posters" && (
          <div>
            {posterData.length === 0 ? (
              <div className="text-center py-20 text-on-surface-variant">
                <Users className="size-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-semibold mb-1">No posters yet</p>
                <p className="text-sm">Posters will appear here once bounties are created.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posterData.map((entry, i) => {
                  const rank = i + 1;
                  return (
                    <div
                      key={entry.address}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition hover:shadow-[0_2px_12px_-2px_rgba(0,80,180,0.06)] ${rankColor(rank)}`}
                    >
                      <div className="w-8 flex-shrink-0 flex items-center justify-center">
                        {rankMedal(rank)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-semibold truncate">{getNickname(entry.address)}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{entry.statLabel}</p>
                      </div>
                      {entry.extra && (
                        <span className="text-xs text-on-surface-variant font-mono flex-shrink-0">
                          {entry.extra}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
