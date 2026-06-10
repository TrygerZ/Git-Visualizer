import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Minus } from 'lucide-react';
import { GraphElement } from '../types';

// Data Aggregation Hook
export function useLeaderboardData(nodes: GraphElement[]) {
  return useMemo(() => {
    const authorCounts: Record<string, number> = {};
    let totalCommits = 0;

    // Iterasi setiap elemen (bisa commit tunggal atau folded/kumpulan komit)
    nodes.forEach(node => {
      if (node.type === 'commit') {
        const author = node.data.author || 'Unknown';
        authorCounts[author] = (authorCounts[author] || 0) + 1;
        totalCommits++;
      } else if (node.type === 'folded') {
        node.commits.forEach(commit => {
          const author = commit.author || 'Unknown';
          authorCounts[author] = (authorCounts[author] || 0) + 1;
          totalCommits++;
        });
      }
    });

    const leaderboard = Object.entries(authorCounts).map(([authorName, commits]) => ({
      authorName,
      commits,
      percentage: totalCommits > 0 ? (commits / totalCommits) * 100 : 0
    }));

    // Urutkan secara descending berdasarkan jumlah komit
    leaderboard.sort((a, b) => b.commits - a.commits);

    return leaderboard;
  }, [nodes]);
}

interface ContributorLeaderboardProps {
  nodes: GraphElement[];
  language?: 'en' | 'id';
}

export const ContributorLeaderboard = ({ nodes, language = 'en' }: ContributorLeaderboardProps) => {
  const [isMinimized, setIsMinimized] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const leaderboardData = useLeaderboardData(nodes);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMinimized(true);
    }
  }, []);

  return (
    <div className="relative z-[60]">
      <AnimatePresence mode="wait">
        {isMinimized ? (
          <motion.button
            key="minimized"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 px-4 py-2 bg-surface/80 backdrop-blur-2xl border border-hairline/60 rounded-full shadow-2xl hover:bg-surface-elevated/80 transition-all text-white font-medium"
          >
            <Trophy size={16} className="text-yellow-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-ash">Leaderboard</span>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="w-72 bg-surface/90 backdrop-blur-2xl border border-hairline/60 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-4 py-3 border-b border-hairline/50 bg-black/20">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Trophy size={14} className="text-yellow-400" />
                Top Contributors
              </h3>
              <button
                onClick={() => setIsMinimized(true)}
                className="text-ash hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-md"
                title="Minimize"
              >
                <Minus size={14} />
              </button>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-4 custom-scrollbar">
              {leaderboardData.map((item, index) => (
                <div key={item.authorName} className="flex gap-3 items-center group">
                  <div className="w-5 text-center text-xs font-bold text-gray-500 group-hover:text-gray-300 transition-colors">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-end mb-1.5 relative">
                      <p className="text-sm text-white/90 font-medium truncate pr-2 group-hover:text-white transition-colors" title={item.authorName}>
                        {item.authorName}
                      </p>
                      <span className="text-[10px] font-bold bg-white/10 text-white/80 px-1.5 py-0.5 rounded-md border border-white/5">
                        {item.commits}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#B45309' : '#3b82f6' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {leaderboardData.length === 0 && (
                <p className="text-sm text-ash text-center py-4">No contributors found.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
