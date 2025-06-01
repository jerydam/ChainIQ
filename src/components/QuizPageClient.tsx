"use client";

import { useRouter } from 'next/navigation';
import QuizPlayer from '@/components/QuizPlayer';
import type { Quiz } from '@/types/quiz';

interface QuizPageClientProps {
  quiz: Quiz;
}

export default function QuizPageClient({ quiz }: QuizPageClientProps) {
  const router = useRouter();

  return (
    <div className="p-4">
      <div className="flex justify-start mb-4">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all"
        >
          ← Back
        </button>
      </div>
      <QuizPlayer quiz={quiz} />
    </div>
  );
}