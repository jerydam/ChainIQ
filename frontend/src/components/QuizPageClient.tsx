"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers'; // Import ethers
import QuizPlayer from '@/components/QuizPlayer';
import { Leaderboard } from '@/components/Leaderboard';
import { RewardsPanel } from '@/components/RewardsPanel';
import type { Quiz, UserScore } from '@/types/quiz';

// Extend Window interface to include ethereum
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, callback: (accounts: string[]) => void) => void;
  };
}

interface QuizPageClientProps {
  quiz: Quiz;
}

export default function QuizPageClient({ quiz }: QuizPageClientProps) {
  const router = useRouter();
  const [userScores, setUserScores] = useState<UserScore[]>([]);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (typeof window === 'undefined' || !window.ethereum) {
        console.error('MetaMask not detected');
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        if (accounts.length === 0) {
          console.error('No wallet accounts found');
          return;
        }
        setUserAddress(accounts[0]);
        setIsConnected(true);
        console.log('Wallet connected:', accounts[0]);

        // Fetch user scores
        const response = await fetch(`/api/quizAttempts?address=${accounts[0]}`);
        if (response.ok) {
          const { allAttempts } = await response.json();
          const scores: UserScore[] = await Promise.all(
            allAttempts.map(async (attempt: any) => {
              // Fetch quiz details to get title and total questions
              const quizResponse = await fetch(`/api/quizzes?id=${attempt.quizId}`);
              const quizData = quizResponse.ok ? await quizResponse.json() : {};
              return {
                quizId: attempt.quizId,
                score: attempt.score,
                totalQuestions: quizData.questions?.length || 0,
                quizTitle: quizData.title || 'Unknown Quiz',
                completedAt: new Date(attempt.createdAt),
              };
            })
          );
          setUserScores(scores);
          console.log('User scores:', scores);
        } else {
          console.error('Failed to fetch scores:', response.status);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUserData();
  }, [quiz.id]);

  return (
    <div className="p-4">
      <div className="flex justify-start mb-6">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all duration-300"
        >
          ← Back
        </button>
      </div>
      <QuizPlayer quiz={quiz} />
      <Leaderboard quizId={quiz.id} className="my-6" />
     </div>
  );
}