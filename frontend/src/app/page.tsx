"use client";
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import QuizPlayer from '@/components/QuizPlayer';
import { QuizGenerator } from '@/components/QuizGenerator';
import { ConnectWallet } from '@/components/ConnectWallet';
import { ShareToWarpcast } from '@/components/ShareToWarpcast';
import Link from 'next/link';
import type { Quiz } from '@/types/quiz';
import { useWallet } from '@/components/context/WalletContext';
import { QuizRewardsABI } from '@/lib/QuizAbi'; // Consistent with RewardsPanel.tsx
import { createWalletClient, custom } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';
import { sendTransactionWithDivvi } from '@/lib/divvi';
import toast from 'react-hot-toast';

export default function Home() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [participation, setParticipation] = useState<{ [quizId: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const contractAddress: string = process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS || '';
  const { userAddress, username, isConnected, error: walletError } = useWallet();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const response = await fetch('/api/quizzes');
      if (!response.ok) {
        throw new Error(`Failed to fetch quizzes: ${response.status}`);
      }
      const data = await response.json();
      setQuizzes(data);
    } catch (err: any) {
      const errorMessage = 'Failed to fetch quizzes: ' + err.message;
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const checkParticipation = async (quizId: string) => {
    if (!userAddress) return false;
    try {
      const quizResponse = await fetch(`/api/quizzes?id=${quizId}`);
      if (!quizResponse.ok) {
        console.warn(`Quiz ${quizId} not found: ${quizResponse.status}`);
        return false;
      }
      const quiz = await quizResponse.json();
      const totalQuestions = quiz.questions?.length || 0;

      const response = await fetch(`/api/quizAttempts?quizId=${quizId}&address=${userAddress}`);
      if (response.ok) {
        const { attempt } = await response.json();
        return attempt && attempt.score === totalQuestions;
      }
      return false;
    } catch (err: any) {
      console.error(`Error checking participation for ${quizId}: ${err.message}`);
      return false;
    }
  };

  useEffect(() => {
    if (userAddress && quizzes.length > 0) {
      const updateParticipation = async () => {
        const newParticipation: { [quizId: string]: boolean } = {};
        for (const quiz of quizzes) {
          newParticipation[quiz.id] = await checkParticipation(quiz.id);
        }
        setParticipation(newParticipation);
      };
      updateParticipation().catch((err) =>
        console.error('Error updating participation:', err.message)
      );
    }
  }, [userAddress, quizzes]);

  const handleQuizGenerated = (quiz: Quiz) => {
    setQuizzes([...quizzes, quiz]);
    setShowGenerator(false);
    toast.success('Quiz created successfully!');
  };

  const handleCheckIn = async () => {
    if (!isConnected || !userAddress) {
      toast.error('Please connect your wallet.');
      return;
    }
    if (!contractAddress) {
      toast.error('Contract address is not configured.');
      console.error('NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS is missing.');
      return;
    }
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('No wallet provider detected.');
      return;
    }
  
    setIsCheckingIn(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);
      
      // Accept both Celo mainnet (42220) and testnet (44787)
      const supportedChains = [42220, 44787]; // Celo mainnet and Alfajores testnet
      
      if (!supportedChains.includes(currentChainId)) {
        try {
          // Try to switch to Celo mainnet first
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${(42220).toString(16)}` }], // Celo mainnet
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            // Chain not added, try Alfajores testnet
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${(44787).toString(16)}` }], // Alfajores testnet
              });
            } catch (testnetError: any) {
              throw new Error('Please switch to Celo network (mainnet or testnet).');
            }
          } else {
            throw new Error('Please switch to Celo network.');
          }
        }
      }
  
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, QuizRewardsABI, signer);
      const walletClient = createWalletClient({
        chain: currentChainId === 44787 ? celoAlfajores : celo,
        transport: custom(window.ethereum),
      });
  
      console.log('Calling checkIn on contract:', contractAddress);
      const txHash = await sendTransactionWithDivvi(
        contract,
        'checkIn',
        [],
        walletClient,
        provider
      );
      console.log('Check-in transaction hash:', txHash);
  
      toast.success('Successfully checked in! 🎉');
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to check in';
      if (err.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'Insufficient funds for gas. Please fund your wallet with CELO.';
      } else if (err.message.includes('unknown function') || err.message.includes('INVALID_ARGUMENT')) {
        errorMessage = 'Check-in function not found. Please verify the contract address and ABI.';
        console.error('Contract ABI mismatch or incorrect address:', contractAddress, err);
      } else if (err.message.includes('already checked in')) {
        errorMessage = 'You have already checked in today.';
      }
      console.error('Check-in error:', err);
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            🧠 ChainIQ
          </h1>
          <p className="mt-3 text-lg text-gray-300">
            Learn, earn, and mint NFTs on the Celo blockchain
            {username && `, ${username}!`}
          </p>
          <div className="mt-4 space-x-4">
            <Link href="/rewards">
              <button className="px-6 py-2 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black font-semibold rounded-full transition-all duration-300">
                🏆 View Rewards
              </button>
            </Link>
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn || !isConnected}
              className="px-6 py-2 bg-gradient-to-r from-green-400 to-teal-400 hover:from-green-500 hover:to-teal-500 text-black font-semibold rounded-full transition-all duration-300 disabled:bg-gray-600"
            >
              {isCheckingIn ? 'Checking In...' : '✅ Check In'}
            </button>
          </div>
        </header>

        {(error || walletError) && (
          <div className="mb-8 p-4 bg-red-500/20 text-red-300 rounded-lg text-center">
            {error || walletError}
          </div>
        )}

        <div className="flex justify-center mb-8 space-x-4">
          <ConnectWallet
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all"
          />
          {isConnected && selectedQuiz && (
            <ShareToWarpcast
              quizTitle={selectedQuiz.title}
              quizId={selectedQuiz.id}
              userAddress={userAddress || ''}
              username={username || ''}
            />
          )}
        </div>

        <main>
          {selectedQuiz ? (
            <QuizPlayer quiz={selectedQuiz} />
          ) : showGenerator ? (
            <QuizGenerator onQuizGenerated={handleQuizGenerated} />
          ) : (
            <div>
              <div className="flex justify-center mb-10">
                <button
                  onClick={() => setShowGenerator(true)}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  🚀 Create New Quiz
                </button>
              </div>

              <section>
                <h2 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-purple-400">
                  Available Quizzes
                </h2>
                {quizzes.length === 0 ? (
                  <p className="text-center text-gray-400 text-lg animate-pulse">
                    No quizzes available. Create one to get started!
                  </p>
                ) : (
                  <div className="space-y-8">
                    {quizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20 hover:border-blue-500/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                      >
                        <h3 className="text-xl font-semibold text-blue-200 mb-2">{quiz.title}</h3>
                        <p className="text-gray-300 text-sm mb-4 line-clamp-2">{quiz.description}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">
                            {participation[quiz.id] ? 'Completed (Perfect Score)' : 'Not Completed'}
                          </span>
                          <div className="space-x-2">
                            <Link href={`/quiz/${quiz.id}`}>
                              <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
                                {participation[quiz.id] ? 'View Results' : 'Take Quiz'}
                              </button>
                            </Link>
                            <ShareToWarpcast
                              quizTitle={quiz.title}
                              quizId={quiz.id}
                              userAddress={userAddress || ''}
                              username={username || ''}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}