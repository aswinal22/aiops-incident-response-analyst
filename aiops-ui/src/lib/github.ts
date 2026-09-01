import { GitHubRepo, GitHubUser } from './types';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Validates a GitHub Personal Access Token (PAT) by fetching the authenticated user profile.
 */
export async function validateGitHubPat(pat: string): Promise<GitHubUser> {
  const cleanPat = pat.trim();
  if (!cleanPat) {
    throw new Error('GitHub Personal Access Token cannot be empty.');
  }

  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${cleanPat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Invalid GitHub Personal Access Token. Please check token permissions.');
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `GitHub API error (${res.status})`);
  }

  const data = await res.json();
  return {
    login: data.login,
    id: data.id,
    avatar_url: data.avatar_url,
    html_url: data.html_url,
    name: data.name || data.login,
    email: data.email,
    public_repos: data.public_repos,
  };
}

/**
 * Fetches the list of repositories accessible to the user with the given PAT.
 */
export async function fetchUserRepositories(pat: string): Promise<GitHubRepo[]> {
  const cleanPat = pat.trim();
  const res = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator`, {
    headers: {
      Authorization: `Bearer ${cleanPat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load repositories from GitHub (${res.status})`);
  }

  const repos = await res.json();
  return repos.map((r: any) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    owner: {
      login: r.owner?.login || '',
      avatar_url: r.owner?.avatar_url || '',
    },
    html_url: r.html_url,
    description: r.description,
    default_branch: r.default_branch || 'main',
    language: r.language,
    updated_at: r.updated_at,
  }));
}
