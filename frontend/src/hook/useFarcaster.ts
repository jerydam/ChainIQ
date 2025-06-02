// hook/useFarcaster.ts
'use client';
import { useWallet } from '@/components/context/WalletContext';
import { useWalletConnection } from '@/hook/useWallet';

export function useFarcaster() {
  const { userAddress, username, isConnected, isFarcaster, error } = useWallet();
  const { connectWallet, disconnectWallet } = useWalletConnection();

  const connectFarcaster = async () => {
    if (isFarcaster) {
      await connectWallet();
    } else {
      throw new Error('Farcaster authentication is only available in the Farcaster app');
    }
  };

  return {
    userAddress,
    username,
    isConnected,
    error,
    connectFarcaster,
    disconnectFarcaster: disconnectWallet,
  };
}