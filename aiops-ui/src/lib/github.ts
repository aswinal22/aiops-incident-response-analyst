import { GitHubRepo, GitHubUser } from './types';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Validates any GitHub Personal Access Token (both Classic tokens and Fine-Grained repository tokens).
 */
export async function validateGitHubPat(pat: string): Promise<GitHubUser> {
  const cleanPat = pat.trim();
  if (!cleanPat) {
    throw new Error('GitHub Personal Access Token cannot be empty.');
  }

  const authHeaders = {
    Authorization: `Bearer ${cleanPat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. Try /user endpoint (Works for Classic tokens and Fine-grained tokens with account scope)
  const userRes = await fetch(`${GITHUB_API_BASE}/user`, { headers: authHeaders });

  if (userRes.ok) {
    const data = await userRes.json();
    return {
      login: data.login,
      id: data.id,
      avatar_url: data.avatar_url || 'https://github.com/ghost.png',
      html_url: data.html_url || `https://github.com/${data.login}`,
      name: data.name || data.login,
      email: data.email,
      public_repos: data.public_repos,
    };
  }

  // 2. If /user returned 401 Unauthorized -> Token is genuinely invalid or revoked
  if (userRes.status === 401) {
    throw new Error('Invalid GitHub Personal Access Token. Please check token permissions.');
  }

  // 3. If /user returned 403 (Common for Fine-Grained tokens scoped strictly to Repositories)
  // Fallback to /user/repos to verify repository access and extract identity
  const reposRes = await fetch(`${GITHUB_API_BASE}/user/repos?per_page=1`, { headers: authHeaders });

  if (reposRes.ok) {
    const repos = await reposRes.json();
    if (Array.isArray(repos) && repos.length > 0) {
      const first = repos[0];
      return {
        login: first.owner?.login || 'github-user',
        id: first.owner?.id || 1,
        avatar_url: first.owner?.avatar_url || 'https://github.com/github.png',
        html_url: first.owner?.html_url || `https://github.com/${first.owner?.login}`,
        name: first.owner?.login || 'GitHub User',
        public_repos: repos.length,
      };
    }

    // Token is valid with 0 repos
    return {
      login: 'github-user',
      id: 1,
      avatar_url: 'https://github.com/github.png',
      html_url: 'https://github.com',
      name: 'Fine-Grained Token User',
      public_repos: 0,
    };
  }

  // 4. Fallback check against /rate_limit (always accessible with any valid PAT)
  const rateLimitRes = await fetch(`${GITHUB_API_BASE}/rate_limit`, { headers: authHeaders });
  if (rateLimitRes.ok) {
    return {
      login: 'github-service-user',
      id: 1,
      avatar_url: 'https://github.com/github.png',
      html_url: 'https://github.com',
      name: 'Scoped Service Account',
    };
  }

  throw new Error('Could not verify GitHub token. Please ensure it has repository read permissions.');
}

/**
 * Fetches the list of repositories accessible to the user with the given PAT.
 */
export async function fetchUserRepositories(pat: string): Promise<GitHubRepo[]> {
  const cleanPat = pat.trim();
  const authHeaders = {
    Authorization: `Bearer ${cleanPat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const res = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator`, {
    headers: authHeaders,
  });

  if (!res.ok) {
    throw new Error(`Failed to load repositories from GitHub (${res.status}). Please check token scopes.`);
  }

  const repos = await res.json();
  if (!Array.isArray(repos)) {
    return [];
  }

  return repos.map((r: any) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    owner: {
      login: r.owner?.login || '',
      avatar_url: r.owner?.avatar_url || 'https://github.com/github.png',
    },
    html_url: r.html_url,
    description: r.description,
    default_branch: r.default_branch || 'main',
    language: r.language,
    updated_at: r.updated_at,
  }));
}
