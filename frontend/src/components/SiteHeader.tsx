import { Link, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { getNickname } from "../lib/user-profiles";

const nav = [
  { to: "/explore", label: "Explore" },
  { to: "/create", label: "Create Bounty" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/judges", label: "Judges" },
  { to: "/judging", label: "Judging Queue" },
];

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function SiteHeader({ showSearch = false }: { showSearch?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-[1280px] px-6 h-16 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary/10 grid place-items-center border border-primary/20">
            <div className="size-3 rounded-sm bg-primary rotate-45" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Qually</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {nav.map((n) => {
            const active = path === n.to || (n.to !== "/" && path.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`relative py-1 transition-colors ${active ? "text-primary font-semibold" : "text-on-surface-variant hover:text-foreground"}`}
              >
                {n.label}
                {active && <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </Link>
            );
          })}
          {mounted && <DashboardLink />}
        </nav>
        <div className="flex-1" />
        {showSearch && (
          <div className="hidden md:flex items-center gap-2 px-3 h-10 w-72 rounded-md border border-border bg-card text-sm text-on-surface-variant">
            <Search className="size-4" />
            <span>Search bounties…</span>
          </div>
        )}
        {mounted ? <WalletButton /> : (
          <button className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}

function DashboardLink() {
  const { connected } = useWallet();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!connected) return null;
  return (
    <Link
      to="/dashboard"
      className={`relative py-1 transition-colors ${path === "/dashboard" ? "text-primary font-semibold" : "text-on-surface-variant hover:text-foreground"}`}
    >
      Dashboard
      {path === "/dashboard" && <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
    </Link>
  );
}

function WalletButton() {
  const { connected, address, connecting, connect, disconnect } = useWallet();
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    if (connected && address) {
      const name = getNickname(address);
      setNickname(name !== truncateAddress(address) ? name : null);
    } else {
      setNickname(null);
    }
  }, [connected, address]);

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <Link to="/profile/$address" params={{ address: address! }} className="text-sm font-mono text-on-surface-variant hover:text-primary transition-colors">
          {nickname || truncateAddress(address!)}
        </Link>
        <button
          onClick={disconnect}
          className="h-10 px-4 rounded-md border border-border text-sm font-semibold hover:bg-accent transition"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
    >
      {connecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
