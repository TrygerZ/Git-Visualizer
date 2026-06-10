import React from 'react';
import { Handle, Position, NodeProps, type Node } from '@xyflow/react';
import { FoldedNode as IFoldedNode } from '../types';
import { Layers } from 'lucide-react';
import { getBranchColor } from '../lib/getBranchColor';

export const FoldedNode = ({ data }: NodeProps<Node<{ folded: IFoldedNode, onUnfold: () => void }>>) => {
  const { folded, onUnfold } = data;
  const branchColor = getBranchColor(folded.commits[0]?.branch || 'unknown', folded.commits[0]?.sha);

  return (
    <div
      onClick={onUnfold}
      className="relative w-32 h-10 bg-surface-card border-2 border-dashed rounded-full flex items-center justify-center gap-2 hover:bg-surface-elevated transition-all cursor-pointer group shadow-lg"
      style={{ borderColor: branchColor + '60' }}
    >
      <Handle type="target" position={Position.Left} className="!w-1 !h-3 !rounded-none !border-0" style={{ backgroundColor: branchColor }} />
      
      <Layers size={14} className="transition-colors" style={{ color: branchColor }} />
      <span className="text-[10px] font-bold transition-colors uppercase tracking-tight" style={{ color: branchColor }}>
        +{folded.commits.length} Commits
      </span>

      <Handle type="source" position={Position.Right} className="!w-1 !h-3 !rounded-none !border-0" style={{ backgroundColor: branchColor }} />
    </div>
  );
};
