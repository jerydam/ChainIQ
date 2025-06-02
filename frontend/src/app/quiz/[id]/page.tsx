// app/quiz/[id]/page.tsx
import QuizPageClient from '@/components/QuizPageClient';
import type { Quiz } from '@/types/quiz';
import Link from 'next/link'; // Import Link to fix no-html-link-for-pages

interface QuizPageProps {
  params: Promise<{ id: string }>; // Update to reflect that params is a Promise
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { id } = await params; // Await the params Promise to get the id

  console.log('Fetching quiz server-side:', { id });
  const response = await fetch(`http://localhost:3000/api/quizzes?id=${id}`, {
    cache: 'no-store', // Ensure fresh data
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to fetch quiz:', { status: response.status, errorText });
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold text-red-500">Error</h2>
        <p>Failed to load quiz: {errorText}</p>
        <Link href="/" className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded">
          Back to Home
        </Link>
      </div>
    );
  }

  const quiz: Quiz = await response.json();
  if (!quiz) {
    console.error('Quiz not found:', { id });
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold">Quiz Not Found</h2>
        <Link href="/" className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded">
          Back to Home
        </Link>
      </div>
    );
  }

  console.log('Quiz fetched server-side:', { id });
  return <QuizPageClient quiz={quiz} />;
}