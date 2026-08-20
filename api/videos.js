const BLOG = process.env.TUMBLR_BLOG || 'clewellyn.tumblr.com';
const LIMIT = 20;
// Default to a conservative page scan to avoid Tumblr rate-limits in production.
const MAX_PAGES = Number(process.env.TUMBLR_MAX_PAGES || 50);

function decodeHtml(value) {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&#38;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function youtubeIdFromText(value) {
  const text = decodeHtml(value);
  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:[^\s"'<>]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
    /(?:youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})(?:[&#"'\s]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return output;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, output);
  }
  return output;
}

function videoFromPost(post) {
  const strings = collectStrings({
    content: post.content,
    trail: post.trail,
    video_url: post.video_url,
    player: post.player,
    caption: post.caption,
    body: post.body,
    source_url: post.source_url,
  });

  let youtubeId = null;
  for (const value of strings) {
    youtubeId = youtubeIdFromText(value);
    if (youtubeId) break;
  }
  if (!youtubeId) return null;

  return {
    youtubeId,
    postUrl: post.post_url || post.short_url || null,
    summary: post.summary || post.slug || 'YouTube video',
    timestamp: post.timestamp || null,
  };
}

async function tumblrPage(apiKey, before) {
  const url = new URL(`https://api.tumblr.com/v2/blog/${encodeURIComponent(BLOG)}/posts/video`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('limit', String(LIMIT));
  url.searchParams.set('npf', 'true');
  if (before) url.searchParams.set('before', String(before));

  const response = await fetch(url, {
    headers: { 'User-Agent': 'ClewellynShuffle/1.0' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tumblr API returned ${response.status}: ${text.slice(0, 180)}`);
  }

  const payload = await response.json();
  return payload?.response?.posts || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TUMBLR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'TUMBLR_API_KEY is not configured. Add it in your Vercel project environment variables.',
    });
  }

  // Declare state outside try so we can return partial results if Tumblr rate-limits us.
  let videos = new Map();
  let seenPosts = new Set();
  let before = null;
  let pages = 0;

  try {
    while (pages < MAX_PAGES) {
      const posts = await tumblrPage(apiKey, before);
      pages += 1;
      if (!posts.length) break;

      let oldestTimestamp = null;
      for (const post of posts) {
        if (seenPosts.has(post.id)) continue;
        seenPosts.add(post.id);

        const video = videoFromPost(post);
        if (video && !videos.has(video.youtubeId)) videos.set(video.youtubeId, video);

        if (post.timestamp && (!oldestTimestamp || post.timestamp < oldestTimestamp)) {
          oldestTimestamp = post.timestamp;
        }
      }

      if (posts.length < LIMIT || !oldestTimestamp) break;
      before = oldestTimestamp - 1;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      blog: BLOG,
      count: videos.size,
      pagesScanned: pages,
      videos: [...videos.values()],
    });
  } catch (error) {
    console.error(error);

    // If Tumblr rate-limited us, return partial results instead of failing hard.
    if (typeof error.message === 'string' && error.message.includes('429')) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
      return res.status(200).json({
        blog: BLOG,
        count: videos.size,
        pagesScanned: pages,
        videos: [...videos.values()],
        warning: 'Partial results: Tumblr rate limit encountered. Try again later for the full archive.',
      });
    }

    return res.status(502).json({ error: error.message || 'Could not load Tumblr archive.' });
  }
}
