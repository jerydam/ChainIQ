// components/ConnectWallet.tsx
'use client';
import { useWallet } from '@/components/context/WalletContext';
import { useWalletConnection } from '@/hook/useWallet';
import { SignInButton } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';

interface ConnectWalletProps {
  className?: string;
}

export function ConnectWallet({ className }: ConnectWalletProps) {
  const { userAddress, isConnected, isFarcaster, error } = useWallet();
  const { connectWallet, disconnectWallet } = useWalletConnection();

  return (
    <div className={className}>
      {isConnected ? (
        <div className="flex items-center space-x-4 bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-semibold">Connected</span>
          </div>
          <span className="text-white font-mono text-sm">
            {userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}
          </span>
          <button
            onClick={disconnectWallet}
            className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : isFarcaster ? (
        <div className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all inline-block">
          <SignInButton onSuccess={connectWallet} />
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all"
        >
          🔗 Connect Wallet
        </button>
      )}
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}