export interface GitCommit {
  id: string;
  sha: string;
  parents: string[];
  message: string;
  author: string;
  author_avatar?: string;
  author_url?: string;
  date: string;
  github_url: string;
  branch: string;
}

export interface FoldedNode {
  id: string;
  type: 'folded';
  commits: GitCommit[];
  parents: string[];
  children: string[];
}

export type GraphElement = 
  | { type: 'commit'; data: GitCommit }
  | FoldedNode;

export interface RepoData {
  owner: string;
  repo: string;
  elements: GraphElement[];
}
