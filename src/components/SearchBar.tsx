import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export const SearchBar = ({ value, onChange }: SearchBarProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const isExpanded = isOpen || value.length > 0;

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="search-btn"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center w-10 h-10 bg-surface/90 backdrop-blur-2xl border border-hairline/60 rounded-full shadow-2xl text-ash hover:text-white transition-all hover:bg-surface-elevated/95 md:hidden"
            title="Search"
          >
            <Search size={18} />
          </motion.button>
        ) : (
          <motion.div 
            key="search-input"
            initial={{ opacity: 0, width: 40 }}
            animate={{ opacity: 1, width: 220 }}
            exit={{ opacity: 0, width: 40 }}
            className="relative flex items-center bg-surface/90 backdrop-blur-2xl border border-hairline/60 rounded-full shadow-2xl overflow-hidden md:hidden transition-all focus-within:border-white/30 focus-within:ring-4 focus-within:ring-white/10"
          >
            <div className="pl-3.5 pr-1.5 text-ash">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent border-none outline-none py-2 text-xs text-white placeholder:text-ash/70 min-w-0"
            />
            <button
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="pr-3.5 pl-1.5 text-ash hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hidden md:flex items-center bg-surface/80 backdrop-blur-2xl border border-hairline/60 rounded-full shadow-2xl overflow-hidden w-80 transition-all focus-within:w-96 focus-within:border-white/30 focus-within:ring-4 focus-within:ring-white/10">
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
      </div>
    </div>
  );
};

