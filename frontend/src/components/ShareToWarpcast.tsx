"use client";
import { useState } from 'react';
import toast from 'react-hot-toast';

interface ShareToWarpcastProps {
  quizTitle: string;
  quizId: string;
  userAddress: string;
  username: string;
}

export function ShareToWarpcast({ quizTitle, quizId, userAddress, username }: ShareToWarpcastProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const shareText = `I just took the "${quizTitle}" quiz on QuizChain! Try it out: ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/quiz/${quizId} @${username}`;
      const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/frames/quiz/image?quizId=${quizId}&username=${encodeURIComponent(username)}`)}`;
      window.open(shareUrl, '_blank');
      toast.success('Shared to Warpcast!');
    } catch (err: any) {
      console.error('Error sharing to Warpcast:', err);
      toast.error('Failed to share to Warpcast.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={isSharing || !userAddress || !username}
      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:bg-gray-600"
    >
      {isSharing ? 'Sharing...' : 'Share to Warpcast'}
    </button>
  );
}