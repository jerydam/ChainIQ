"use client";
import { useState } from 'react';
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
  const [generationStatus, setGenerationStatus] = useState('');

  const generateQuiz = async () => {
    if (!topic) {
      alert('Please enter a topic.');
      return;
    }
    if (!image) {
      alert('Please upload an image for the NFT.');
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('Generating quiz...');

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

      const text = await response.text();
      if (!response.ok) {
        let errorMessage = 'Failed to create quiz.';
        try {
          const data = JSON.parse(text);
          errorMessage = data.error || errorMessage;
        } catch {
          console.error('Non-JSON response:', text);
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON response.');
      }

      if (!data.quiz) {
        throw new Error('No quiz data returned.');
      }

      onQuizGenerated(data.quiz);
      setGenerationStatus('Quiz created successfully!');
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      setGenerationStatus(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenerationStatus(''), 5000);
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
            className="w-full p-2 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500/50 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-800 transition-all"
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
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.size > 5 * 1024 * 1024) {
                alert('Image size must be less than 5MB.');
                return;
              }
              setImage(file || null);
            }}
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
        {generationStatus && (
          <p className="text-center text-gray-300">{generationStatus}</p>
        )}
      </div>
    </div>
  );
}