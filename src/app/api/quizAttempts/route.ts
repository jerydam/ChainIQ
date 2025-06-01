import type { NextRequest } from 'next/server';
import { Database } from 'sqlite3';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

interface QuizAttempt {
  quizId: string;
  address: string;
  score: number;
  createdAt: string;
}

export async function POST(req: NextRequest) {
  try {
    const { quizId, address, score } = await req.json();
    if (!quizId || !address || typeof score !== 'number') {
      console.error('Invalid quiz attempt data:', { quizId, address, score });
      const response = { error: 'Invalid quiz attempt data' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    try {
      console.log('Creating quiz_attempts table if not exists');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS quiz_attempts (
          quizId TEXT,
          address TEXT,
          score INTEGER,
          createdAt TEXT,
          PRIMARY KEY (quizId, address)
        )
      `);

      console.log('Inserting quiz attempt into SQLite');
      await db.run(
        `
        INSERT INTO quiz_attempts (quizId, address, score, createdAt)
        VALUES (?, ?, ?, ?)
      `,
        [quizId, address, score, new Date().toISOString()]
      );
      console.log('Quiz attempt saved:', { quizId, address, score });
    } catch (sqliteError: any) {
      console.error('SQLite error:', {
        message: sqliteError.message,
        code: sqliteError.code,
        stack: sqliteError.stack,
      });
      const response = { error: `Failed to save quiz attempt: ${sqliteError.message}` };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await db.close();
    }

    const response = { success: true };
    console.log('Returning success response:', response);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error processing quiz attempt:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    const response = { error: error.message || 'Failed to process quiz attempt' };
    console.log('Returning error response:', response);
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const quizId = req.nextUrl.searchParams.get('quizId');
    const address = req.nextUrl.searchParams.get('address');

    if (!quizId || !address) {
      console.error('Missing quizId or address in query:', { quizId, address });
      const response = { error: 'quizId and address are required' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    console.log('Fetching quiz attempt:', { quizId, address });
    const attempt = await db.get<QuizAttempt>(
      'SELECT * FROM quiz_attempts WHERE quizId = ? AND address = ?',
      [quizId, address]
    );
    await db.close();

    const response = attempt || null;
    console.log('Returning attempt response:', response);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching quiz attempt:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    const response = { error: error.message || 'Failed to fetch quiz attempt' };
    console.log('Returning error response:', response);
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}