import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Contributor {
  name: string;
  avatar?: string;
  url?: string;
}

interface ContributorPanelProps {
  contributors: Contributor[];
  activeContributorName: string | null;
  language?: 'en' | 'id';
}

export const ContributorPanel = ({ contributors, activeContributorName, language = 'en' }: ContributorPanelProps) => {
  const [isMinimized, setIsMinimized] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMinimized(true);
    }
  }, []);

  return (
    <div className="flex flex-col p-4 bg-surface/80 backdrop-blur-2xl border border-hairline/60 rounded-2xl shadow-2xl transition-all hover:bg-surface-elevated/80 duration-300">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-white/90 uppercase tracking-widest px-1">{language === 'en' ? 'Contributors' : 'Kontributor'}</h3>
          <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-medium">{contributors.length}</span>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-ash hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
        >
          {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      
      <AnimatePresence initial={false}>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0, overflow: 'hidden' }}
            animate={{ height: 'auto', opacity: 1, marginTop: 12, transitionEnd: { overflow: 'visible' } }}
            exit={{ height: 0, opacity: 0, marginTop: 0, overflow: 'hidden' }}
          >
            <div className="flex flex-wrap gap-3 max-w-[240px] p-4 -m-4">
              {contributors.map((contributor) => {
                const isActive = contributor.name === activeContributorName;
                
                return (
                  <motion.div
                    key={contributor.name}
                    initial={false}
                    animate={{
                      scale: isActive ? 1.25 : 1,
                      zIndex: isActive ? 50 : 1,
                    }}
                    className="relative group"
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && contributor.url) {
                        window.open(contributor.url, '_blank');
                      }
                    }}
                    onClick={() => contributor.url && window.open(contributor.url, '_blank')}
                  >
                    <div
                      className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all duration-300 cursor-pointer ${
                        isActive 
                          ? 'border-accent-blue shadow-[0_0_20px_rgba(59,130,246,0.6)] ring-4 ring-accent-blue/20' 
                          : 'border-white/10 group-hover:border-white/40 group-hover:shadow-lg'
                      }`}
                    >
                      {contributor.avatar ? (
                        <img 
                          src={contributor.avatar} 
                          alt={contributor.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-card flex items-center justify-center text-ash text-xs font-bold">
                          {contributor.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.9 }}
                          className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white text-black text-[10px] px-2 py-1 rounded-md font-bold shadow-xl pointer-events-none z-50 border border-white/20"
                        >
                          {contributor.name}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
