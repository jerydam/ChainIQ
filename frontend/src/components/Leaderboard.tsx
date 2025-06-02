// components/Leaderboard.tsx
'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface LeaderboardEntry {
  address: string;
  attemptsUntilPerfect: number;
  totalTime: number;
}

interface LeaderboardProps {
  quizId: string;
  className?: string;
  onRefresh?: () => void; // Callback for refresh
}

export function Leaderboard({ quizId, className, onRefresh }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/leaderboard?quizId=${quizId}`);
      if (!response.ok) throw new Error(`Failed to fetch leaderboard: ${response.status}`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (err: any) {
      console.error('Error fetching leaderboard:', err);
      toast.error('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [quizId]);

  const handleRefresh = () => {
    fetchLeaderboard();
    if (onRefresh) onRefresh();
  };

  if (loading) {
    return <div className={`text-center text-gray-300 ${className}`}>Loading leaderboard...</div>;
  }

  return (
    <div className={`bg-white/10 rounded-xl p-6 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">🏆 Leaderboard</h3>
        <button
          className="text-blue-400 hover:text-blue-300 text-sm"
          onClick={handleRefresh}
        >
          Refresh
        </button>
      </div>
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