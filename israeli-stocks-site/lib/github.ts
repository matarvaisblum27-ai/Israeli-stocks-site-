/**
 * GitHub API wrapper for reading/writing repo files.
 * Uses the Contents API for single-file ops and Git Trees API for multi-file commits.
 */

const API = 'https://api.github.com';

function getConfig() {
  const token = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO; // e.g. "matarvaisblum27-ai/Israeli-stocks-site-"
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repo) throw new Error('GITHUB_PAT / GITHUB_REPO not configured');
  return { token, repo, branch };
}

function headers() {
  const { token } = getConfig();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Read a single file from the repo */
export async function readFile(path: string): Promise<{ content: string; sha: string }> {
  const { repo, branch } = getConfig();
  const url = `${API}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: headers(), cache: 'no-store' });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub read failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

/** Write a single file (create or update) */
export async function writeFile(
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  const { repo, branch } = getConfig();
  const url = `${API}/repos/${repo}/contents/${encodeURIComponent(path)}`;

  // If no SHA provided, try to get it (for updates)
  let fileSha = sha;
  if (!fileSha) {
    try {
      const existing = await readFile(path);
      fileSha = existing.sha;
    } catch {
      // File doesn't exist yet, that's ok for creation
    }
  }

  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
  };
  if (fileSha) body.sha = fileSha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub write failed (${res.status}): ${err}`);
  }
}

/** Write multiple files in a single commit using the Git Trees API */
export async function writeMultipleFiles(
  files: Array<{ path: string; content: string }>,
  message: string
): Promise<void> {
  const { repo, branch } = getConfig();
  const h = headers();

  // 1. Get the latest commit SHA for the branch
  const refRes = await fetch(`${API}/repos/${repo}/git/refs/heads/${branch}`, { headers: h, cache: 'no-store' });
  if (!refRes.ok) throw new Error(`Failed to get branch ref: ${await refRes.text()}`);
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  // 2. Get the tree SHA of the latest commit
  const commitRes = await fetch(`${API}/repos/${repo}/git/commits/${latestCommitSha}`, { headers: h });
  if (!commitRes.ok) throw new Error(`Failed to get commit: ${await commitRes.text()}`);
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for each file
  const tree = await Promise.all(
    files.map(async (f) => {
      const blobRes = await fetch(`${API}/repos/${repo}/git/blobs`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          content: f.content,
          encoding: 'utf-8',
        }),
      });
      if (!blobRes.ok) throw new Error(`Failed to create blob: ${await blobRes.text()}`);
      const blobData = await blobRes.json();
      return {
        path: f.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobData.sha,
      };
    })
  );

  // 4. Create a new tree
  const treeRes = await fetch(`${API}/repos/${repo}/git/trees`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!treeRes.ok) throw new Error(`Failed to create tree: ${await treeRes.text()}`);
  const treeData = await treeRes.json();

  // 5. Create a new commit
  const newCommitRes = await fetch(`${API}/repos/${repo}/git/commits`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [latestCommitSha],
    }),
  });
  if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${await newCommitRes.text()}`);
  const newCommitData = await newCommitRes.json();

  // 6. Update the branch reference
  const updateRefRes = await fetch(`${API}/repos/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
  if (!updateRefRes.ok) throw new Error(`Failed to update ref: ${await updateRefRes.text()}`);
}
