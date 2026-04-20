import { NextResponse } from 'next/server';
import { writeMultipleFiles, readDataFile } from '@/lib/github';
import { readFileSync } from 'fs';
import { join } from 'path';

const VIDEOS_PATH = 'israeli-stocks-site/public/data/videos.json';

interface VideoItem {
  id: string;
  title: string;
  priority: boolean;
  addedAt?: string;
}

function readLocal(): VideoItem[] {
  try {
    const content = readFileSync(join(process.cwd(), 'public', 'data', 'videos.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/** Extract YouTube video ID from various URL formats */
function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();

  // Already a bare ID (11 chars, alphanumeric + dash/underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    // youtube.com/watch?v=ID
    if (url.hostname.includes('youtube.com') && url.searchParams.get('v')) {
      return url.searchParams.get('v');
    }
    // youtu.be/ID
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1).split('/')[0] || null;
    }
    // youtube.com/embed/ID
    if (url.pathname.startsWith('/embed/')) {
      return url.pathname.split('/')[2] || null;
    }
    // youtube.com/shorts/ID
    if (url.pathname.startsWith('/shorts/')) {
      return url.pathname.split('/')[2] || null;
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

// GET — list all videos
export async function GET() {
  try {
    try {
      const content = await readDataFile('videos.json');
      return NextResponse.json(JSON.parse(content));
    } catch {
      return NextResponse.json(readLocal());
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST — add a new video by YouTube URL
export async function POST(request: Request) {
  try {
    const { url, priority } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const videoId = extractYoutubeId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Read current videos from GitHub
    let videos: VideoItem[];
    try {
      videos = JSON.parse(await readDataFile('videos.json'));
    } catch {
      videos = readLocal();
    }

    // Check for duplicates
    if (videos.some((v) => v.id === videoId)) {
      return NextResponse.json({ error: 'Video already exists', id: videoId }, { status: 409 });
    }

    // Add new video with timestamp
    videos.unshift({ id: videoId, title: '', priority: !!priority, addedAt: new Date().toISOString() });

    await writeMultipleFiles(
      [{ path: VIDEOS_PATH, content: JSON.stringify(videos, null, 2) }],
      `admin: add video ${videoId}`
    );

    return NextResponse.json({ ok: true, id: videoId, total: videos.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE — remove a video by ID
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    let videos: VideoItem[];
    try {
      videos = JSON.parse(await readDataFile('videos.json'));
    } catch {
      videos = readLocal();
    }

    const before = videos.length;
    videos = videos.filter((v) => v.id !== id);
    if (videos.length === before) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    await writeMultipleFiles(
      [{ path: VIDEOS_PATH, content: JSON.stringify(videos, null, 2) }],
      `admin: remove video ${id}`
    );

    return NextResponse.json({ ok: true, total: videos.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PUT — update video (toggle priority)
export async function PUT(request: Request) {
  try {
    const { id, priority } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    let videos: VideoItem[];
    try {
      videos = JSON.parse(await readDataFile('videos.json'));
    } catch {
      videos = readLocal();
    }

    const video = videos.find((v) => v.id === id);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (priority !== undefined) video.priority = !!priority;

    await writeMultipleFiles(
      [{ path: VIDEOS_PATH, content: JSON.stringify(videos, null, 2) }],
      `admin: update video ${id}`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
