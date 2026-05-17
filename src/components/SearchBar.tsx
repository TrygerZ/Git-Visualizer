import React from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export const SearchBar = ({ value, onChange }: SearchBarProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center bg-surface/80 backdrop-blur-2xl border border-hairline/60 rounded-full shadow-2xl overflow-hidden w-64 sm:w-80 transition-all focus-within:w-80 sm:focus-within:w-96 focus-within:border-white/30 focus-within:ring-4 focus-within:ring-white/10"
    >
      <div className="pl-4 pr-2 text-ash group-focus-within:text-white transition-colors">
        <Search size={18} />
      </div>
      <input
        type="text"
        placeholder="Search commits, authors, hashes..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent border-none outline-none py-2.5 text-sm text-white placeholder:text-ash/70 min-w-0"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => onChange('')}
            className="pr-4 pl-2 text-ash hover:text-white transition-colors"
          >
            <X size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
