// app/layout.tsx
'use client';
import './globals.css';
import { WalletProvider } from '@/components/context/WalletContext';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { celoAlfajores } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useMemo } from 'react';

// Create a QueryClient instance
const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: ReactNode }) {
  // Define wagmiConfig inside the component using useMemo to prevent recreation on every render
  const wagmiConfig = useMemo(
    () =>
      createConfig({
        chains: [celoAlfajores],
        connectors: [injected()],
        transports: {
          [celoAlfajores.id]: http(),
        },
        storage: null, // Disable persistence to avoid serialization issues
      }),
    [] // Empty dependency array ensures it’s created once
  );

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