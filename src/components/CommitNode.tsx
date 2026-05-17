import React from 'react';
import { Handle, Position, NodeProps, type Node } from '@xyflow/react';
import { GitCommit } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, User, ExternalLink, GitBranch, ChevronLeft, Minimize2 } from 'lucide-react';
import { getBranchColor } from './CommitGraph';

export const CommitNode = ({ data }: NodeProps<Node<{ commit: GitCommit, onFold?: () => void }>>) => {
  const { commit, onFold } = data;
  const branchColor = getBranchColor(commit.branch || 'unknown', commit.sha);

  return (
    <div
      className="relative w-64 bg-surface border rounded-lg overflow-hidden transition-all cursor-pointer shadow-lg group"
      style={{ borderColor: branchColor + '40' }}
    >
      <Handle type="target" position={Position.Left} className="!w-1 !h-4 !rounded-none !border-0" style={{ backgroundColor: branchColor }} />
      <Handle type="source" position={Position.Right} className="!w-1 !h-4 !rounded-none !border-0" style={{ backgroundColor: branchColor }} />
      
      {onFold && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFold();
          }}
          className="absolute -top-1 -right-1 z-20 p-1.5 text-white rounded-bl-lg shadow-lg transition-colors group/fold"
          style={{ backgroundColor: branchColor }}
          title="Collapse segment"
        >
          <Minimize2 size={12} className="group-hover/fold:scale-110 transition-transform" />
        </button>
      )}

      <div className="p-3 space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: branchColor }} />
            <span className="text-[10px] font-mono text-ash uppercase tracking-wider bg-surface-card px-1.5 py-0.5 rounded border border-hairline">
              {commit.sha.substring(0, 7)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: branchColor }}>
             <GitBranch size={10} />
             {commit.branch}
          </div>
        </div>
        
        <h4 className="text-xs font-medium text-ink line-clamp-1 group-hover:text-white transition-colors">
          {commit.message}
        </h4>

        <div className="flex items-center justify-between pt-1 border-t border-hairline/50">
          <div className="flex items-center gap-1.5 text-[10px] text-body">
            <User size={10} className="text-ash" />
            <span className="truncate max-w-[100px]">{commit.author}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-ash">
            <Calendar size={10} />
            <span>{new Date(commit.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!w-1 !h-4 !rounded-none !bg-accent-blue !border-0" />
    </div>
  );
};
