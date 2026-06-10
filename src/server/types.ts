export interface CommitNode {
  sha: string;
  parents: string[];
  children?: string[];
  message?: string;
  author?: string;
  author_avatar?: string | null;
  author_url?: string | null;
  date?: string;
  github_url?: string;
  branch?: string;
  id?: string;
}

export interface GraphElement {
  type: 'commit' | 'folded';
  data?: CommitNode;
  id?: string;
  commits?: CommitNode[];
  parents?: string[];
  children?: string[];
}

export interface RepoDataResult {
  owner: string;
  repo: string;
  elements: GraphElement[];
}
