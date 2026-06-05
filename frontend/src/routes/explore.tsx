import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Landmark, Network, FileEdit, Box } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useOnChainBounties } from "../hooks/useOnChainBounties";
import { getNickname } from "../lib/user-profiles";
import type { Bounty } from "../types";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore Bounties — Qually" },
      { name: "description", content: "Browse open technical bounties on the Sui Network. Filter by type, category, and status." },
    ],
  }),
  component: Explore,
});

const PAGE_SIZE = 6;

const typeStyles: Record<string, string> = {
  fixed: "bg-primary/10 text-primary border-primary/20",
  contest: "bg-surface-container text-on-surface-variant border-border",
  grant: "bg-surface-container text-on-surface-variant border-border",
};

const typeIcons: Record<string, React.ReactNode> = {
  fixed: <Landmark className="size-5" />,
  contest: <Network className="size-5" />,
  grant: <Box className="size-5" />,
};

const sortOptions = [
  { value: "newest" as const, label: "Newest" },
  { value: "prize-high" as const, label: "Highest Prize" },
  { value: "prize-low" as const, label: "Lowest Prize" },
  { value: "deadline" as const, label: "Deadline" },
];

function truncateAddress(addr: string) {
  if (!addr || addr.length < 10) return addr || "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function daysRemaining(deadline: Date) {
  return Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function Explore() {
  const { data: rawBounties = [], isLoading } = useOnChainBounties();

  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"newest" | "prize-high" | "prize-low" | "deadline">("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredBounties = useMemo(() => {
    let result = [...rawBounties];

    if (typeFilter) {
      result = result.filter((b) => b.type === typeFilter);
    }
    if (statusFilter) {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (categoryFilter) {
      result = result.filter((b) => b.category === categoryFilter);
    }

    switch (sortMode) {
      case "newest":
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "prize-high":
        result.sort((a, b) => b.prizePool - a.prizePool);
        break;
      case "prize-low":
        result.sort((a, b) => a.prizePool - b.prizePool);
        break;
      case "deadline":
        result.sort((a, b) => a.submissionDeadline.getTime() - b.submissionDeadline.getTime());
        break;
    }

    return result;
  }, [rawBounties, typeFilter, statusFilter, categoryFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredBounties.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pagedBounties = filteredBounties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activityItems = useMemo(() => {
    return rawBounties.slice(0, 5).map((b, i) => {
      const timeAgo = `${i + 1} min${i > 0 ? "s" : ""} ago`;
      if (b.submissionCount > 0) {
        return { addr: getNickname(b.posterAddress), action: "posted", obj: b.title, time: timeAgo };
      }
      return { addr: getNickname(b.posterAddress), action: "created", obj: `${b.prizePool} SUI bounty`, time: timeAgo };
    });
  }, [rawBounties]);

  const handleTypeFilter = (type: string) => {
    setTypeFilter((prev) => (prev === type ? null : type));
    setCurrentPage(1);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter((prev) => (prev === status ? null : status));
    setCurrentPage(1);
  };

  const handleCategoryFilter = (cat: string) => {
    setCategoryFilter((prev) => (prev === cat ? null : cat));
    setCurrentPage(1);
  };

  const handleSortCycle = () => {
    setSortMode((prev) => {
      const idx = sortOptions.findIndex((o) => o.value === prev);
      return sortOptions[(idx + 1) % sortOptions.length].value;
    });
    setCurrentPage(1);
  };

  const pageNumbers = useMemo(() => {
    const nums: (string | number)[] = [];
    if (page > 1) nums.push("‹");
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        nums.push(i);
      } else if (nums[nums.length - 1] !== "…") {
        nums.push("…");
      }
    }
    if (page < totalPages) nums.push("›");
    return nums;
  }, [page, totalPages]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader showSearch />

      <div className="grid-bg-lg border-b border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-14">
          <h1 className="text-display">Find Your Next Contribution</h1>
          <p className="mt-3 text-on-surface-variant max-w-2xl">The decentralized engine for Sui development. Solve problems, earn SUI, build the future.</p>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 py-10 grid lg:grid-cols-[260px_1fr] gap-8">
        {/* Filters */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-label-caps text-on-surface-variant mb-4">Filters</h3>

            <FilterGroup
              title="Bounty Type"
              items={[
                { label: "Fixed Reward", value: "fixed" },
                { label: "Contest", value: "contest" },
                { label: "Grant", value: "grant" },
              ]}
              checked={typeFilter}
              onChange={handleTypeFilter}
            />
            <FilterGroup
              title="Category"
              items={[
                { label: "Move Smart Contracts", value: "Move" },
                { label: "Frontend (UI/UX)", value: "Frontend" },
                { label: "Technical Writing", value: "Writing" },
              ]}
              checked={categoryFilter}
              onChange={handleCategoryFilter}
            />
            <FilterGroup
              title="Status"
              radio
              items={[
                { label: "Open Bounties", value: "open" },
                { label: "In Review", value: "review" },
              ]}
              checked={statusFilter}
              onChange={handleStatusFilter}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-label-caps text-primary mb-4 flex items-center gap-2"><span className="size-2 rounded-full bg-primary animate-pulse" /> LIVE ACTIVITY</h3>
            <ul className="space-y-4 text-sm">
              {activityItems.map((a, i) => (
                <li key={i}>
                  <p><span className="font-mono text-primary">{a.addr}</span> <span className="text-on-surface-variant">{a.action}</span> <span className="font-semibold">{a.obj}</span></p>
                  <p className="text-xs text-on-surface-variant mt-1">{a.time}</p>
                </li>
              ))}
              {activityItems.length === 0 && (
                <li className="text-on-surface-variant text-xs">No recent activity</li>
              )}
            </ul>
          </div>
        </aside>

        {/* List */}
        <main>
          <div className="flex items-center justify-between mb-5">
            <p className="text-label-mono text-on-surface-variant">DISPLAYING {filteredBounties.length} OPEN BOUNTIES</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-on-surface-variant">Sort by:</span>
              <button onClick={handleSortCycle} className="h-9 px-3 rounded-md border border-border bg-card font-semibold">{sortOptions.find((o) => o.value === sortMode)?.label} ▾</button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <article key={i} className="rounded-lg border border-border bg-card p-5 border-l-2 border-l-primary animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-label-mono px-2.5 py-1 rounded-sm border bg-surface-container h-6 w-20" />
                  <div className="text-right">
                    <div className="font-mono font-bold text-primary text-lg h-6 w-24 bg-primary/10 rounded" />
                    <div className="text-label-caps text-on-surface-variant h-4 w-20 bg-surface-container rounded mt-1" />
                  </div>
                </div>
                <div className="h-5 w-3/4 bg-surface-container rounded mb-2" />
                <div className="h-4 w-full bg-surface-container/50 rounded mb-1" />
                <div className="h-4 w-2/3 bg-surface-container/50 rounded" />
              </article>
            ))}

            {!isLoading && pagedBounties.length === 0 && (
              <div className="col-span-2 text-center py-16 text-on-surface-variant">
                <p className="text-lg font-semibold mb-1">No bounties found</p>
                <p className="text-sm">Try adjusting your filters or check back later.</p>
              </div>
            )}

            {!isLoading && pagedBounties.map((b) => (
              <article key={b.id} className="rounded-lg border border-border bg-card p-5 border-l-2 border-l-primary hover:shadow-[0_4px_20px_-2px_rgba(0,80,180,0.08)] transition">
                <div className="flex items-start justify-between mb-4">
                  <span className={`text-label-mono px-2.5 py-1 rounded-sm border ${typeStyles[b.type]}`}>{b.type.toUpperCase()}</span>
                  <div className="text-right">
                    <p className="font-mono font-bold text-primary text-lg">{b.prizePool.toLocaleString()} SUI</p>
                    <p className="text-label-caps text-on-surface-variant">{b.type === "grant" ? "MILESTONE BASED" : b.type === "contest" ? "PRIZE POOL" : "TOTAL REWARD"}</p>
                  </div>
                </div>
                <h3 className="font-semibold text-lg leading-snug">{b.title}</h3>
                <p className="text-sm text-on-surface-variant mt-2 leading-relaxed line-clamp-2">{b.description}</p>
                <div className="border-t border-border mt-5 pt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-md bg-primary/10 border border-primary/20 grid place-items-center text-primary flex-shrink-0">{typeIcons[b.type]}</div>
                    <div className="min-w-0">
                      <Link to="/profile/$address" params={{ address: b.posterAddress }} className="text-label-mono truncate hover:text-primary transition-colors">
                        {getNickname(b.posterAddress)}
                      </Link>
                      <p className="text-xs text-on-surface-variant truncate">{b.submissionCount} submission{b.submissionCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-label-mono text-on-surface-variant inline-flex items-center gap-1"><Clock className="size-3" /> {daysRemaining(b.submissionDeadline)}d Left</p>
                    <Link to="/bounty/$id" params={{ id: b.id }} className="text-label-mono text-primary inline-flex items-center gap-1 mt-1 hover:underline">VIEW BOUNTY <ArrowRight className="size-3" /></Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-10">
            {pageNumbers.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  if (p === "‹" && page > 1) setCurrentPage(page - 1);
                  else if (p === "›" && page < totalPages) setCurrentPage(page + 1);
                  else if (typeof p === "number") setCurrentPage(p);
                }}
                disabled={p === "…"}
                className={`size-10 rounded-md border text-sm font-semibold ${p === page ? "border-primary text-primary bg-primary/5" : "border-border bg-card text-on-surface-variant hover:border-primary/40"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}

function FilterGroup({ title, items, radio = false, checked, onChange }: {
  title: string;
  items: { label: string; value: string }[];
  radio?: boolean;
  checked: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="border-t border-border first:border-t-0 pt-4 first:pt-0 mt-4 first:mt-0">
      <h4 className="text-label-caps text-on-surface-variant mb-3">{title}</h4>
      <ul className="space-y-2.5 text-sm">
        {items.map((it) => {
          const isChecked = checked === it.value;
          return (
            <li key={it.value} className="flex items-center gap-2.5 cursor-pointer" onClick={() => onChange(it.value)}>
              <span className={`${radio ? "rounded-full" : "rounded-sm"} size-4 border ${isChecked ? "bg-primary border-primary" : "border-outline"} grid place-items-center flex-shrink-0`}>
                {isChecked && (radio ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : <span className="text-primary-foreground text-[10px] leading-none">✓</span>)}
              </span>
              <span className={isChecked ? "text-foreground" : "text-on-surface-variant"}>{it.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
