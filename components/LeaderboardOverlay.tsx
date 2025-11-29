import React, { useEffect, useState } from 'react';
import { X, Trophy, Medal } from 'lucide-react';

export interface ScoreEntry {
  name: string;
  score: number;
  isUser?: boolean;
}

interface LeaderboardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOCK_NAMES = ["ANALOG_KID", "SINE_WAVE", "HZ_HERO", "OSC_MASTER", "FILTER_GOD"];

export const LeaderboardOverlay: React.FC<LeaderboardOverlayProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'CAMPAIGN' | 'DAILY' | 'INFINITE' | 'NERVES'>('CAMPAIGN');
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Generate scores based on tab
    const userKey = `waveclash_high_${activeTab.toLowerCase()}`;
    const userScore = parseInt(localStorage.getItem(userKey) || '0');
    
    // Create mock leaderboard based on realistic scores for that mode
    let baseScore = 5000;
    if (activeTab === 'DAILY') baseScore = 3000;
    if (activeTab === 'INFINITE') baseScore = 15000;
    if (activeTab === 'NERVES') baseScore = 25000; // High scores for Nerves mode due to multiplier
    
    const generated: ScoreEntry[] = MOCK_NAMES.map((name, i) => ({
        name,
        score: Math.floor(baseScore * (1 - i * 0.15))
    }));

    // Insert user
    if (userScore > 0) {
        generated.push({ name: "YOU", score: userScore, isUser: true });
    }

    // Sort
    generated.sort((a, b) => b.score - a.score);
    
    setScores(generated.slice(0, 6)); // Top 6
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
       <div className="w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
          <div className="flex justify-between items-center p-4 border-b-4 border-black bg-blue-600 text-white">
              <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                  <Trophy className="text-yellow-300" /> LEADERBOARD
              </h2>
              <button onClick={onClose} className="hover:bg-black/20 p-1 rounded"><X size={24} /></button>
          </div>

          <div className="flex border-b-4 border-black bg-gray-100 overflow-x-auto">
              {(['CAMPAIGN', 'DAILY', 'INFINITE', 'NERVES'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 px-2 font-bold text-xs sm:text-sm transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-black text-white' : 'hover:bg-gray-200 text-gray-500'}`}
                  >
                      {tab}
                  </button>
              ))}
          </div>

          <div className="p-4 space-y-2">
              {scores.map((entry, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between p-3 border-2 border-black ${entry.isUser ? 'bg-yellow-300' : 'bg-white'}`}
                  >
                      <div className="flex items-center gap-3">
                          <div className="font-black w-6 text-center text-lg">
                              {idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : idx + 1}
                          </div>
                          <div className="font-mono font-bold">
                              {entry.name} {entry.isUser && '(YOU)'}
                          </div>
                      </div>
                      <div className="font-black text-xl tracking-tight">
                          {entry.score.toLocaleString()}
                      </div>
                  </div>
              ))}
              {scores.length === 0 && <div className="text-center py-8 font-bold text-gray-400">NO DATA LOGGED</div>}
          </div>
       </div>
    </div>
  );
};