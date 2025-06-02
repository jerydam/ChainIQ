// app/layout.tsx
'use client';
import './globals.css';
import { WalletProvider } from '@/components/context/WalletContext';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { celoAlfajores } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Create a QueryClient instance
const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [celoAlfajores],
  connectors: [injected()],
  transports: {
    [celoAlfajores.id]: http(),
  },
  storage: null, // Disable persistence to avoid serialization issues
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <WalletProvider>{children}</WalletProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}