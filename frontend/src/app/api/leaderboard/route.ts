// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

export async function GET(req: NextRequest) {
  try {
    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    const quizId = req.nextUrl.searchParams.get('quizId');
    if (!quizId) {
      await db.close();
      return NextResponse.json({ error: 'Missing quizId' }, { status: 400 });
    }

    // Get quiz question count
    const quizResponse = await fetch(`https://chainiq.vercel.app/api/quizzes?id=${quizId}`, {
      cache: 'no-store',
    });
    if (!quizResponse.ok) {
      await db.close();
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }
    const quiz = await quizResponse.json();
    const totalQuestions = quiz.questions.length;

    // Fetch all attempts for the quiz
    const attempts = await db.all(
      'SELECT address, score, createdAt, timeTaken FROM quiz_attempts WHERE quizId = ? ORDER BY address, createdAt ASC',
      [quizId]
    );

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
        totalTime: totalTimeMs / 1000, // Seconds
      });
    }

    // Sort by attempts (ascending), then total time (ascending)
    leaderboard.sort((a, b) => {
      if (a.attemptsUntilPerfect !== b.attemptsUntilPerfect) {
        return a.attemptsUntilPerfect - b.attemptsUntilPerfect;
      }
      return a.totalTime - b.totalTime;
    });

    await db.close();
    return NextResponse.json(leaderboard, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}