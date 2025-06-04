import type { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

interface QuizAttempt {
  quizId: string;
  address: string;
  score: number;
  createdAt: string;
  timeTaken: number;
}

export async function POST(req: NextRequest) {
  try {
    const { quizId, address, score, timeTaken } = await req.json();
    if (!quizId || !address || typeof score !== 'number' || typeof timeTaken !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid quiz attempt data' }), { status: 400 });
    }

    const createdAt = new Date().toISOString();
    const { error } = await supabase.from('quiz_attempts').insert({
      quizId,
      address,
      score,
      createdAt,
      timeTaken,
    });

    if (error) {
      if (error.code === '23505') {
        await supabase
          .from('quiz_attempts')
          .update({ score, timeTaken })
          .eq('quizId', quizId)
          .eq('address', address)
          .eq('createdAt', createdAt);
      } else {
        throw new Error(`Failed to save quiz attempt: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error('Error processing quiz attempt:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to process quiz attempt' }), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address');
    if (!address) {
      return new Response(JSON.stringify({ error: 'Missing address' }), { status: 400 });
    }

    const { data: allAttempts, error } = await supabase
      .from('quiz_attempts')
      .select('quizId, address, score, createdAt, timeTaken')
      .eq('address', address)
      .order('createdAt', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch attempts: ${error.message}`);
    }

    return new Response(JSON.stringify({ allAttempts }), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching quiz attempts:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch quiz attempts' }), { status: 500 });
  }
}