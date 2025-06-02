"use client";
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import QuizPlayer from '@/components/QuizPlayer';
import { QuizGenerator } from '@/components/QuizGenerator';
import { ConnectWallet } from '@/components/ConnectWallet';
import { ShareToWarpcast } from '@/components/ShareToWarpcast';
import Link from 'next/link';
import type { Quiz } from '@/types/quiz';
import { useFarcaster } from '@/hook/useFarcaster';
import { useWallet } from '@/components/context/WalletContext';

export default function Home() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [participation, setParticipation] = useState<{ [quizId: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const contractAddress = process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS || '';
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
      console.error('Error fetching quizzes:', err);
      setError('Failed to fetch quizzes: ' + err.message);
    }
  };

  const checkParticipation = async (quizId: string) => {
    if (!userAddress) return false;
    try {
      const quizResponse = await fetch(`/api/quizzes?id=${quizId}`);
      if (!quizResponse.ok) {
        console.error(`Failed to fetch quiz ${quizId}`);
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
        <header className="text-center mb-12">
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            🧠 QuizChain
          </h1>
          <p className="mt-3 text-lg text-gray-300">
            Learn, earn, and mint NFTs on the Celo blockchain
            {username && `, ${username}!`}
          </p>
          <Link href="/rewards">
            <button className="mt-4 px-6 py-2 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black font-semibold rounded-full transition-all duration-300">
              🏆 View Rewards
            </button>
          </Link>
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