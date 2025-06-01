"use client";
import { useState } from 'react';
import { ethers } from 'ethers';
import type { UserScore } from '@/types/quiz';
import { QuizRewardsABI } from '@/abis/QuizAbi';

interface RewardsPanelProps {
  userScores: UserScore[];
  userAddress: string;
  isConnected: boolean;
}

export function RewardsPanel({ userScores, userAddress, isConnected }: RewardsPanelProps) {
  const [claimingRewards, setClaimingRewards] = useState<string[]>([]);
  const contractAddress = process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS || '';

  const eligibleScores = userScores; // All completed quizzes are eligible for NFT

  const totalRewardsEarned = eligibleScores.length;
  const totalPointsEarned = userScores.reduce((acc, score) => acc + score.score, 0);

  const handleClaimReward = async (scoreId: string) => {
    if (!isConnected) {
      alert('Please connect your wallet to claim rewards.');
      return;
    }

    setClaimingRewards([...claimingRewards, scoreId]);

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet detected');
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, QuizRewardsABI, signer);

      const quizId = scoreId.split('-')[0];
      const gasEstimate = await contract.claimNFTReward.estimateGas(quizId);
      const tx = await contract.claimNFTReward(quizId, {
        gasLimit: BigInt(gasEstimate) * BigInt(120) / BigInt(100),
      });
      await tx.wait();

      alert('NFT reward claimed successfully! 🎉');
    } catch (error: any) {
      console.error('Error claiming NFT reward:', error);
      alert(`Failed to claim NFT reward: ${error.reason || error.message}`);
    }

    setClaimingRewards(claimingRewards.filter(id => id !== scoreId));
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-white mb-6">🏆 Your Rewards</h2>
      
      {!isConnected ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-gray-400 mb-6">Connect your wallet to view and claim your quiz rewards</p>
        </div>
      ) : userScores.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎮</div>
          <h3 className="text-xl font-bold text-white mb-2">No Quiz Results Yet</h3>
          <p className="text-gray-400 mb-6">Complete some quizzes to start earning NFTs!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-2">{totalRewardsEarned}</div>
              <div className="text-white font-semibold">NFTs Earned</div>
              <div className="text-sm text-gray-400">For completed quizzes</div>
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
                    key={`${score.quizId}-${score.completedAt.getTime()}`}
                    className="bg-white/10 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-white">{score.quizTitle}</h4>
                      <p className="text-sm text-gray-400">
                        Score: {score.score}/{score.totalQuestions} ({Math.round((score.score / score.totalQuestions) * 100)}%)
                      </p>
                      <p className="text-xs text-gray-500">
                        Completed: {score.completedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleClaimReward(`${score.quizId}-${score.completedAt.getTime()}`)}
                      disabled={claimingRewards.includes(`${score.quizId}-${score.completedAt.getTime()}`)}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black disabled:from-gray-600 disabled:text-gray-500 font-semibold rounded-full transition-all"
                    >
                      {claimingRewards.includes(`${score.quizId}-${score.completedAt.getTime()}`) ? (
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
                <div
                  key={`${score.quizId}-${score.completedAt.getTime()}`}
                  className="bg-white/10 rounded-lg p-4"
                >
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
          Complete any quiz to earn an NFT reward, minted on the Celo blockchain!
        </p>
      </div>
    </div>
  );
}