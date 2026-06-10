const hashSeedToHue = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};

export const getBranchColor = (branchName: string, fallbackId: string = ''): string => {
  if (branchName === 'main' || branchName === 'master') return '#3b82f6';
  if (branchName === 'develop') return '#10b981';

  const seed = (branchName === 'commit' || branchName === 'unknown') && fallbackId ? fallbackId : branchName;
  return `hsl(${hashSeedToHue(seed)}, 70%, 55%)`;
};
