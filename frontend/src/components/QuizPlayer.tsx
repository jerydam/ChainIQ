import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';
import { Quiz, Question } from '@/types/quiz';
import { QuizRewardsABI } from '@/lib/QuizAbi';
import toast from 'react-hot-toast';
import { useWallet } from '@/components/context/WalletContext';
import { createWalletClient, custom } from 'viem';
import { celo } from 'viem/chains';
import { sendTransactionWithDivvi } from '@/lib/divvi';

interface QuizPlayerProps {
  quiz: Quiz;
  isFrame?: boolean;
  onComplete?: () => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ quiz, isFrame = false, onComplete }) => {
  const router = useRouter();
  const { userAddress, isConnected } = useWallet();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [hasPerfectScore, setHasPerfectScore] = useState(false);
  const [timer, setTimer] = useState(10);
  const [attemptCount, setAttemptCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isFrame) return;

    const initialize = async () => {
      if (!userAddress) return;
      try {
        const response = await fetch(`/api/quizAttempts?quizId=${quiz.id}&address=${userAddress}`);
        if (response.ok) {
          const { attempt, allAttempts } = await response.json();
          if (attempt && attempt.score === quiz.questions.length) {
            setHasPerfectScore(true);
            setScore(attempt.score);
            setIsQuizComplete(true);
          } else if (attempt) {
            setScore(attempt.score);
          }
          setAttemptCount(allAttempts ? allAttempts.length : 0);
        } else {
          toast.error('Failed to load quiz data.');
        }
      } catch (err: any) {
        toast.error('Failed to load quiz data.');
      }
    };
    initialize();
    setStartTime(Date.now());
  }, [quiz.id, quiz.questions.length, userAddress, isFrame]);

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
  };

  const handleNextQuestion = async (isTimeout = false) => {
    if (!isTimeout && selectedAnswer === null) {
      toast.error('Please select an answer.');
      return;
    }

    const currentQuestion = quiz.questions[currentQuestionIndex];
    if (!isTimeout && selectedAnswer === currentQuestion.correctAnswer) {
      setScore(prev => prev + 1);
    }

    setSelectedAnswer(null);
    setTimer(10);

    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setIsQuizComplete(true);
      await submitQuiz();
      if (onComplete) onComplete();
    }
  };

  const submitQuiz = async () => {
    if (isFrame || !userAddress) {
      toast.error('Please connect your wallet.');
      return;
    }

    setIsLoading(true);
    try {
      const endTime = Date.now();
      const timeTaken = startTime ? (endTime - startTime) / 1000 : 0;

      // Save quiz attempt
      try {
        const attemptResponse = await fetch('/api/quizAttempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizId: quiz.id,
            address: userAddress,
            score,
            timeTaken,
          }),
        });
        if (attemptResponse.ok) {
          setAttemptCount(prev => prev + 1);
        } else {
          toast.error('Failed to save quiz attempt, but proceeding with blockchain.');
        }
      } catch (apiErr: any) {
        toast.error('Failed to save quiz attempt, but proceeding with blockchain.');
      }

      // Record completion and claim NFT for perfect score
      if (score === quiz.questions.length) {
        setHasPerfectScore(true);
        if (!isConnected || !window.ethereum) {
          throw new Error('Wallet not connected or MetaMask not detected');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== celo.id) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${celo.id.toString(16)}` }],
            });
          } catch (switchError: any) {
            throw new Error('Please switch to Celo Mainnet');
          }
        }

        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS!,
          QuizRewardsABI,
          signer
        );
        const walletClient = createWalletClient({
          chain: celo,
          transport: custom(window.ethereum!),
        });

        // Record quiz completion with Divvi
        await sendTransactionWithDivvi(
          contract,
          'recordQuizCompletion',
          [quiz.id],
          walletClient,
          provider
        );
        toast.success('Quiz completion recorded on blockchain!');

        // Claim NFT with Divvi
        await sendTransactionWithDivvi(
          contract,
          'claimNFTReward',
          [quiz.id],
          walletClient,
          provider
        );
        toast.success('NFT reward claimed successfully! 🎉');
      }
    } catch (err: any) {
      toast.error(
        err.message.includes('INSUFFICIENT_FUNDS')
          ? 'Insufficient funds for gas. Get CELO at a faucet.'
          : err.message
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (hasPerfectScore) {
      toast.error('You have a perfect score and cannot retake this quiz.');
      return;
    }
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsQuizComplete(false);
    setTimer(10);
    setStartTime(Date.now());
  };

  if (hasPerfectScore && !isFrame) {
    return (
      <div className="p-4 bg-gray-800/50 rounded-xl">
        <h2 className="text-2xl font-bold text-blue-300">You've Mastered the Quiz!</h2>
        <p className="text-gray-300">
          Perfect score: {score}/{quiz.questions.length}. NFT minted!
        </p>
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
    return (
      <div className="p-4 bg-gray-800/50 rounded-xl">
        <h2 className="text-2xl font-bold text-blue-300">Quiz Complete!</h2>
        <p className="text-gray-300">
          Your score: {score}/{quiz.questions.length}
          {score === quiz.questions.length ? ' - Perfect score! NFT minted!' : ''}
        </p>
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
              selectedAnswer === option ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
            onClick={() => handleAnswerSelect(option)}
            disabled={isLoading}
          >
            {option}
          </button>
        ))}
      </div>
      <button
        className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        onClick={() => handleNextQuestion()}
        disabled={false}
      >
        {isLoading ? 'Processing...' : 'Next'}
      </button>
    </div>
  );
};

export default QuizPlayer;