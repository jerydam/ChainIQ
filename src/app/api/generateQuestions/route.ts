import { NextRequest, NextResponse } from 'next/server';
import type { Question } from '@/types/quiz';

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    return NextResponse.json(
      { error: 'Server configuration error: Missing GEMINI_API_KEY' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return NextResponse.json(
      { error: 'Invalid request body: Expected JSON' },
      { status: 400 }
    );
  }

  const { topic, difficulty, count, fileContent } = body;

  if ((!topic && !fileContent) || !['beginner', 'intermediate', 'advanced'].includes(difficulty) || !Number.isInteger(count) || count < 1 || count > 20) {
    console.error('Invalid input:', { topic, difficulty, count, fileContent: !!fileContent });
    return NextResponse.json(
      { error: 'Invalid input: topic or fileContent, difficulty, or count' },
      { status: 400 }
    );
  }

  const generateQuestions = async (useOpenAI: boolean = false) => {
    try {
      const prompt = fileContent
        ? `Return valid JSON with the structure {"questions":[{"question":"text","options":["a","b","c","d"],"correctAnswer":"a","explanation":"text"}]}. Generate ${count} multiple-choice questions based on the following content at ${difficulty} level: "${fileContent.slice(0, 10000)}". Each question must have exactly 4 options, a correct answer (option text), and an explanation. Ensure the response is a single JSON object, not wrapped in markdown.`
        : `Return valid JSON with the structure {"questions":[{"question":"text","options":["a","b","c","d"],"correctAnswer":"a","explanation":"text"}]}. Generate ${count} multiple-choice questions about "${topic}" at ${difficulty} level. Each question must have exactly 4 options, a correct answer (option text), and an explanation. Ensure the response is a single JSON object, not wrapped in markdown.`;

      if (useOpenAI) {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('Missing OPENAI_API_KEY');
        }
        const response = await fetch(`${req.nextUrl.origin}/api/generateQuestionsOpenAI`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, difficulty, count, fileContent }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `OpenAI API failed: ${response.status}`);
        }
        return await response.json();
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}` };
        }
        console.error('Gemini API error:', { status: response.status, errorData });
        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Invalid Gemini API key', details: errorData },
            { status: 401 }
          );
        }
        if (response.status === 429) {
          console.warn('Gemini API rate limit exceeded, trying OpenAI...');
          return generateQuestions(true); // Fallback to OpenAI
        }
        return NextResponse.json(
          { error: 'Failed to generate questions from Gemini API', details: errorData },
          { status: response.status }
        );
      }

      const result = await response.json();
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        console.error('Gemini API response is empty:', result);
        return NextResponse.json(
          { error: 'Empty response from Gemini API', details: JSON.stringify(result) },
          { status: 500 }
        );
      }

      let questionsData;
      try {
        questionsData = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse Gemini API response:', { content, parseError });
        return NextResponse.json(
          { error: 'Invalid JSON response from Gemini API', details: content },
          { status: 500 }
        );
      }

      if (!questionsData.questions || !Array.isArray(questionsData.questions) || questionsData.questions.length === 0) {
        console.error('Invalid or empty questions array from Gemini API:', questionsData);
        return NextResponse.json(
          { error: 'No questions returned from Gemini API', details: questionsData },
          { status: 500 }
        );
      }

      const validQuestions = questionsData.questions.every(
        (q: any) =>
          typeof q.question === 'string' &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every((opt: any) => typeof opt === 'string') &&
          typeof q.correctAnswer === 'string' &&
          q.options.includes(q.correctAnswer) &&
          typeof q.explanation === 'string'
      );

      if (!validQuestions) {
        console.error('Invalid question structure from Gemini API:', questionsData.questions);
        return NextResponse.json(
          { error: 'Invalid question structure from Gemini API', details: questionsData.questions },
          { status: 500 }
        );
      }

      const formattedQuestions: Question[] = questionsData.questions.map((q: any, index: number) => ({
        id: `q${index + 1}`,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        tags: [topic || 'file-based', difficulty],
      }));

      return formattedQuestions;
    } catch (error: any) {
      console.error('Error generating questions:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });
      return NextResponse.json(
        {
          error: 'Failed to generate questions',
          details: error.message || 'Unknown error',
          code: error.code || 'UNKNOWN',
        },
        { status: 500 }
      );
    }
  };

  const questions = await generateQuestions();
  return NextResponse.json(questions);
}