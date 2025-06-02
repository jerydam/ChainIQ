"use client";
import { useState } from 'react';
import toast from 'react-hot-toast';
import type { Quiz } from '@/types/quiz';

interface QuizGeneratorProps {
  onQuizGenerated: (quiz: Quiz) => void;
}

export function QuizGenerator({ onQuizGenerated }: QuizGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [questionCount, setQuestionCount] = useState(5);
  const [image, setImage] = useState<File | null>(null);

  const generateQuiz = async () => {
    if (!topic) {
      toast.error('Please enter a topic.');
      return;
    }
    if (!image) {
      toast.error('Please upload an image for the NFT.');
      return;
    }
    if (image.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('topic', topic);
      formData.append('difficulty', difficulty);
      formData.append('questionCount', String(questionCount));
      formData.append('image', image);

      const response = await fetch('/api/createQuiz', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create quiz.');
      }

      const { quiz } = await response.json();
      if (!quiz) throw new Error('No quiz data returned.');
      onQuizGenerated(quiz);
      toast.success('Quiz created successfully!');
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white/10 rounded-xl p-6">
      <h2 className="text-2xl font-bold text-white mb-4">🧠 Create a Quiz</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-gray-300 mb-1">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full p-2 bg-white/5 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500/50"
            placeholder="e.g., Blockchain Basics"
          />
        </div>
        <div>
          <label className="block text-gray-300 mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
            className="w-full p-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500/50"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-300 mb-1">Number of Questions</label>
          <input
            type="number"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            min="1"
            max="20"
            className="w-full p-2 bg-white/5 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500/50"
          />
        </div>
        <div>
          <label className="block text-gray-300 mb-1">NFT Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="w-full p-2 bg-white/5 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500/50"
          />
        </div>
        <button
          onClick={generateQuiz}
          disabled={isGenerating}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg"
        >
          {isGenerating ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Generating...</span>
            </div>
          ) : (
            '🚀 Create Quiz'
          )}
        </button>
      </div>
    </div>
  );
}