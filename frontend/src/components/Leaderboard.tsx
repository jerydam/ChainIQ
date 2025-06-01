"use client";
import { useState, useEffect } from 'react';

interface LeaderboardEntry {
  address: string;
  attemptsUntilPerfect: number;
  totalTime: number;
}

interface LeaderboardProps {
  quizId: string;
}

export function Leaderboard({ quizId }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`/api/leaderboard?quizId=${quizId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }
        const data = await response.json();
        setLeaderboard(data);
      } catch (err: any) {
        console.error('Error fetching leaderboard:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [quizId]);

  if (loading) {
    return <div className="text-center text-gray-300">Loading leaderboard...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  return (
    <div className="bg-white/10 rounded-xl p-6 mt-8">
      <h3 className="text-xl font-bold text-white mb-4">🏆 Leaderboard</h3>
      {leaderboard.length === 0 ? (
        <p className="text-center text-gray-400">No attempts yet. Be the first!</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="text-gray-300">
              <th className="p-2">Player</th>
              <th className="p-2">Attempts Until Perfect</th>
              <th className="p-2">Total Time (s)</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <tr key={index} className="border-t border-gray-700">
                <td className="p-2 text-white">{entry.address}</td>
                <td className="p-2 text-white">{entry.attemptsUntilPerfect}</td>
                <td className="p-2 text-white">{entry.totalTime.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}