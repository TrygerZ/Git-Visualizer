import React, { useState } from 'react';
import { RepoInput } from './components/RepoInput';
import { CommitGraph } from './components/CommitGraph';
import { RepoData } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, GitGraph as GraphIcon, ArrowRight, Github, Key, Languages } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<RepoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'id'>('en');

  const t = {
    badge: language === 'en' ? 'Interactive Commit Tree' : 'Pohon Komit Interaktif',
    title1: language === 'en' ? 'Visualize your ' : 'Visualisasikan ',
    title2: language === 'en' ? 'Git Repository' : 'Repositori Git Anda',
    subtitle: language === 'en' ? 'Modern, clean, and interactive Directed Acyclic Graph (DAG) for your GitHub repositories. Explore branch merges and commit flows with ease.' : 'Directed Acyclic Graph (DAG) yang modern, bersih, dan interaktif untuk repositori GitHub Anda. Jelajahi merge branch dan alur komit dengan mudah.',
    failed: language === 'en' ? 'Visualization Failed' : 'Visualisasi Gagal',
    ready: language === 'en' ? 'Ready to explore' : 'Siap untuk menjelajahi',
    readySub: language === 'en' ? 'Enter a repository URL above to see its technical architecture and commit history in a visual tree.' : 'Masukkan URL repositori di atas untuk melihat arsitektur teknis dan riwayat komitnya dalam bentuk pohon visual.',
    footer: language === 'en' ? 'Optimized for standard web browsers.' : 'Dioptimalkan untuk web browser standar.',
  };

  const handleSearch = async (url: string, token: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['x-github-token'] = token;
      }
      
      const response = await fetch(`/api/repo?url=${encodeURIComponent(url)}`, {
        headers
      });
      
      const contentType = response.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        // If it's a proxy HTML error like 502 or 403 from WAF/CloudRun
        if (text.includes("502") || text.includes("Gateway")) {
          throw new Error(language === 'en' 
            ? 'Network or proxy timeout (502). Processing a very large repository or request was blocked. Please try another repository.' 
            : 'Terjadi kesalahan jaringan atau server terlalu lama merespons (502). Sedang memproses data repositori GitHub yang sangat besar atau request di-block. Silahkan coba repositori lain.');
        } else if (response.status === 403) {
          throw new Error('Batas permintaan');
        } else {
          throw new Error(`Server returned an unexpected format: ${response.status} ${response.statusText}`);
        }
      }

      if (!response.ok) {
        throw new Error(result.error || 'Something went wrong');
      }

      setData(result);
    } catch (err: any) {
      if (err.message === 'Batas permintaan') {
          setError(language === 'en' ? 'GitHub API rate limit exceeded. You can use your own GitHub Personal Access Token (PAT) via the Settings button next to the Visualize button.' : 'Batas permintaan (Rate Limit) GitHub API tercapai. Anda bisa menggunakan GitHub Personal Access Token (PAT) Anda sendiri lewat tombol Setting di samping tombol Visualize.');
      } else {
          setError(err.message);
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-body font-sans selection:bg-accent-blue/20">
      {/* Background Hero Stripe */}
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden pointer-events-none">
        <div className="absolute top-[-100px] right-[-100px] w-full h-full opacity-10">
          <div className="absolute rotate-45 w-[200%] h-20 bg-gradient-to-r from-accent-red to-transparent transform translate-y-0" />
          <div className="absolute rotate-45 w-[200%] h-20 bg-gradient-to-r from-accent-red to-transparent transform translate-y-32" />
          <div className="absolute rotate-45 w-[200%] h-20 bg-gradient-to-r from-accent-red to-transparent transform translate-y-64" />
        </div>
      </div>

      <header className={`relative z-10 transition-all duration-300 ${data ? 'pt-6 pb-4 px-4 md:pt-10 md:pb-6' : 'pt-16 pb-12 px-6'}`}>
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
          <div 
            className="flex items-center p-1 rounded-full bg-surface-elevated border border-hairline relative"
            title={language === 'en' ? 'Ganti ke Bahasa Indonesia' : 'Switch to English'}
          >
            <div 
              className={`absolute top-1 bottom-1 w-12 bg-surface min-h-[32px] border border-hairline-strong rounded-full transition-transform duration-300 ${language === 'en' ? 'translate-x-0' : 'translate-x-12'}`} 
            />
            <button
              onClick={() => setLanguage('en')}
              className={`relative z-10 w-12 h-8 flex items-center justify-center text-xs font-bold tracking-wider rounded-full transition-colors ${language === 'en' ? 'text-accent-blue' : 'text-ash hover:text-white'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('id')}
              className={`relative z-10 w-12 h-8 flex items-center justify-center text-xs font-bold tracking-wider rounded-full transition-colors ${language === 'id' ? 'text-accent-blue' : 'text-ash hover:text-white'}`}
            >
              ID
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto text-center space-y-4 sm:space-y-6">
          {!data && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-surface-elevated border border-hairline text-accent-blue text-sm font-medium"
              >
                <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                {t.badge}
              </motion.div>

              <div className="space-y-3 sm:space-y-4">
                <h1 className="text-4xl md:text-6xl font-semibold text-ink tracking-tight">
                  {t.title1} <span className="text-white">{t.title2}</span>
                </h1>
                <p className="text-sm sm:text-lg text-ash max-w-2xl mx-auto px-4">
                  {t.subtitle}
                </p>
              </div>
            </>
          )}

          <div className={`${data ? 'max-w-md mx-auto sm:max-w-2xl' : ''}`}>
            <RepoInput onSearch={handleSearch} isLoading={loading} language={language} />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-24 min-h-[500px] md:min-h-[600px]">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 mx-auto max-w-3xl p-6 bg-surface-elevated border border-accent-red/30 rounded-2xl flex flex-col sm:flex-row items-start gap-5 shadow-[0_8px_30px_rgba(255,97,97,0.1)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-accent-red" />
              <div className="p-3 bg-accent-red/10 rounded-xl text-accent-red shrink-0">
                <AlertCircle size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-ink mb-2">{t.failed}</h3>
                <div className="text-sm text-ash leading-relaxed">
                  {error.includes("GitHub API rate limit exceeded") || error.includes("Batas permintaan (Rate Limit) GitHub API tercapai") ? (
                    <div>
                      <p className="mb-3 text-ink/90 text-sm">{language === 'en' ? 'GitHub API rate limit exceeded.' : 'Batas permintaan (Rate Limit) GitHub API tercapai.'}</p>
                      <div className="p-3.5 bg-surface rounded-xl border border-hairline flex items-center gap-3">
                        <Key size={18} className="text-accent-blue shrink-0" />
                        <p>
                          {language === 'en' 
                            ? <span>You can use your own <strong>GitHub Personal Access Token (PAT)</strong> via the Settings button next to the Visualize button.</span>
                            : <span>Anda bisa menggunakan <strong>GitHub Personal Access Token (PAT)</strong> Anda sendiri lewat tombol Setting di samping tombol Visualize.</span>
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p>{error}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {data ? (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 md:mt-12 h-[550px] md:h-[800px]"
            >
              <CommitGraph elements={data.elements} repoName={`${data.owner}/${data.repo}`} language={language} />
            </motion.div>
          ) : !loading && !error && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-20 flex flex-col items-center justify-center p-12 border-2 border-dashed border-hairline rounded-3xl"
            >
              <div className="w-16 h-16 bg-surface-elevated rounded-2xl flex items-center justify-center text-ash mb-6">
                <GraphIcon size={32} />
              </div>
              <h3 className="text-xl font-medium text-ink mb-2">{t.ready}</h3>
              <p className="text-ash text-center max-w-sm">
                {t.readySub}
              </p>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
                {[
                  { name: 'facebook/react', url: 'https://github.com/facebook/react' },
                  { name: 'lucide-icons/lucide', url: 'https://github.com/lucide-icons/lucide' }
                ].map(example => (
                  <button
                    key={example.name}
                    onClick={() => handleSearch(example.url)}
                    className="flex items-center justify-between p-4 bg-surface hover:bg-surface-elevated border border-hairline rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Github size={18} className="text-ash" />
                      <span className="text-body font-medium">{example.name}</span>
                    </div>
                    <ArrowRight size={16} className="text-ash group-hover:text-white transition-colors" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-hairline py-12 px-6 mt-12 bg-surface">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-ink font-semibold">
            <GraphIcon size={20} className="text-accent-blue" />
            GitVisualizer
          </div>
          <p className="text-ash text-sm">
            © 2026 Built with Inter ss03. {t.footer}
          </p>
        </div>
      </footer>
    </div>
  );
}
