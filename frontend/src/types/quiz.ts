export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  difficulty: string;
  estimatedTime: number;
  rewards: { nfts: number; points: number };
  source: { name: string; url: string };
  createdAt: Date;
  rewardType: string;
  rewardAmount: number;
  nftMetadata: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  tags: string[];
}

export interface UserScore {
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
  userAddress: string;
} 