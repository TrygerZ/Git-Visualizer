export interface ParsedCommit {
  type: string;
  typeLabel: string;
  typeEmoji: string;
  subject: string;
  body: string[];
  issues: string[];
  focusArea: string;
  stats: {
    additions: number;
    deletions: number;
  };
}

const CONVENTIONAL_TYPES: Record<string, { label: string; emoji: string }> = {
  feat: { label: 'New Feature', emoji: '✨' },
  fix: { label: 'Bug Fix', emoji: '🐛' },
  chore: { label: 'Maintenance', emoji: '🧹' },
  docs: { label: 'Documentation', emoji: '📄' },
  refactor: { label: 'Code Refactor', emoji: '♻️' },
  style: { label: 'Code Style', emoji: '🎨' },
  test: { label: 'Testing', emoji: '✅' },
  perf: { label: 'Performance', emoji: '⚡' },
  ci: { label: 'CI/CD', emoji: '👷' },
  build: { label: 'Build System', emoji: '📦' },
  revert: { label: 'Revert Change', emoji: '⏪' },
};

export const parseCommitData = (
  rawMessage: string,
  filesChanged: string[] = [],
  stats: { additions: number; deletions: number } = { additions: Math.floor(Math.random() * 200), deletions: Math.floor(Math.random() * 50) }
): ParsedCommit => {
  const lines = rawMessage.trim().split('\n');
  let subject = lines[0] || '';
  const bodyText = lines.slice(1).join('\n').trim();

  const typeRegex = /^([a-zA-Z]+)(?:\(.*?\))?!?: /;
  let type = 'commit';
  let typeLabel = 'General Update';
  let typeEmoji = '📝';

  const typeMatch = subject.match(typeRegex);
  if (typeMatch && typeMatch[1]) {
    const rawType = typeMatch[1].toLowerCase();
    if (CONVENTIONAL_TYPES[rawType]) {
      type = rawType;
      typeLabel = CONVENTIONAL_TYPES[rawType].label;
      typeEmoji = CONVENTIONAL_TYPES[rawType].emoji;
      
      // Remove type prefix from subject for cleaner display
      subject = subject.replace(typeRegex, '').trim();
    }
  } else {
    // Non-conventional commit inference
    const lowerSubject = subject.toLowerCase();
    if (lowerSubject.startsWith('merge')) {
      type = 'merge';
      typeLabel = 'Merge';
      typeEmoji = '🔀';
    } else if (lowerSubject.match(/^(fix|bug|patch|resolve)/)) {
      type = 'fix';
      typeLabel = 'Bug Fix';
      typeEmoji = '🐛';
    } else if (lowerSubject.match(/^(add|feat|implement|create)/)) {
      type = 'feat';
      typeLabel = 'New Feature';
      typeEmoji = '✨';
    } else if (lowerSubject.match(/^(update|change|modify)/)) {
      type = 'update';
      typeLabel = 'Update';
      typeEmoji = '🔄';
    } else if (lowerSubject.startsWith('refactor')) {
      type = 'refactor';
      typeLabel = 'Code Refactor';
      typeEmoji = '♻️';
    } else if (lowerSubject.match(/^(docs|doc|readme)/)) {
      type = 'docs';
      typeLabel = 'Documentation';
      typeEmoji = '📄';
    }
  }

  const bodyPoints = bodyText
    .split('\n')
    // Remove common list markdown like '-', '*', or '1.'
    .map(line => line.replace(/^[\s\-\*\d\.]+/, '').trim())
    .filter(line => line.length > 0);

  const issueRegex = /(?:#|GH-)(\d+)/g;
  const issuesFound = new Set<string>();
  
  [rawMessage].forEach(text => {
    let match;
    while ((match = issueRegex.exec(text)) !== null) {
      issuesFound.add(match[1]);
    }
  });

  let focusArea = 'Mixed / General';
  if (filesChanged.length > 0) {
    const extensionCounts: Record<string, number> = {};
    let apiCount = 0;
    
    filesChanged.forEach(file => {
      const ext = (file.split('.').pop() || '').toLowerCase();
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
      
      if (file.includes('/api/') || file.includes('backend/')) {
        apiCount++;
      }
    });

    const isFrontend = ['jsx', 'tsx', 'css', 'scss', 'vue', 'svelte'].some(ext => extensionCounts[ext] > 0);
    const isBackend = ['go', 'py', 'java', 'rs'].some(ext => extensionCounts[ext] > 0) || apiCount > 0;
    const isDocs = ['md', 'mdx', 'txt'].some(ext => extensionCounts[ext] > 0);

    if (isFrontend && isBackend) focusArea = 'Fullstack';
    else if (isFrontend) focusArea = 'UI/Frontend';
    else if (isBackend) focusArea = 'Backend/API';
    else if (isDocs && filesChanged.length === extensionCounts['md'] + (extensionCounts['mdx'] || 0)) focusArea = 'Documentation';
  } else {
    // Mock if no files
    if (['feat', 'fix', 'refactor'].includes(type)) {
      const areas = ['UI/Frontend', 'Backend/API', 'Fullstack'];
      focusArea = areas[Math.floor(Math.random() * areas.length)];
    } else if (type === 'docs') {
      focusArea = 'Documentation';
    } else if (type === 'build' || type === 'ci') {
      focusArea = 'Infrastructure / Config';
    }
  }

  return {
    type,
    typeLabel,
    typeEmoji,
    subject,
    body: bodyPoints,
    issues: Array.from(issuesFound),
    focusArea,
    stats,
  };
};
