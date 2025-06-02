import type { NextRequest } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import axios from 'axios';
import { ethers } from 'ethers';
import { QuizRewardsABI } from '@/abis/QuizAbi';
import type { Quiz, Question } from '@/types/quiz';
import { setTimeout } from 'timers/promises';

export async function POST(req: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_CELO_PROVIDER_URL) {
      console.error('Missing NEXT_PUBLIC_CELO_PROVIDER_URL');
      const response = { error: 'NEXT_PUBLIC_CELO_PROVIDER_URL is not set' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!process.env.PRIVATE_KEY) {
      console.error('Missing PRIVATE_KEY');
      const response = { error: 'PRIVATE_KEY is not set' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS) {
      console.error('Missing NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS');
      const response = { error: 'NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS is not set' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!process.env.PINATA_JWT) {
      console.error('Missing PINATA_JWT');
      const response = { error: 'PINATA_JWT is not set' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const topic = formData.get('topic') as string;
    const difficulty = formData.get('difficulty') as 'beginner' | 'intermediate' | 'advanced';
    const questionCount = parseInt(formData.get('questionCount') as string);
    const image = formData.get('image') as File;

    if (!topic || !['beginner', 'intermediate', 'advanced'].includes(difficulty) || questionCount < 1 || !image) {
      console.error('Invalid input data:', { topic, difficulty, questionCount, image: !!image });
      const response = { error: 'Invalid input data' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (image.size > 5 * 1024 * 1024) {
      console.error('Image size exceeds 5MB:', { size: image.size });
      const response = { error: 'Image size must be less than 5MB' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate questions
    console.log('Generating questions for:', { topic, difficulty, questionCount });
    const questionsResponse = await fetch(`${req.nextUrl.origin}/api/generateQuestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, difficulty, count: questionCount }),
    });

    if (!questionsResponse.ok) {
      const errorText = await questionsResponse.text();
      console.error('Generate questions failed:', { status: questionsResponse.status, errorText });
      const response = { error: `Failed to generate questions: ${questionsResponse.status}` };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const questions: Question[] = await questionsResponse.json();
    console.log('Received questions:', { count: questions.length });
    if (!Array.isArray(questions) || questions.length !== questionCount) {
      console.error('Invalid questions array:', { questions, expectedCount: questionCount });
      const response = { error: 'Generated questions are invalid or do not match requested count' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate each question
    questions.forEach((q, index) => {
      if (
        !q.id ||
        typeof q.question !== 'string' ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        !q.options.every(opt => typeof opt === 'string') ||
        typeof q.correctAnswer !== 'string' ||
        !q.options.includes(q.correctAnswer) ||
        typeof q.explanation !== 'string' ||
        !Array.isArray(q.tags)
      ) {
        console.error('Invalid question at index:', { index, question: q });
        const response = { error: `Invalid question format at index ${index}` };
        console.log('Returning error response:', response);
        throw new Error(`Invalid question format at index ${index}`);
      }
    });

    // Upload image to IPFS
    console.log('Uploading image to IPFS');
    const pinataFormData = new FormData();
    pinataFormData.append('file', image);
    const pinataResponse = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', pinataFormData, {
      headers: {
        'Authorization': `Bearer ${process.env.PINATA_JWT}`,
      },
    });

    if (!pinataResponse.data.IpfsHash) {
      console.error('Failed to upload to IPFS:', pinataResponse.data);
      const response = { error: 'Failed to upload to IPFS' };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const nftMetadata = `ipfs://${pinataResponse.data.IpfsHash}`;
    console.log('IPFS upload successful:', { nftMetadata });

    // Create quiz
    const quizId = `quiz-${Date.now()}`;
    const title = `${topic} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    const quiz: Quiz = {
      id: quizId,
      title,
      description: `A ${difficulty} quiz about ${topic}`,
      questions,
      difficulty,
      estimatedTime: questionCount * 2,
      rewards: { nfts: 1, points: 0 },
      source: { name: 'Generated', url: '' },
      createdAt: new Date(),
      rewardType: 'NFT',
      rewardAmount: 1,
      nftMetadata,
    };
    console.log('Quiz created:', { quizId, title });

    // Call createQuiz on contract with retry logic
    const maxRetries = 5;
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}: Connecting to Celo provider`);
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_CELO_PROVIDER_URL, undefined, {
          pollingInterval: 1000,
          timeout: 60000, // 60 seconds
        });
        const network = await provider.getNetwork();
        console.log('Connected to network:', { chainId: network.chainId.toString() });
        if (network.chainId.toString() !== '44787') {
          throw new Error('Connected to wrong network; expected Celo Alfajores (chainId 44787)');
        }
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS!, QuizRewardsABI, wallet);
        console.log('Estimating gas for createQuiz');
        const gasEstimate = await contract.createQuiz.estimateGas(quizId, title, nftMetadata);
        console.log('Gas estimate:', { gasEstimate: gasEstimate.toString() });
        console.log('Sending createQuiz transaction');
        const tx = await contract.createQuiz(quizId, title, nftMetadata, {
          gasLimit: BigInt(gasEstimate) * BigInt(120) / BigInt(100),
        });
        console.log('Transaction sent:', { txHash: tx.hash });
        await tx.wait();
        console.log('Transaction confirmed');
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt}/${maxRetries} failed:`, {
          message: error.message,
          code: error.code,
          stack: error.stack,
        });
        if (attempt < maxRetries && error.code === 'TIMEOUT') {
          console.warn(`Retrying after 2s...`);
          await setTimeout(2000);
          continue;
        }
        console.error('Exhausted retries or non-timeout error');
        throw new Error(`Failed to interact with Celo contract: ${error.message}`);
      }
    }
    if (lastError) {
      console.error('All retries failed:', lastError);
      throw lastError; // Throw the last error if all retries fail
    }

    // Save to SQLite
    console.log('Opening SQLite database');
    const db = await open({
      filename: './quizzes.db',
      driver: sqlite3.Database,
    });

    try {
      console.log('Creating quizzes table if not exists');
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

      console.log('Inserting quiz into SQLite');
      await db.run(
        `
        INSERT INTO quizzes (
          id, title, description, questions, difficulty, estimatedTime, rewards, source, createdAt, rewardType, rewardAmount, nftMetadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          quiz.id,
          quiz.title,
          quiz.description,
          JSON.stringify(quiz.questions),
          quiz.difficulty,
          quiz.estimatedTime,
          JSON.stringify(quiz.rewards),
          JSON.stringify(quiz.source),
          quiz.createdAt.toISOString(),
          quiz.rewardType,
          quiz.rewardAmount,
          quiz.nftMetadata,
        ]
      );
      console.log('Quiz saved to SQLite');
    } catch (sqliteError: any) {
      console.error('SQLite error:', {
        message: sqliteError.message,
        code: sqliteError.code,
        stack: sqliteError.stack,
      });
      const response = { error: `Failed to save quiz to SQLite: ${sqliteError.message}` };
      console.log('Returning error response:', response);
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      console.log('Closing SQLite database');
      await db.close();
    }

    const response = { quiz };
    console.log('Returning success response:', response);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error creating quiz:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    const response = { error: error.message || 'Failed to create quiz' };
    console.log('Returning error response:', response);
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}