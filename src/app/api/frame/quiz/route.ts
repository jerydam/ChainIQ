import { NextRequest, NextResponse } from 'next/server';
import type { Quiz, Question } from '@/types/quiz';

const quizState: { [key: string]: { currentIndex: number; score: number; answers: string[] } } = {};

export async function GET(req: NextRequest) {
  const quizId = req.nextUrl.searchParams.get('quizId');
  const userId = req.nextUrl.searchParams.get('userId');
  const stateKey = userId ? `${userId}-${quizId}` : null;

  if (!quizId || !userId) {
    return NextResponse.json({ error: 'Missing quizId or userId' }, { status: 400 });
  }

  const attemptResponse = await fetch(
    `http://localhost:3000/api/quizAttempts?quizId=${quizId}&address=${encodeURIComponent(userId)}`
  );
  if (attemptResponse.ok) {
    const { attempt } = await attemptResponse.json();
    if (attempt && attempt.score === quizId[0].questions.length) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="https://your-domain.com/complete.png" />
            <meta property="fc:frame:button:1" content="Back to Home" />
            <meta property="fc:frame:button:1:action" content="post_redirect" />
            <meta property="fc:frame:button:1:target" content="http://localhost:3000" />
          </head>
          <body>
            <p>Perfect score! No more attempts allowed.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
  }

  const quizResponse = await fetch(`http://localhost:3000/api/quizzes?id=${quizId}`, {
    cache: 'no-store',
  });
  if (!quizResponse.ok) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  }
  const quiz: Quiz = await quizResponse.json();

  if (!quizState[stateKey]) {
    quizState[stateKey] = { currentIndex: 0, score: 0, answers: [] };
  }
  const { currentIndex, score } = quizState[stateKey];

  if (currentIndex >= quiz.questions.length) {
    await fetch('http://localhost:3000/api/quizAttempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId,
        address: userId,
        score,
      }),
    });

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${quiz.source.image || 'https://your-domain.com/complete.png'}" />
          <meta property="fc:frame:button:1" content="Back to Home" />
          <meta property="fc:frame:button:1:action" content="post_redirect" />
          <meta property="fc:frame:button:1:target" content="http://localhost:3000" />
          ${score < quiz.questions.length ? `
            <meta property="fc:frame:button:2" content="Retry Quiz" />
            <meta property="fc:frame:button:2:action" content="post" />
            <meta property="fc:frame:button:2:target" content="${req.nextUrl.origin}/api/frames/quiz?quizId=${quizId}&userId=${userId}&reset=true" />
          ` : ''}
        </head>
        <body>
          <p>Quiz Complete! Score: ${score}/${quiz.questions.length}</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const question: Question = quiz.questions[currentIndex];

  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${quiz.source.image || 'https://your-domain.com/quiz.png'}" />
        <meta property="fc:frame:button:1" content="${question.options[0]}" />
        <meta property="fc:frame:button:2" content="${question.options[1]}" />
        <meta property="fc:frame:button:3" content="${question.options[2]}" />
        <meta property="fc:frame:button:4" content="${question.options[3]}" />
        <meta property="fc:frame:post_url" content="${req.nextUrl.origin}/api/frames/quiz?quizId=${quizId}&userId=${userId}" />
      </head>
      <body>
        <p>${quiz.title} - Question ${currentIndex + 1}: ${question.question} (10s limit)</p>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

export async function POST(req: NextRequest) {
  const quizId = req.nextUrl.searchParams.get('quizId');
  const userId = req.nextUrl.searchParams.get('userId');
  const reset = req.nextUrl.searchParams.get('reset') === 'true';
  const stateKey = userId ? `${userId}-${quizId}` : null;

  if (!quizId || !userId || !stateKey) {
    return NextResponse.json({ error: 'Missing quizId or userId' }, { status: 400 });
  }

  if (reset) {
    delete quizState[stateKey];
    return NextResponse.redirect(
      `${req.nextUrl.origin}/api/frames/quiz?quizId=${quizId}&userId=${userId}`,
      302
    );
  }

  const body = await req.json();
  const selectedAnswer = body.untrustedData?.buttonIndex
    ? body.untrustedData.buttonIndex - 1
    : null;

  if (selectedAnswer === null) {
    return NextResponse.json({ error: 'No answer selected' }, { status: 400 });
  }

  const quizResponse = await fetch(`http://localhost:3000/api/quizzes?id=${quizId}`, {
    cache: 'no-store',
  });
  if (!quizResponse.ok) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  }
  const quiz: Quiz = await quizResponse.json();

  const state = quizState[stateKey];
  if (!state) {
    return NextResponse.json({ error: 'Quiz state not found' }, { status: 400 });
  }

  const question = quiz.questions[state.currentIndex];
  const isCorrect = question.options[selectedAnswer] === question.correctAnswer;
  if (isCorrect) {
    state.score += 1;
  }
  state.answers.push(question.options[selectedAnswer]);
  state.currentIndex += 1;

  return NextResponse.redirect(
    `${req.nextUrl.origin}/api/frames/quiz?quizId=${quizId}&userId=${userId}`,
    302
  );
}