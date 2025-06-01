"use client";
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';
import { Quiz, Question } from '@/types/quiz';
import { QuizRewardsABI } from '@/abis/QuizAbi';

const setTimeout = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

interface QuizPlayerProps {
  quiz: Quiz;
  isFrame?: boolean;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ quiz, isFrame = false }) => {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPerfectScore, setHasPerfectScore] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [timer, setTimer] = useState(10);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    if (isFrame) return;

    const initialize = async () => {
      try {
        if (typeof window.ethereum === 'undefined') {
          throw new Error('Please install MetaMask or another wallet');
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        if (accounts.length === 0) {
          throw new Error('No wallet accounts found');
        }
        setWalletAddress(accounts[0]);
        console.log('Wallet connected:', accounts[0]);

        const response = await fetch(`/api/quizAttempts?quizId=${quiz.id}&address=${accounts[0]}`);
        if (response.ok) {
          const { attempt, allAttempts } = await response.json();
          if (attempt && attempt.score === quiz.questions.length) {
            setHasPerfectScore(true);
            setScore(attempt.score);
            setIsQuizComplete(true);
            console.log('Perfect score found:', attempt.score);
          } else if (attempt) {
            setScore(attempt.score);
            console.log('Prior attempt found:', attempt.score);
          }
          setAttemptCount(allAttempts ? allAttempts.length : 0);
        } else {
          console.error('Failed to check attempts:', response.status);
          setError('Failed to check prior attempts');
        }
      } catch (err: any) {
        console.error('Initialization error:', err.message);
        setError('Failed to connect wallet: ' + err.message);
      }
    };
    initialize();
  }, [quiz.id, isFrame]);

  useEffect(() => {
    if (isFrame || isQuizComplete || hasPerfectScore) return;

    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleNextQuestion(true);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestionIndex, isQuizComplete, hasPerfectScore, isFrame]);

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    console.log('Answer selected:', answer);
  };

  const handleNextQuestion = async (isTimeout = false) => {
    if (!isTimeout && selectedAnswer === null) {
      setError('Please select an answer');
      console.log('No answer selected');
      return;
    }

    const currentQuestion = quiz.questions[currentQuestionIndex];
    if (!isTimeout && selectedAnswer === currentQuestion.correctAnswer) {
      setScore(score + 1);
      console.log('Correct answer, score:', score + 1);
    } else if (isTimeout) {
      console.log('Timeout, no points');
    }

    setSelectedAnswer(null);
    setError(null);
    setTimer(10);

    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      console.log('Next question:', currentQuestionIndex + 1);
    } else {
      setIsQuizComplete(true);
      console.log('Quiz completed');
      await submitQuiz();
    }
  };

  const submitQuiz = async () => {
    if (isFrame) return;

    if (!walletAddress) {
      setError('Wallet not connected');
      console.log('Wallet not connected');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Submitting attempt:', { quizId: quiz.id, score, address: walletAddress });

      const attemptResponse = await fetch('/api/quizAttempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          address: walletAddress,
          score,
        }),
      });

      if (!attemptResponse.ok) {
        const errorText = await attemptResponse.text();
        console.error('Failed to save attempt:', attemptResponse.status, errorText);
        throw new Error('Failed to save quiz attempt');
      }
      console.log('Attempt saved');
      setAttemptCount(attemptCount + 1);

      if (score === quiz.questions.length) {
        setHasPerfectScore(true);
        const maxRetries = 5;
        let lastError: any;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`Attempt ${attempt}/${maxRetries}: Connecting to Celo`);
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const network = await provider.getNetwork();
            if (network.chainId.toString() !== '44787') {
              throw new Error('Wrong network; expected Celo Alfajores (44787)');
            }

            const contract = new ethers.Contract(
              process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS!,
              QuizRewardsABI,
              signer
            );

            const gasEstimate = await contract.recordQuizCompletion.estimateGas(quiz.id);
            const tx = await contract.recordQuizCompletion(quiz.id, {
              gasLimit: BigInt(gasEstimate) * BigInt(120) / BigInt(100),
            });
            console.log('recordQuizCompletion sent:', tx.hash);
            await tx.wait();
            console.log('recordQuizCompletion confirmed');

            const claimGasEstimate = await contract.claimNFTReward.estimateGas(quiz.id);
            const claimTx = await contract.claimNFTReward(quiz.id, {
              gasLimit: BigInt(claimGasEstimate) * BigInt(120) / BigInt(100),
            });
            console.log('claimNFTReward sent:', claimTx.hash);
            await tx.wait();
            console.log('claimNFTReward confirmed');

            break;
          } catch (err: any) {
            lastError = err;
            console.error(`Attempt ${attempt}/${maxRetries} failed:`, err.message);
            if (attempt < maxRetries && err.code === 'TIMEOUT') {
              console.warn('Retrying after 2s...');
              await setTimeout(2000);
              continue;
            }
            throw new Error(`Celo contract error: ${err.message}`);
          }
        }
        if (lastError) {
          throw lastError;
        }
      }
    } catch (err: any) {
      console.error('Error submitting quiz:', err.message);
      setError('Failed to submit quiz: ' + err.message);
    } finally {
      setIsLoading(false);
      console.log('Submission complete');
    }
  };

  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsQuizComplete(false);
    setError(null);
    setTimer(10);
    console.log('Retrying quiz');
  };

  if (hasPerfectScore && !isFrame) {
    console.log('Perfect score:', score);
    return (
      <div className="p-4 bg-gray-800/50 rounded-xl">
        <h2 className="text-2xl font-bold text-blue-300">You've Mastered the Quiz!</h2>
        <p className="text-gray-300">
          Perfect score: {score}/{quiz.questions.length}. NFT minted! No more attempts allowed.
        </p>
        {error && <p className="text-red-500 mt-2">{error}</p>}
        <button
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => router.push('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (isQuizComplete && !isFrame) {
    console.log('Quiz complete:', score);
    return (
      <div className="p-4 bg-gray-800/50 rounded-xl">
        <h2 className="text-2xl font-bold text-blue-300">Quiz Complete!</h2>
        <p className="text-gray-300">
          Your score: {score}/{quiz.questions.length}
          {score === quiz.questions.length ? ' - Perfect score! NFT minted!' : ''}
        </p>
        {error && <p className="text-red-500 mt-2">{error}</p>}
        <button
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => router.push('/')}
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Back to Home'}
        </button>
        {score !== quiz.questions.length && (
          <button
            className="mt-4 ml-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            onClick={handleRetry}
            disabled={isLoading}
          >
            Retake Quiz
          </button>
        )}
      </div>
    );
  }

  if (isFrame) {
    return <div className="p-4 text-gray-300">Quiz running in Farcaster Frame. Use Warpcast to interact.</div>;
  }

  const currentQuestion: Question = quiz.questions[currentQuestionIndex];
  console.log('Rendering question:', currentQuestionIndex + 1, currentQuestion.question);

  return (
    <div className="p-4 bg-gray-800/50 rounded-xl">
      <h2 className="text-2xl font-bold text-blue-300">{quiz.title}</h2>
      <p className="text-gray-300">
        Question {currentQuestionIndex + 1} of {quiz.questions.length}
        <span className={`ml-4 text-lg ${timer <= 3 ? 'text-red-500' : 'text-gray-300'}`}>
          Time Left: {timer}s
        </span>
      </p>
      <p className="mt-4 text-gray-200">{currentQuestion.question}</p>
      <div className="mt-4 space-y-2">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            className={`block w-full text-left p-2 rounded ${
              selectedAnswer === option ? 'bg-blue-500 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
            }`}
            onClick={() => handleAnswerSelect(option)}
            disabled={isLoading}
          >
            {option}
          </button>
        ))}
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      <button
        className="mt-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        onClick={() => handleNextQuestion()}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Next'}
      </button>
    </div>
  );
};

export default QuizPlayer;