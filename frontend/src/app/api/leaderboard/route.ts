import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const quizId = req.nextUrl.searchParams.get('quizId');
    if (!quizId) {
      return NextResponse.json({ error: 'Missing quizId' }, { status: 400 });
    }

    // Get quiz question count
    const quizResponse = await fetch(`https://chainiq.vercel.app/api/quizzes?id=${quizId}`, { cache: 'no-store' });
    if (!quizResponse.ok) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }
    const quiz = await quizResponse.json();
    const totalQuestions = quiz.questions.length;

    // Fetch all attempts for the quiz
    const { data: attempts, error } = await supabase
      .from('quiz_attempts')
      .select('address, score, createdAt, timeTaken')
      .eq('quizId', quizId)
      .order('address', { ascending: true })
      .order('createdAt', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch attempts: ${error.message}`);
    }

    // Aggregate leaderboard data
    const leaderboard = [];
    const players = new Set(attempts.map(a => a.address));
    for (const address of players) {
      const playerAttempts = attempts
        .filter(a => a.address === address)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      let attemptsUntilPerfect = playerAttempts.length;
      let totalTimeMs = 0;

      for (let i = 0; i < playerAttempts.length; i++) {
        if (playerAttempts[i].score === totalQuestions) {
          attemptsUntilPerfect = i + 1;
          break;
        }
      }

      if (playerAttempts.length > 1) {
        const firstAttempt = new Date(playerAttempts[0].createdAt).getTime();
        const lastAttempt = new Date(playerAttempts[playerAttempts.length - 1].createdAt).getTime();
        totalTimeMs = lastAttempt - firstAttempt + playerAttempts.reduce((sum, a) => sum + (a.timeTaken * 1000 || 0), 0);
      }

      leaderboard.push({
        address: `${address.slice(0, 6)}...${address.slice(-4)}`,
        attemptsUntilPerfect,
        totalTime: totalTimeMs / 1000,
      });
    }

    // Sort by attempts (ascending), then total time (ascending)
    leaderboard.sort((a, b) => {
      if (a.attemptsUntilPerfect !== b.attemptsUntilPerfect) {
        return a.attemptsUntilPerfect - b.attemptsUntilPerfect;
      }
      return a.totalTime - b.totalTime;
    });

    return NextResponse.json(leaderboard, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}