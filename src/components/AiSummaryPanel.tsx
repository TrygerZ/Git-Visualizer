import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, FileText, ArrowUpRight, Plus, Minus, Layers, Sparkles } from 'lucide-react';
import { ParsedCommit } from '../lib/commitParser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface FileStat {
  name: string;
  status: string;
  add: number;
  del: number;
}

interface AiSummaryPanelProps {
  commitSha: string;
  branch: string;
  githubUrl: string;
  message: string;
  parsedData: ParsedCommit;
  rawDiff?: string | null;
  fileStats?: FileStat[];
  diffError?: string | null;
  isSummarizing?: boolean;
  language?: 'en' | 'id';
  onClose: () => void;
}

const summaryCache = new Map<string, { summary: string; timestamp: number }>();
const SUMMARY_CACHE_TTL = 10 * 60 * 1000;

const useAiSummary = (commitSha: string, language: 'en' | 'id') => {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const generateSummary = async (rawDiff: string, message: string) => {
    if (!rawDiff) return;
    setIsGeneratingAi(true);
    setAiError(null);

    const cacheKey = `${commitSha}_${language}`;
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SUMMARY_CACHE_TTL) {
      setAiSummary(cached.summary);
      setIsGeneratingAi(false);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, rawDiff, language }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI summary");
      }
      summaryCache.set(cacheKey, { summary: data.summary, timestamp: Date.now() });
      setAiSummary(data.summary);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if ((err as Error).name === 'AbortError') {
        setAiError(language === 'en' ? 'Request timed out after 15s' : 'Permintaan waktu habis setelah 15 detik');
      } else {
        setAiError(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return { aiSummary, isGeneratingAi, aiError, generateSummary };
};

export const AiSummaryPanel = ({
  commitSha,
  branch,
  githubUrl,
  message,
  parsedData,
  rawDiff,
  fileStats,
  diffError,
  isSummarizing: isFetchingDiff,
  language = 'en',
  onClose,
}: AiSummaryPanelProps) => {
  const { aiSummary, isGeneratingAi, aiError, generateSummary } = useAiSummary(commitSha, language);

  const translations = {
    generateAi: language === 'en' ? 'Generate AI Review' : 'Buat Ulasan AI',
    generating: language === 'en' ? 'Analyzing code changes...' : 'Menganalisis perubahan kode...',
    viewOnGithub: language === 'en' ? 'View on GitHub' : 'Lihat di GitHub',
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const getIssueUrl = (issue: number | string): string => {
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    return match ? `https://github.com/${match[1]}/${match[2]}/issues/${issue}` : '#';
  };

  const handleGenerateSummary = () => generateSummary(rawDiff || '', message);

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed bottom-0 left-0 w-full h-[85vh] md:h-[65vh] max-h-[85vh] md:max-h-[65vh] z-50 bg-surface-elevated/95 backdrop-blur-xl border-t border-hairline shadow-[0_-10px_40px_rgba(0,0,0,0.3)] rounded-t-2xl flex flex-col"
    >
      <div className="flex items-start justify-between px-6 py-4 border-b border-hairline/50">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center justify-center bg-surface-card p-2 rounded-xl border border-hairline min-w-[3rem] shadow-sm">
            <span className="text-xl leading-none mb-1">{parsedData.typeEmoji}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-ash">{parsedData.type}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-accent-blue/10 text-accent-blue px-2 py-0.5 rounded-full font-medium border border-accent-blue/20">
                {parsedData.typeLabel}
              </span>
              <span className="text-[10px] bg-surface-card px-1.5 py-0.5 rounded border border-hairline text-ash font-mono uppercase tracking-wider">
                {commitSha.substring(0, 7)}
              </span>
              <span className="text-[10px] text-ash tracking-wide px-1">
                • {branch}
              </span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight break-words max-w-xl">
              {parsedData.subject || (language === 'en' ? 'Update without subject' : 'Pembaruan tanpa subjek')}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-ash hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
          title={language === 'en' ? 'Close' : 'Tutup'}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar bg-black/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">

          {diffError && (
            <div className="md:col-span-3 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-300">
              {diffError}
            </div>
          )}

          <div className="md:col-span-2 space-y-6">
            {isFetchingDiff || isGeneratingAi ? (
              <div className="bg-surface-card/40 rounded-xl border border-hairline/50 p-6 flex flex-col gap-4 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-accent-blue" />
                  <span className="text-sm font-medium text-accent-blue">{translations.generating}</span>
                </div>
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-white/5 rounded-lg w-1/4"></div>
                  <div className="h-8 bg-white/5 rounded-lg w-1/3"></div>
                </div>
                <div className="h-4 bg-white/10 rounded w-1/4 mt-4 mb-2"></div>
                <div className="space-y-2">
                  <div className="h-8 bg-white/5 rounded-lg w-full"></div>
                  <div className="h-8 bg-white/5 rounded-lg w-3/4"></div>
                </div>
              </div>
            ) : aiSummary ? (
              <div className="bg-surface-card/40 rounded-xl border border-hairline/50 p-6">
                <div className="prose prose-invert prose-sm max-w-none text-white/90 file:font-mono marker:text-white/50 prose-headings:text-white prose-a:text-accent-blue prose-code:text-emerald-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiSummary}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-surface-card/40 rounded-xl border border-accent-blue/30 p-6 flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-ash mb-4">{language === 'en' ? 'You can use AI to summarize what changed in this commit.' : 'Anda dapat menggunakan AI untuk merangkum apa yang berubah pada komit ini.'}</p>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={!rawDiff}
                    className="flex items-center gap-2 px-6 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles size={16} /> {translations.generateAi}
                  </button>
                  {aiError && (
                    <p className="text-xs text-rose-400 mt-3">{aiError}</p>
                  )}
                  {!rawDiff && fileStats && fileStats.length === 0 && (
                    <p className="text-xs text-ash mt-3">{language === 'en' ? 'Unable to find a valid diff to analyze.' : 'Tidak dapat menemukan diff yang valid untuk dianalisis.'}</p>
                  )}
                </div>

                {fileStats && fileStats.length > 0 && (
                  <div className="bg-surface-card/40 rounded-xl border border-hairline/50 p-4">
                    <div className="mb-4">
                      <h4 className="flex items-center gap-2 text-xs font-bold text-ash uppercase tracking-wider mt-1">
                        <FileText size={14} /> {language === 'en' ? 'File Metadata' : 'Metadata File'}
                      </h4>
                      <p className="text-xs text-ash mt-1">{language === 'en' ? 'List of files changed in this commit:' : 'Daftar file yang diubah pada komit ini:'}</p>
                    </div>

                    <div className="space-y-2">
                      {fileStats.map((f, idx) => {
                        let badgeColor = 'bg-white/10 text-white border-white/20';
                        if (f.status === 'added') badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                        else if (f.status === 'modified') badgeColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                        else if (f.status === 'removed') badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                        return (
                          <div key={f.name} className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5">
                            <div className="flex items-center gap-3 truncate">
                               <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badgeColor}`}>
                                 {f.status}
                               </span>
                               <span className="text-sm font-mono text-white truncate max-w-[200px] sm:max-w-xs">{f.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-4">
                               <span className="text-xs font-mono text-emerald-400 flex items-center gap-1"><Plus size={10} />{f.add}</span>
                               <span className="text-xs font-mono text-rose-400 flex items-center gap-1"><Minus size={10} />{f.del}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-surface-card/40 rounded-xl border border-hairline/50 p-4">
              <h4 className="flex items-center gap-2 text-xs font-bold text-ash uppercase tracking-wider mb-3">
                <Layers size={14} /> {language === 'en' ? 'Impact Analysis' : 'Analisis Dampak'}
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-ash uppercase tracking-wide mb-1">{language === 'en' ? 'Focus Area' : 'Area Fokus'}</div>
                  <div className="text-sm font-medium text-white">{parsedData.focusArea}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ash uppercase tracking-wide mb-1">{language === 'en' ? 'Line Changes' : 'Perubahan Baris'}</div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-emerald-500 font-mono text-sm bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <Plus size={12} /> {parsedData.stats.additions}
                    </div>
                    <div className="flex items-center gap-1 text-rose-500 font-mono text-sm bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      <Minus size={12} /> {parsedData.stats.deletions}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(parsedData.issues.length > 0 || githubUrl) && (
              <div className="bg-surface-card/40 rounded-xl border border-hairline/50 p-4">
                <h4 className="text-xs font-bold text-ash uppercase tracking-wider mb-3">{language === 'en' ? 'Related References' : 'Referensi Terkait'}</h4>
                <div className="space-y-2">
                  {parsedData.issues.map((issue, idx) => (
                    <a
                      key={idx}
                      href={getIssueUrl(issue)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-sm text-accent-blue hover:bg-accent-blue/10 px-2 py-1.5 rounded transition-colors group"
                    >
                      <span className="font-mono">#{issue}</span>
                      <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                  {githubUrl && (
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-sm text-ash hover:text-white hover:bg-white/5 px-2 py-1.5 rounded transition-colors group"
                    >
                      <span>{translations.viewOnGithub}</span>
                      <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </motion.div>
  );
};
