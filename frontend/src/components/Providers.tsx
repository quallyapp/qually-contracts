"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { WalletProvider, SuiClientProvider, useCurrentAccount, useConnectWallet, useDisconnectWallet, useWallets, useSuiClient, useSignTransaction, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Toaster } from "@/components/ui/sonner";
import { WalletContext, type WalletState } from "@/hooks/useWallet";

interface DappKitState {
  account: ReturnType<typeof useCurrentAccount>;
  suiClient: ReturnType<typeof useSuiClient>;
  signTransaction: ReturnType<typeof useSignTransaction>["mutateAsync"];
  signAndExecute: ReturnType<typeof useSignAndExecuteTransaction>["mutateAsync"];
}

const DappKitContext = createContext<DappKitState | null>(null);

export function useDappKit(): DappKitState {
  const ctx = useContext(DappKitContext);
  if (!ctx) {
    // SSR-safe fallback: return stubs that won't crash during server rendering.
    // Actual values are provided by DappKitBridge after client mount.
    return {
      account: null,
      suiClient: null as any,
      signTransaction: async () => { throw new Error("Wallet not connected (SSR)"); },
      signAndExecute: async () => { throw new Error("Wallet not connected (SSR)"); },
    };
  }
  return ctx;
}

const networks = {
  testnet: { url: "https://fullnode.testnet.sui.io:443", network: "testnet" as const },
};

function DappKitBridge({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const value: DappKitState = { account, suiClient, signTransaction, signAndExecute };

  return (
    <DappKitContext.Provider value={value}>
      {children}
    </DappKitContext.Provider>
  );
}

function WalletStateBridge({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutateAsync: connectWallet, isPending: connecting } = useConnectWallet();
  const { mutateAsync: disconnectWallet } = useDisconnectWallet();

  const connect = useCallback(async () => {
    if (wallets.length > 0) {
      await connectWallet({ wallet: wallets[0] });
    }
  }, [connectWallet, wallets]);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
  }, [disconnectWallet]);

  const value: WalletState = {
    connected: !!account,
    address: account?.address ?? null,
    connecting,
    connect,
    disconnect,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function Providers({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {mounted ? (
        <SuiClientProvider networks={networks} defaultNetwork="testnet">
          <WalletProvider>
            <WalletStateBridge>
              <DappKitBridge>
                {children}
                <Toaster />
              </DappKitBridge>
            </WalletStateBridge>
          </WalletProvider>
        </SuiClientProvider>
      ) : (
        <WalletContext.Provider value={{
          connected: false,
          address: null,
          connecting: false,
          connect: async () => {},
          disconnect: async () => {},
        }}>
          {children}
          <Toaster />
        </WalletContext.Provider>
      )}
    </QueryClientProvider>
  );
}
