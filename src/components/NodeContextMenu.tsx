import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, FileText } from 'lucide-react';
import { GitCommit } from '../types';

interface NodeContextMenuProps {
  commit: GitCommit;
  x: number;
  y: number;
  t: { viewOnGithub: string; viewSummary: string };
  onClose: () => void;
  onViewSummary: (commit: GitCommit) => void;
}

export function NodeContextMenu({
  commit,
  x,
  y,
  t,
  onClose,
  onViewSummary,
}: NodeContextMenuProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="fixed z-50 bg-surface-elevated/90 backdrop-blur-md border border-hairline rounded-lg shadow-xl overflow-hidden flex flex-col min-w-[160px]"
      style={{
        left: Math.min(x, window.innerWidth - 200),
        top: Math.min(y + 10, window.innerHeight - 150),
      }}
    >
      <button
        onClick={() => {
          window.open(commit.github_url, '_blank');
          onClose();
        }}
        className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-ash hover:text-white hover:bg-white/5 transition-colors text-left"
      >
        <ExternalLink size={14} /> {t.viewOnGithub}
      </button>
      <div className="h-px w-full bg-hairline" />
      <button
        onClick={() => {
          onViewSummary(commit);
          onClose();
        }}
        className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-accent-blue hover:text-white hover:bg-accent-blue/20 transition-colors text-left"
      >
        <FileText size={14} /> {t.viewSummary}
      </button>
    </motion.div>
  );
}
