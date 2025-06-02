// src/app/quiz/[id]/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link'; // Add this import
import { useWallet } from '@/components/context/WalletContext';
import QuizPlayer from '@/components/QuizPlayer';
import { Leaderboard } from '@/components/Leaderboard';
import type { Quiz, UserScore } from '@/types/quiz';
import toast from 'react-hot-toast';
import { z } from 'zod';

const UserScoreSchema = z.object({
  quizId: z.string(),
  quizTitle: z.string(),
  score: z.number(),
  totalQuestions: z.number(),
  completedAt: z.string().transform((str) => new Date(str)),
  timeTaken: z.number().optional(),
}).strict();

interface QuizPageClientProps {
  quiz: Quiz;
}

export default function QuizPageClient({ quiz }: QuizPageClientProps) {
  const router = useRouter();
  const { userAddress } = useWallet();
  const [userScores, setUserScores] = useState<UserScore[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchUserScores = useCallback(async () => {
    if (!userAddress) return;
    try {
      const response = await fetch(`/api/quizAttempts?address=${userAddress}`);
      if (!response.ok) throw new Error('Failed to fetch scores');
      const { allAttempts } = await response.json();
      const scores = await Promise.all(
        allAttempts.map(async (attempt: any) => {
          const quizResponse = await fetch(`/api/quizzes?id=${attempt.quizId}`);
          const quizData = quizResponse.ok ? await quizResponse.json() : { title: 'Unknown Quiz', questions: [] };
          return UserScoreSchema.parse({
            quizId: attempt.quizId,
            quizTitle: quizData.title || 'Unknown Quiz',
            score: attempt.score,
            totalQuestions: quizData.questions?.length || 0,
            completedAt: attempt.createdAt,
            timeTaken: attempt.timeTaken || 0,
          });
        })
      );
      setUserScores(scores);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching user scores:', error);
      toast.error('Failed to load user scores.');
    }
  }, [userAddress]);

  useEffect(() => {
    fetchUserScores();
  }, [fetchUserScores]);

  const handleQuizComplete = () => {
    fetchUserScores();
    setRefreshKey(prev => prev + 1);
  };

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
      <QuizPlayer
        quiz={quiz}
        onComplete={handleQuizComplete}
      />
      <Leaderboard
        quizId={quiz.id}
        className="my-6"
        key={refreshKey}
      />
      {/* Example of fixing <a> tags */}
      <Link href="/">
        <span className="text-blue-400 hover:underline">Back to Home</span>
      </Link>
    </div>
  );
}