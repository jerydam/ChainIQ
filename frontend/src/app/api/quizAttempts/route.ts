import type { NextRequest } from 'next/server';
import { Database } from 'sqlite3';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

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
      console.error('Invalid quiz attempt data:', { quizId, address, score, timeTaken });
      return new Response(JSON.stringify({ error: 'Invalid quiz attempt data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS quiz_attempts (
          quizId TEXT,
          address TEXT,
          score INTEGER,
          createdAt TEXT,
          timeTaken REAL,
          PRIMARY KEY (quizId, address, createdAt)
        )
      `);

      await db.run(
        `
        INSERT INTO quiz_attempts (quizId, address, score, createdAt, timeTaken)
        VALUES (?, ?, ?, ?, ?)
      `,
        [quizId, address, score, new Date().toISOString(), timeTaken]
      );
      console.log('Quiz attempt saved:', { quizId, address, score, timeTaken });
    } catch (sqliteError: any) {
      console.error('SQLite error:', sqliteError);
      return new Response(JSON.stringify({ error: `Failed to save quiz attempt: ${sqliteError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await db.close();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error processing quiz attempt:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to process quiz attempt' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const quizId = req.nextUrl.searchParams.get('quizId');
    const address = req.nextUrl.searchParams.get('address');

    if (!quizId && !address) {
      console.error('Missing quizId or address');
      return new Response(JSON.stringify({ error: 'quizId or address is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    if (quizId && address) {
      const attempt = await db.get<QuizAttempt>(
        'SELECT * FROM quiz_attempts WHERE quizId = ? AND address = ? ORDER BY createdAt DESC LIMIT 1',
        [quizId, address]
      );
      const allAttempts = await db.all<QuizAttempt>(
        'SELECT * FROM quiz_attempts WHERE quizId = ? AND address = ? ORDER BY createdAt ASC',
        [quizId, address]
      );
      await db.close();
      return new Response(JSON.stringify({ attempt, allAttempts }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (address) {
      const allAttempts = await db.all<QuizAttempt>(
        'SELECT * FROM quiz_attempts WHERE address = ? ORDER BY createdAt ASC',
        [address]
      );
      await db.close();
      console.log('Fetched attempts for address:', address, allAttempts);
      return new Response(JSON.stringify({ allAttempts }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (quizId) {
      const allAttempts = await db.all<QuizAttempt>(
        'SELECT * FROM quiz_attempts WHERE quizId = ? ORDER BY createdAt ASC',
        [quizId]
      );
      await db.close();
      return new Response(JSON.stringify({ allAttempts }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    console.error('Error fetching quiz attempt:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch quiz attempt' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}