'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import type { UserScore } from '@/types/quiz';
import { QuizRewardsABI } from '@/lib/QuizAbi';
import { createWalletClient, custom } from 'viem';
import { celo } from 'viem/chains';
import { sendTransactionWithDivvi } from '@/lib/divvi';
import toast from 'react-hot-toast';

interface RewardsPanelProps {
  userScores: UserScore[];
  userAddress: string | null;
  isConnected: boolean;
}

export function RewardsPanel({ userScores, userAddress, isConnected }: RewardsPanelProps) {
  const [claimingRewards, setClaimingRewards] = useState<string[]>([]);
  const [claimedNFTs, setClaimedNFTs] = useState<{ [quizId: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const contractAddress = process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS || '';
  const CELO_MAINNET_CHAIN_ID = celo.id; // Use viem's celo chain ID

  useEffect(() => {
    const checkClaimedNFTs = async () => {
      if (!isConnected || !userAddress || !contractAddress) {
        setError('Wallet not connected or contract address missing');
        return;
      }
      if (typeof window === 'undefined' || !window.ethereum) {
        setError('No wallet provider detected');
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== CELO_MAINNET_CHAIN_ID) {
          setError('Please switch to Celo Mainnet');
          return;
        }

        const contract = new ethers.Contract(contractAddress, QuizRewardsABI, provider);
        const claimed: { [quizId: string]: boolean } = {};
        for (const score of userScores) {
          const quizId = score.quizId;
          if (!quizId) continue;
          const quizData = await contract.quizzes(quizId);
          if (!quizData.exists) continue;
          const hasCompleted = await contract.hasCompletedQuiz(userAddress, quizId);
          claimed[quizId] = hasCompleted;
        }
        setClaimedNFTs(claimed);
        setError(null);
      } catch (err: any) {
        console.error('Error checking claimed NFTs:', err);
        setError(err.message || 'Failed to check quiz completions');
      }
    };
    checkClaimedNFTs();
  }, [userScores, userAddress, isConnected, contractAddress]);

  const eligibleScores = userScores.filter(
    score => score.score === score.totalQuestions && !claimedNFTs[score.quizId]
  );

  const totalRewardsEarned = userScores.filter(score => score.score === score.totalQuestions).length;
  const totalPointsEarned = userScores.reduce((acc, score) => acc + score.score, 0);

  const handleClaimReward = async (scoreId: string) => {
    if (!isConnected || !userAddress) {
      toast.error('Please connect your wallet to claim rewards.');
      return;
    }
    if (!contractAddress) {
      toast.error('Contract address is not configured.');
      return;
    }
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('No wallet provider detected.');
      return;
    }

    setClaimingRewards(prev => [...prev, scoreId]);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CELO_MAINNET_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CELO_MAINNET_CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError: any) {
          throw new Error('Please switch to Celo Mainnet');
        }
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, QuizRewardsABI, signer);
      const walletClient = createWalletClient({
        chain: celo,
        transport: custom(window.ethereum!),
      });

      console.log('Claiming NFT for quizId:', scoreId, 'on contract:', contractAddress);
      const txHash = await sendTransactionWithDivvi(
        contract,
        'claimNFTReward',
        [scoreId],
        walletClient,
        provider
      );
      console.log('Claim transaction hash:', txHash);

      toast.success('NFT reward claimed successfully! 🎉');
      setClaimedNFTs(prev => ({ ...prev, [scoreId]: true }));
    } catch (err: any) {
      let errorMessage = 'Failed to claim NFT reward';
      if (err.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'Insufficient funds for gas fees. Please fund your wallet with CELO.';
      } else if (err.message.includes('unknown function') || err.message.includes('INVALID_ARGUMENT')) {
        errorMessage = 'Claim function not found. Please verify the contract address and ABI.';
      } else if (err.reason) {
        errorMessage = err.reason;
      } else if (err.message) {
        errorMessage = err.message;
      }
      console.error('Claim error:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setClaimingRewards(prev => prev.filter(id => id !== scoreId));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6">🏆 Your Rewards</h2>
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-400">
          {error}
        </div>
      )}
      {!isConnected ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4" role="img" aria-label="Link emoji">
            🔗
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-gray-400 mb-6">Connect your wallet to view and claim your quiz rewards</p>
        </div>
      ) : userScores.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4" role="img" aria-label="Gamepad emoji">
            🎮
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Quiz Results Yet</h3>
          <p className="text-gray-400 mb-6">Complete some quizzes to start earning NFTs!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-2">{totalRewardsEarned}</div>
              <div className="text-white font-semibold">NFTs Earned</div>
              <div className="text-sm text-gray-400">For perfect scores</div>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">{totalPointsEarned}</div>
              <div className="text-white font-semibold">Total Points</div>
              <div className="text-sm text-gray-400">Across all quizzes</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">{userScores.length}</div>
              <div className="text-white font-semibold">Quizzes Completed</div>
              <div className="text-sm text-gray-400">Keep learning!</div>
            </div>
          </div>
          {eligibleScores.length > 0 && (
            <div className="bg-white/10 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-4">🎁 Claimable NFTs</h3>
              <div className="space-y-3">
                {eligibleScores.map((score) => (
                  <div
                    key={score.quizId}
                    className="bg-white/10 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-white">{score.quizTitle}</h4>
                      <p className="text-sm text-gray-400">
                        Score: {score.score}/{score.totalQuestions} (
                        {Math.round((score.score / score.totalQuestions) * 100)}%)
                      </p>
                      <p className="text-xs text-gray-500">
                        Completed: {score.completedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleClaimReward(score.quizId)}
                      disabled={claimingRewards.includes(score.quizId)}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black disabled:bg-gray-600 disabled:text-gray-400 font-semibold rounded-full transition-all"
                      aria-label={`Claim NFT for ${score.quizTitle}`}
                    >
                      {claimingRewards.includes(score.quizId) ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-200"></div>
                          <span>Claiming...</span>
                        </div>
                      ) : (
                        '🎁 Claim NFT'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">📊 Quiz History</h3>
            <div className="space-y-3">
              {userScores.map((score) => (
                <div key={score.quizId} className="bg-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-white">{score.quizTitle}</h4>
                    <span className="font-bold text-white">
                      {Math.round((score.score / score.totalQuestions) * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-400">
                      {score.score}/{score.totalQuestions} correct answers
                    </p>
                    <p className="text-xs text-gray-500">
                      {score.completedAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="mt-6 bg-blue-500/20 border border-blue-500/50 rounded-xl p-4">
        <h3 className="text-lg font-bold text-white mb-3">ℹ️ Reward System</h3>
        <p className="text-sm text-gray-300">
          Earn an NFT for achieving a perfect score on any quiz, minted on the Celo blockchain!
        </p>
      </div>
    </div>
  );
}