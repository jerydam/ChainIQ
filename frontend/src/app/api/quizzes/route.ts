import { NextRequest, NextResponse } from 'next/server';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    if (id) {
      const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [id]);
      if (!quiz) {
        await db.close();
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }
      quiz.questions = JSON.parse(quiz.questions || '[]');
      await db.close();
      return NextResponse.json(quiz, { status: 200 });
    }

    const quizzes = await db.all('SELECT * FROM quizzes');
    quizzes.forEach(quiz => {
      quiz.questions = JSON.parse(quiz.questions || '[]');
    });
    await db.close();
    return NextResponse.json(quizzes, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching quizzes:', error);
    return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const quiz = await req.json();
    if (!quiz.id || !quiz.title || !quiz.questions) {
      return NextResponse.json({ error: 'Invalid quiz data' }, { status: 400 });
    }

    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        questions TEXT
      )
    `);

    await db.run(
      'INSERT INTO quizzes (id, title, description, questions) VALUES (?, ?, ?, ?)',
      [quiz.id, quiz.title, quiz.description || '', JSON.stringify(quiz.questions)]
    );

    await db.close();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error saving quiz:', error);
    return NextResponse.json({ error: 'Failed to save quiz' }, { status: 500 });
  }
}