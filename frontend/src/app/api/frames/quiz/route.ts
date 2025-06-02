import { NextRequest, NextResponse } from 'next/server';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import type { Quiz, Question } from '@/types/quiz';
import { z } from 'zod';

const FrameStateSchema = z.object({
  quizId: z.string(),
  userId: z.string(),
  currentIndex: z.number(),
  score: z.number(),
  answers: z.array(z.string()),
  startTime: z.number(),
});

interface FrameState {
  quizId: string;
  userId: string;
  currentIndex: number;
  score: number;
  answers: string[];
  startTime: number;
}

const QuizSchema = z.object({
  id: z.string(),
  title: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(z.string()),
      correctAnswer: z.string(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { untrustedData } = body;
    if (!untrustedData) {
      return new Response('Missing untrustedData', { status: 400 });
    }

    const { fid, buttonIndex, state: serializedState } = untrustedData;
    const userId = `fid:${fid}`;
    const quizId = req.nextUrl.searchParams.get('quizId');

    if (!quizId) {
      return new Response('Missing quizId', { status: 400 });
    }

    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS frame_states (
          userId TEXT,
          quizId TEXT,
          state TEXT,
          createdAt TEXT,
          PRIMARY KEY (userId, quizId)
        )
      `);

      const quizResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/quizzes?id=${quizId}`);
      if (!quizResponse.ok) {
        return new Response('Quiz not found', { status: 404 });
      }
      const quizData = await quizResponse.json();
      const quiz = QuizSchema.parse(quizData);

      let frameState: FrameState;
      if (serializedState) {
        frameState = FrameStateSchema.parse(JSON.parse(serializedState));
      } else {
        frameState = {
          quizId,
          userId,
          currentIndex: 0,
          score: 0,
          answers: [],
          startTime: Date.now(),
        };
      }

      const currentQuestion: Question = quiz.questions[frameState.currentIndex];

      if (buttonIndex && buttonIndex >= 1 && buttonIndex <= 4) {
        const selectedAnswer = currentQuestion.options[buttonIndex - 1];
        const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
        frameState.answers.push(selectedAnswer);
        if (isCorrect) {
          frameState.score += 1;
        }

        if (frameState.currentIndex < quiz.questions.length - 1) {
          frameState.currentIndex += 1;
        } else {
          const timeTaken = (Date.now() - frameState.startTime) / 1000;
          await db.run(
            `INSERT INTO quiz_attempts (quizId, address, score, createdAt, timeTaken) VALUES (?, ?, ?, ?, ?)`,
            [quizId, userId, frameState.score, new Date().toISOString(), timeTaken]
          );
        }
      }

      await db.run(
        `INSERT OR REPLACE INTO frame_states (userId, quizId, state, createdAt) VALUES (?, ?, ?, ?)`,
        [userId, quizId, JSON.stringify(frameState), new Date().toISOString()]
      );

      let html: string;
      if (frameState.currentIndex >= quiz.questions.length) {
        const imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/frames/quiz/image?quizId=${quizId}&score=${frameState.score}&total=${quiz.questions.length}`;
        html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="fc:frame" content="vNext" />
              <meta property="fc:frame:image" content="${imageUrl}" />
              <meta property="fc:frame:button:1" content="Back to Home" />
              <meta property="fc:frame:button:1:action" content="link" />
              <meta property="fc:frame:button:1:target" content="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}" />
              <meta property="fc:frame:button:2" content="Share Score" />
              <meta property="fc:frame:button:2:action" content="link" />
              <meta property="fc:frame:button:2:target" content="https://warpcast.com/~/compose?text=I scored ${frameState.score}/${quiz.questions.length} on ${quiz.title}! Try it: ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/quiz/${quizId}" />
            </head>
            <body>
              <h1>Quiz Complete!</h1>
              <p>Your score: ${frameState.score}/${quiz.questions.length}</p>
            </body>
          </html>
        `;
      } else {
        const imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/frames/quiz/image?quizId=${quizId}&question=${encodeURIComponent(currentQuestion.question)}`;
        const nextState = JSON.stringify(frameState);
        html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="fc:frame" content="vNext" />
              <meta property="fc:frame:image" content="${imageUrl}" />
              <meta property="fc:frame:button:1" content="${currentQuestion.options[0]}" />
              <meta property="fc:frame:button:2" content="${currentQuestion.options[1]}" />
              <meta property="fc:frame:button:3" content="${currentQuestion.options[2]}" />
              <meta property="fc:frame:button:4" content="${currentQuestion.options[3]}" />
              <meta property="fc:frame:post_url" content="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/frames/quiz?quizId=${quizId}" />
              <meta property="fc:frame:state" content="${encodeURIComponent(nextState)}" />
            </head>
            <body>
              <h1>${quiz.title}</h1>
              <p>Question ${frameState.currentIndex + 1}: ${currentQuestion.question}</p>
            </body>
          </html>
        `;
      }

      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    } finally {
      await db.close();
    }
  } catch (error: any) {
    console.error('Error processing frame:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to process frame' }), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const quizId = req.nextUrl.searchParams.get('quizId');
    if (!quizId) {
      return new Response('Missing quizId', { status: 400 });
    }

    const quizResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/quizzes?id=${quizId}`);
    if (!quizResponse.ok) {
      return new Response('Quiz not found', { status: 404 });
    }
    const quiz = await quizResponse.json();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/frames/quiz/image?quizId=${quizId}" />
          <meta property="fc:frame:button:1" content="Start Quiz" />
          <meta property="fc:frame:post_url" content="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/frames/quiz?quizId=${quizId}" />
        </head>
        <body>
          <h1>${quiz.title}</h1>
          <p>Take the quiz on Warpcast!</p>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: any) {
    console.error('Error rendering frame:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to render frame' }), { status: 500 });
  }
}