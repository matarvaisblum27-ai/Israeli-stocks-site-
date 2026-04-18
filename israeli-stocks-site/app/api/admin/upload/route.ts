import { NextResponse } from 'next/server';
import { writeMultipleFiles } from '@/lib/github';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only images allowed' }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const safeName = `img-${timestamp}.${ext}`;
    const repoPath = `israeli-stocks-site/public/uploads/${safeName}`;

    // Convert to base64 for GitHub API
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Upload to GitHub using the blob + tree approach
    const API = 'https://api.github.com';
    const token = process.env.GITHUB_PAT;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token || !repo) {
      return NextResponse.json({ error: 'GitHub not configured' }, { status: 500 });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Create blob (supports binary, up to 100MB)
    const blobRes = await fetch(`${API}/repos/${repo}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: base64, encoding: 'base64' }),
    });
    if (!blobRes.ok) throw new Error(`Blob creation failed: ${await blobRes.text()}`);
    const blobData = await blobRes.json();

    // Get latest commit
    const refRes = await fetch(`${API}/repos/${repo}/git/refs/heads/${branch}`, { headers, cache: 'no-store' });
    if (!refRes.ok) throw new Error('Failed to get branch ref');
    const refData = await refRes.json();
    const latestSha = refData.object.sha;

    const commitRes = await fetch(`${API}/repos/${repo}/git/commits/${latestSha}`, { headers });
    const commitData = await commitRes.json();

    // Create tree with the new file
    const treeRes = await fetch(`${API}/repos/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: commitData.tree.sha,
        tree: [{ path: repoPath, mode: '100644', type: 'blob', sha: blobData.sha }],
      }),
    });
    if (!treeRes.ok) throw new Error('Failed to create tree');
    const treeData = await treeRes.json();

    // Create commit
    const newCommitRes = await fetch(`${API}/repos/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: `admin: upload image ${safeName}`,
        tree: treeData.sha,
        parents: [latestSha],
      }),
    });
    if (!newCommitRes.ok) throw new Error('Failed to create commit');
    const newCommitData = await newCommitRes.json();

    // Update ref
    const updateRes = await fetch(`${API}/repos/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: newCommitData.sha }),
    });
    if (!updateRes.ok) throw new Error('Failed to update ref');

    // Return the public URL (will be available after next deploy)
    // For immediate use, also return base64 data URI
    const dataUri = `data:${file.type};base64,${base64}`;
    const publicUrl = `/uploads/${safeName}`;

    return NextResponse.json({ url: publicUrl, dataUri, filename: safeName });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
