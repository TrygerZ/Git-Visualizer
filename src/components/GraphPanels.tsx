import { motion, AnimatePresence } from 'motion/react';
import {
  Background,
  Controls,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import {
  Info,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Minimize2,
  User,
} from 'lucide-react';
import { GraphElement } from '../types';
import { ContributorLeaderboard } from './ContributorLeaderboard';
import { ContributorPanel } from './ContributorPanel';
import { SearchBar } from './SearchBar';

interface GraphPanelsProps {
  elements: GraphElement[];
  repoName: string;
  language: 'en' | 'id';
  t: Record<string, string>;
  isLayouting: boolean;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  layoutDirection: 'RIGHT' | 'DOWN';
  onLayoutDirectionChange: (dir: 'RIGHT' | 'DOWN') => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  playbackIndex: number;
  onPlaybackIndexChange: (idx: number) => void;
  onReset: () => void;
  currentElement: GraphElement | undefined;
  safeDate: (date: string | undefined, locale: 'en' | 'id') => string;
  activeContributorName: string | null;
  activeAvatar: string | null | undefined;
  contributors: Array<{ name: string; avatar?: string; url?: string }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  lockedZoom: number;
  sliderX: number;
  sliderY: number;
  onSliderXChange: (val: number) => void;
  onSliderYChange: (val: number) => void;
  unfurledIdsCount: number;
  onCollapseAll: () => void;
}

export function GraphPanels({
  elements,
  repoName,
  language,
  t,
  isLayouting,
  searchQuery,
  onSearchChange,
  layoutDirection,
  onLayoutDirectionChange,
  isPlaying,
  onPlayToggle,
  playbackIndex,
  onPlaybackIndexChange,
  onReset,
  currentElement,
  safeDate,
  activeContributorName,
  activeAvatar,
  contributors,
  bounds,
  lockedZoom,
  sliderX,
  sliderY,
  onSliderXChange,
  onSliderYChange,
  unfurledIdsCount,
  onCollapseAll,
}: GraphPanelsProps) {
  const { setCenter } = useReactFlow();

  return (
    <>
      <AnimatePresence>
        {isLayouting && (
          <motion.div
            key="layouting-spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-surface/50 backdrop-blur-[2px] flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-ash uppercase tracking-widest font-bold">
                {t.optimizingLayout}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Background gap={20} color="#161718" />
      <Controls
        position="bottom-left"
        className="!bg-surface-elevated !border-hairline !rounded-lg !fill-white hidden sm:flex"
      />

      <Panel position="top-left" className="m-2 sm:m-4 flex flex-col gap-2 sm:gap-4 items-start">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-4 py-3 bg-surface-card border border-hairline rounded-xl hidden sm:flex items-center gap-3 shadow-xl"
        >
          <div className="w-8 h-8 bg-accent-blue/10 rounded-lg flex items-center justify-center text-accent-blue font-bold">
            {elements.length}
          </div>
          <div>
            <h3 className="text-sm font-medium text-ink leading-tight">{repoName}</h3>
            <p className="text-[10px] text-ash uppercase tracking-widest">
              Topological View &bull; {t.step} {playbackIndex}/{t.of} {elements.length}
            </p>
          </div>
        </motion.div>
        <ContributorLeaderboard nodes={elements} language={language} />
      </Panel>

      <Panel position="top-center" className="mt-3 sm:mt-6 z-50 hidden md:block">
        <SearchBar value={searchQuery} onChange={onSearchChange} language={language} />
      </Panel>

      <Panel position="top-right" className="m-2 sm:m-4 flex flex-col gap-2 sm:gap-4 items-end z-50">
        <div className="block md:hidden">
          <SearchBar value={searchQuery} onChange={onSearchChange} language={language} />
        </div>
        <div className="hidden md:flex flex-col gap-4 items-end">
          <ContributorPanel
            contributors={contributors}
            activeContributorName={activeContributorName}
            language={language}
          />
        </div>
      </Panel>

      <Panel position="bottom-center" className="w-full max-w-md px-3 sm:px-6 mb-3 sm:mb-8 z-40 pointer-events-none">
        <div className="relative pointer-events-auto">
          <AnimatePresence>
            {isPlaying && activeContributorName && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: -20, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-accent-blue/90 text-white rounded-full shadow-2xl backdrop-blur-md border border-white/20 whitespace-nowrap z-50"
              >
                <div className="w-8 h-8 rounded-full border border-white/30 overflow-hidden shadow-inner">
                  {activeAvatar ? (
                    <img src={activeAvatar} alt={activeContributorName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={16} className="m-auto mt-2" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] opacity-70 font-bold uppercase tracking-wider">
                    {t.contributingNow}
                  </span>
                  <span className="text-xs font-bold leading-none">{activeContributorName}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface/90 backdrop-blur-2xl border border-hairline/60 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-3 sm:space-y-4 pointer-events-auto"
          >
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                onClick={onPlayToggle}
                aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
                className="w-11 h-11 sm:w-16 sm:h-16 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-white/20 shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-6 sm:h-6" fill="currentColor" />
                ) : (
                  <Play className="w-4 h-4 sm:w-6 sm:h-6 ml-0.5 sm:ml-1" fill="currentColor" />
                )}
              </button>
              <button
                onClick={onReset}
                className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-95 cursor-pointer shrink-0"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {elements.length > 0 && (
                <div className="flex-1 px-1 sm:px-2">
                  <input
                    type="range"
                    aria-label="Playback progress"
                    min="1"
                    max={elements.length}
                    value={playbackIndex}
                    onChange={(e) => onPlaybackIndexChange(parseInt(e.target.value))}
                    className="w-full accent-white h-1.5 sm:h-2 bg-white/10 rounded-lg appearance-none cursor-pointer hover:bg-white/20 transition-colors"
                  />
                </div>
              )}
              <button
                onClick={() =>
                  onLayoutDirectionChange(
                    layoutDirection === 'RIGHT' ? 'DOWN' : 'RIGHT'
                  )
                }
                aria-label="Toggle layout direction"
                className="flex sm:hidden w-8 h-8 items-center justify-center text-accent-blue hover:text-white bg-accent-blue/10 hover:bg-accent-blue/20 border border-accent-blue/25 rounded-full transition-all active:scale-95 cursor-pointer shrink-0"
                title={layoutDirection === 'RIGHT' ? t.vertical : t.horizontal}
              >
                <span className="text-[10px] font-extrabold uppercase px-1">
                  {layoutDirection === 'RIGHT' ? 'H' : 'V'}
                </span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={playbackIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-surface-card/50 rounded-lg border border-hairline/30"
              >
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-blue shrink-0" />
                <div className="flex-1 min-w-0">
                  {currentElement?.type === 'commit' ? (
                    <>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[9px] sm:text-[10px] font-mono text-ash shrink-0">
                          {currentElement.data.sha.substring(0, 7)}
                        </span>
                        <span className="text-xs text-ink font-medium truncate">
                          {currentElement.data.message}
                        </span>
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-ash truncate">
                        {currentElement.data.author} &bull;{' '}
                        {safeDate(currentElement.data.date, language)}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-ink">
                        {t.segment} {currentElement?.commits.length} {t.linearCommits}
                      </span>
                      <span className="text-[10px] text-ash italic">{t.foldedToSave}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="pt-3 border-t border-hairline/30 hidden sm:flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-ash tracking-widest min-w-[50px]">
                {layoutDirection === 'RIGHT' ? 'Pan X' : 'Pan Y'}
              </span>
              <input
                type="range"
                min={layoutDirection === 'RIGHT' ? bounds.minX : bounds.minY}
                max={layoutDirection === 'RIGHT' ? bounds.maxX : bounds.maxY}
                value={layoutDirection === 'RIGHT' ? sliderX : sliderY}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (layoutDirection === 'RIGHT') {
                    onSliderXChange(val);
                    setCenter(val, (bounds.minY + bounds.maxY) / 2, {
                      zoom: lockedZoom,
                      duration: 0,
                    });
                  } else {
                    onSliderYChange(val);
                    setCenter((bounds.minX + bounds.maxX) / 2, val, {
                      zoom: lockedZoom,
                      duration: 0,
                    });
                  }
                }}
                className="w-full h-1 bg-surface-card rounded-lg appearance-none cursor-pointer accent-accent-blue"
              />
            </div>
          </motion.div>
        </div>
      </Panel>

      <Panel position="bottom-right" className="m-4 flex flex-col gap-2.5 items-end">
        <div className="hidden sm:flex items-center p-1 bg-surface-card border border-hairline rounded-xl shadow-lg backdrop-blur-md">
          <button
            onClick={() => onLayoutDirectionChange('RIGHT')}
            aria-label={t.horizontal}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              layoutDirection === 'RIGHT'
                ? 'bg-accent-blue text-white shadow-sm'
                : 'text-ash hover:text-white'
            }`}
          >
            {t.horizontal}
          </button>
          <button
            onClick={() => onLayoutDirectionChange('DOWN')}
            aria-label={t.vertical}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              layoutDirection === 'DOWN'
                ? 'bg-accent-blue text-white shadow-sm'
                : 'text-ash hover:text-white'
            }`}
          >
            {t.vertical}
          </button>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {unfurledIdsCount > 0 && (
            <button
              onClick={onCollapseAll}
              className="flex items-center gap-2 p-2 bg-accent-blue/10 border border-accent-blue/20 rounded-lg text-accent-blue text-[10px] hover:bg-accent-blue/20 transition-colors"
            >
              <Minimize2 size={12} />
              <span>{t.collapseAll}</span>
            </button>
          )}
          <div className="hidden md:flex items-center gap-2 p-2 bg-surface-elevated border border-hairline rounded-lg text-ash text-[10px]">
            <Info size={12} className="shrink-0" />
            <span>{t.clickHint}</span>
          </div>
        </div>
      </Panel>
    </>
  );
}
