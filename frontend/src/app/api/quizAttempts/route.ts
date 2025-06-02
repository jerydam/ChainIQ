// app/api/quizAttempts/route.ts
import type { NextRequest } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { promises as fs } from 'fs';

interface QuizAttempt {
  quizId: string;
  address: string;
  score: number;
  createdAt: string;
  timeTaken: number;
}

export async function POST(req: NextRequest) {
  try {
    const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/quizzes.db' : path.join(process.cwd(), 'quizzes.db');
    await fs.mkdir(path.dirname(dbPath), { recursive: true }).catch(err => console.error('Failed to create db dir:', err));

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Recreate table (development only)
    await db.exec('DROP TABLE IF EXISTS quiz_attempts');
    await db.exec(`
      CREATE TABLE quiz_attempts (
        quizId TEXT,
        address TEXT,
        score INTEGER,
        createdAt TEXT,
        timeTaken REAL,
        PRIMARY KEY (quizId, address, createdAt)
      )
    `);

    const { quizId, address, score, timeTaken } = await req.json();
    if (!quizId || !address || typeof score !== 'number' || typeof timeTaken !== 'number') {
      console.error('Invalid quiz attempt data:', { quizId, address, score, timeTaken });
      return new Response(JSON.stringify({ error: 'Invalid quiz attempt data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const createdAt = new Date().toISOString();
      await db.run(
        `INSERT INTO quiz_attempts (quizId, address, score, createdAt, timeTaken) VALUES (?, ?, ?, ?, ?)`,
        [quizId, address, score, createdAt, timeTaken]
      );
      console.log('Quiz attempt saved:', { quizId, address, score, createdAt, timeTaken });
    } catch (sqliteError: any) {
      if (sqliteError.code === 'SQLITE_CONSTRAINT') {
        console.warn('Duplicate quiz attempt, updating:', { quizId, address });
        await db.run(
          `UPDATE quiz_attempts SET score = ?, timeTaken = ? WHERE quizId = ? AND address = ? AND createdAt = ?`,
          [score, timeTaken, quizId, address, new Date().toISOString()]
        );
      } else {
        throw sqliteError;
      }
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
    const address = req.nextUrl.searchParams.get('address');
    if (!address) {
      return new Response(JSON.stringify({ error: 'Missing address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/quizzes.db' : path.join(process.cwd(), 'quizzes.db');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    const allAttempts = await db.all(
      'SELECT quizId, address, score, createdAt, timeTaken FROM quiz_attempts WHERE address = ? ORDER BY createdAt ASC',
      [address]
    );
    await db.close();

    return new Response(JSON.stringify({ allAttempts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching quiz attempts:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch quiz attempts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}