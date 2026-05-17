import React, { useState } from 'react';
import { Search, Github, Loader2, Key, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RepoInputProps {
  onSearch: (url: string, token: string) => void;
  isLoading: boolean;
  language?: 'en' | 'id';
}

export const RepoInput = ({ onSearch, isLoading, language = 'en' }: RepoInputProps) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const t = {
    placeholder: language === 'en' ? 'Enter public GitHub URL (e.g. https://github.com/facebook/react)' : 'Masukkan URL GitHub publik (misal. https://github.com/facebook/react)',
    visualize: language === 'en' ? 'Visualize' : 'Visualisasi',
    tokenLabel: language === 'en' ? 'GitHub Personal Access Token (Optional)' : 'GitHub Personal Access Token (Opsional)',
    tokenHelp1: language === 'en' ? 'Provide a PAT to bypass the GitHub API rate limits.' : 'Masukkan PAT untuk menambah batas limit permintaan (rate limit) API GitHub.',
    tokenHelp2: language === 'en' ? 'Get a token here' : 'Dapatkan token di sini',
    tokenHelp3: language === 'en' ? 'The token is never saved on our servers.' : 'Token tidak akan pernah disimpan di server kami.',
    hint: language === 'en' ? 'Enter any public repository link to generate an interactive branching graph.' : 'Masukkan tautan repositori publik apa pun untuk menghasilkan grafik percabangan interaktif.',
    settings: language === 'en' ? 'Advanced Settings' : 'Pengaturan Lanjutan',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSearch(url.trim(), token.trim());
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-ash group-focus-within:text-white transition-colors">
          <Github size={20} />
        </div>
        
        <input
          id="github-url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t.placeholder}
          className="w-full h-14 pl-12 pr-[210px] bg-surface-elevated border border-hairline rounded-xl text-ink placeholder:text-ash outline-none focus:border-hairline-strong focus:ring-1 focus:ring-white/10 transition-all font-sans"
        />

        <div className="absolute inset-y-0 right-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors border ${showSettings ? 'border-accent-blue/50 bg-accent-blue/20 text-accent-blue shadow-[0_0_10px_rgba(87,193,255,0.2)]' : 'border-hairline bg-surface text-ash hover:text-white hover:border-hairline-strong hover:bg-white/5'} z-10 flex items-center justify-center`}
            title={t.settings}
          >
             <Settings2 size={18} />
          </button>
          <button
            type="submit"
            disabled={isLoading || !url}
            className="flex items-center gap-2 px-6 h-10 bg-accent-blue text-[#0d0d0d] rounded-lg font-bold hover:bg-blue-400 disabled:opacity-40 disabled:bg-surface disabled:text-white disabled:border disabled:border-hairline disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(87,193,255,0.4)] disabled:shadow-none z-10"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <Search size={18} />
                <span>{t.visualize}</span>
              </>
            )}
          </button>
        </div>
      </form>
      
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3"
          >
            <div className="relative border border-hairline bg-surface-elevated rounded-xl p-4">
              <label className="text-xs font-semibold text-ash uppercase tracking-wider mb-2 flex items-center gap-2">
                <Key size={14} />
                {t.tokenLabel}
              </label>
              <input
                id="github-token-input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxx..."
                className="w-full h-10 px-3 bg-surface border border-hairline rounded-lg text-ink placeholder:text-ash outline-none focus:border-hairline-strong focus:ring-1 focus:ring-white/10 transition-all font-mono text-sm"
              />
              <p className="text-xs text-ash mt-2">
                {t.tokenHelp1} <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-accent-blue hover:underline">{t.tokenHelp2}</a>. {t.tokenHelp3}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-4 text-center text-xs text-ash">
        {t.hint}
      </p>
    </motion.div>
  );
};
