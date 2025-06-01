"use client";
import { useState } from 'react';
import { ethers } from 'ethers';

interface ConnectWalletProps {
  isConnected: boolean;
  onConnect: (connected: boolean) => void;
  userAddress: string;
  onAddressChange: (address: string) => void;
}

export function ConnectWallet({ isConnected, onConnect, userAddress, onAddressChange }: ConnectWalletProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        alert('Please install MetaMask or another Celo-compatible wallet.');
        setIsConnecting(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const network = await provider.getNetwork();
      if (network.chainId.toString() !== '44787') {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaef3' }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0xaef3',
                  chainName: 'Celo Alfajores Testnet',
                  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
                  rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
                  blockExplorerUrls: ['https://alfajores-blockscout.celo-testnet.org'],
                },
              ],
            });
          } else {
            alert('Please switch to the Celo Alfajores testnet.');
            setIsConnecting(false);
            return;
          }
        }
      }

      onAddressChange(address);
      onConnect(true);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet.');
    }
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    onConnect(false);
    onAddressChange('');
  };

  if (isConnected) {
    return (
      <div className="flex items-center space-x-4 bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400 font-semibold">Connected</span>
        </div>
        <span className="text-white font-mono text-sm">
          {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
        </span>
        <button
          onClick={handleDisconnect}
          className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all"
    >
      {isConnecting ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Connecting...</span>
        </div>
      ) : (
        '🔗 Connect Wallet'
      )}
    </button>
  );
}