// components/FarcasterProvider.tsx
'use client';
import { AuthKitProvider } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';

export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  const config = {
    rpcUrl: process.env.NEXT_PUBLIC_OP_PROVIDER_URL || 'https://mainnet.optimism.io',
    domain: process.env.NEXT_PUBLIC_DOMAIN || 'localhost',
    siweUri: `${process.env.NEXT_PUBLIC_API_URL || 'https://chainiq.vercel.app/'}/login`,
  };

  return <AuthKitProvider config={config}>{children}</AuthKitProvider>;
}