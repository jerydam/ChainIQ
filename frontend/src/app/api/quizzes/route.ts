import type { NextRequest } from 'next/server';
import { Database } from 'sqlite3';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import type { Quiz } from '@/types/quiz';

export async function GET(req: NextRequest) {
  try {
    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    console.log('Connected to SQLite database');

    // Create quizzes table if it doesn't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        questions TEXT,
        difficulty TEXT,
        estimatedTime INTEGER,
        rewards TEXT,
        source TEXT,
        createdAt TEXT,
        rewardType TEXT,
        rewardAmount INTEGER,
        nftMetadata TEXT
      )
    `);
    console.log('Ensured quizzes table exists');

    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      console.log('Fetching quiz with ID:', id);
      const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [id]);
      await db.close();
      if (!quiz) {
        console.error('Quiz not found:', { id });
        const response = { error: 'Quiz not found' };
        console.log('Returning error response:', response);
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const response = {
        ...quiz,
        questions: JSON.parse(quiz.questions),
        rewards: JSON.parse(quiz.rewards),
        source: JSON.parse(quiz.source),
        createdAt: new Date(quiz.createdAt),
      };
      console.log('Returning quiz:', { id });
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching all quizzes');
    const quizzes = await db.all('SELECT * FROM quizzes');
    await db.close();
    console.log('Quizzes retrieved:', { length: quizzes.length });

    const response = quizzes.map((quiz) => ({
      ...quiz,
      questions: JSON.parse(quiz.questions),
      rewards: JSON.parse(quiz.rewards),
      source: JSON.parse(quiz.source),
      createdAt: new Date(quiz.createdAt),
    }));
    console.log('Returning all quizzes:', { count: response.length });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      console.error('Error fetching quizzes:', {
        message: error.message,
        code: error.code || 'UNKNOWN',
        stack: error.stack,
      });
      const response = { error: error.message || 'Failed to fetch quizzes' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
}