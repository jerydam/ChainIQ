// context/WalletContext.tsx
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface WalletContextType {
  userAddress: string | null;
  username: string | null;
  isConnected: boolean;
  isFarcaster: boolean;
  isMiniApp: boolean;
  error: string | null;
  setWalletState: (state: {
    userAddress: string | null;
    username: string | null;
    isConnected: boolean;
    error: string | null;
  }) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const url = typeof window !== 'undefined' ? new URL(window.location.href) : { searchParams: new URLSearchParams(), pathname: '' };
    const isFarcasterApp = userAgent.includes('warpcast') || url.searchParams.has('farcaster');
    const isMini = url.pathname.startsWith('/mini') || url.searchParams.get('miniApp') === 'true';
    setIsFarcaster(isFarcasterApp);
    setIsMiniApp(isMini);
  }, []);

  const setWalletState = ({
    userAddress,
    username,
    isConnected,
    error,
  }: {
    userAddress: string | null;
    username: string | null;
    isConnected: boolean;
    error: string | null;
  }) => {
    setUserAddress(userAddress);
    setUsername(username ?? null); // Ensure undefined is converted to null
    setIsConnected(isConnected);
    setError(error);
  };

  return (
    <WalletContext.Provider
      value={{
        userAddress,
        username,
        isConnected,
        isFarcaster,
        isMiniApp,
        error,
        setWalletState,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}