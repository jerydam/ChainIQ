"use client";
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import  QuizPlayer  from '@/components/QuizPlayer';
import { QuizGenerator } from '@/components/QuizGenerator';
import { Leaderboard } from '@/components/Leaderboard';
import type { Quiz } from '@/types/quiz';
import { QuizRewardsABI } from '@/abis/QuizAbi';
import Link from 'next/link';

export default function Home() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [participation, setParticipation] = useState<{ [quizId: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const contractAddress = process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS || '';

  useEffect(() => {
    fetchQuizzes();
    connectWallet();
  }, []);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask.');
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts.length === 0) {
        setError('No wallet accounts found.');
        return;
      }
      setUserAddress(accounts[0]);
      window.ethereum.on('accountsChanged', (newAccounts: string[]) => {
        setUserAddress(newAccounts[0] || null);
      });
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError('Failed to connect wallet: ' + err.message);
    }
  };

  const fetchQuizzes = async () => {
    try {
      const response = await fetch('/api/quizzes');
      if (!response.ok) {
        throw new Error(`Failed to fetch quizzes: ${response.status}`);
      }
      const data = await response.json();
      setQuizzes(data);
    } catch (err: any) {
      console.error('Error fetching quizzes:', err);
      setError('Failed to fetch quizzes: ' + err.message);
    }
  };

  const checkParticipation = async (quizId: string) => {
    if (!userAddress) return false;
    try {
      const response = await fetch(`/api/quizAttempts?quizId=${quizId}&address=${userAddress}`);
      if (response.ok) {
        const { attempt } = await response.json();
        return attempt && attempt.score === quizId[0].questions.length; // Perfect score check
      }
      return false;
    } catch (err: any) {
      console.error(`Error checking participation for quiz ${quizId}:`, err);
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
      updateParticipation();
    }
  }, [userAddress, quizzes]);

  const handleQuizGenerated = (quiz: Quiz) => {
    setQuizzes([...quizzes, quiz]);
    setShowGenerator(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            🧠 QuizChain
          </h1>
          <p className="mt-3 text-lg text-gray-300">
            Learn, earn, and mint NFTs on the Celo blockchain
          </p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/20 text-red-300 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Wallet Connection */}
        <div className="flex justify-center mb-8">
          {userAddress ? (
            <div className="flex items-center space-x-3 bg-gray-800/50 rounded-full px-4 py-2 border border-blue-500/30">
              <span className="text-sm text-blue-300">
                Connected: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </span>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Connect Wallet
            </button>
          )}
        </div>

        {/* Main Content */}
        <main>
          {selectedQuiz ? (
            <QuizPlayer quiz={selectedQuiz} />
          ) : showGenerator ? (
            <QuizGenerator onQuizGenerated={handleQuizGenerated} />
          ) : (
            <div>
              {/* Create Quiz Button */}
              <div className="flex justify-center mb-10">
                <button
                  onClick={() => setShowGenerator(true)}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  🚀 Create New Quiz
                </button>
              </div>

              {/* Quizzes Section */}
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
                      <div key={quiz.id}>
                        <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20 hover:border-blue-500/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
                          <h3 className="text-xl font-semibold text-blue-200 mb-2">{quiz.title}</h3>
                          <p className="text-gray-300 text-sm mb-4 line-clamp-2">{quiz.description}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">
                              {participation[quiz.id] ? 'Completed (Perfect Score)' : 'Not Completed'}
                            </span>
                            <Link href={`/quiz/${quiz.id}`}>
                              <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
                                {participation[quiz.id] ? 'View Results' : 'Take Quiz'}
                              </button>
                            </Link>
                          </div>
                        </div>
                        <Leaderboard quizId={quiz.id} />
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