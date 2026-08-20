# Clewellyn Shuffle

A tiny fullscreen web player that reads YouTube videos from `clewellyn.tumblr.com`, shuffles the whole collection, and keeps playing forever.

## What it does

- Uses Tumblr as the source of truth.
- Reads Tumblr video posts through the Tumblr API.
- Extracts YouTube video IDs from modern NPF and older Tumblr post fields.
- Shuffles the entire library as a deck, so every video gets a turn before reshuffling.
- Automatically advances when a video ends.
- Skips deleted, private, or non-embeddable YouTube videos when the YouTube player reports an error.
- Uses a one-time Start button so browser autoplay rules do not get in the way.
- Caches the Tumblr result at the CDN for one hour.

## 1. Get a Tumblr API key

Tumblr calls this a **consumer key**.

1. Sign into Tumblr.
2. Go to the Tumblr application registration page: `https://www.tumblr.com/oauth/apps`.
3. Register an application. The app name and website can be anything sensible for this project.
4. Copy the **OAuth Consumer Key**. You only need the consumer key for this read-only public-blog app; do not put a consumer secret in the browser.

## 2. Deploy to Vercel

The easiest route is to put this folder in a GitHub repository and import the repository into Vercel.

In the Vercel project settings, add this Environment Variable:

- `TUMBLR_API_KEY` = your Tumblr OAuth Consumer Key

Optional variables:

- `TUMBLR_BLOG` = `clewellyn.tumblr.com`
- `TUMBLR_MAX_PAGES` = `500`

Redeploy after adding the variable.

## 3. Run locally (optional)

Install the Vercel CLI and run:

```bash
npm i -g vercel
cp .env.example .env.local
# Edit .env.local and add your Tumblr consumer key.
vercel dev
```

Then open the local URL printed by Vercel.

## How the shuffle works

The app shuffles the complete list into a deck and removes one item each time it plays a video. When the deck is empty, it reshuffles. This avoids the annoying behavior of "pure random" playback where the same song can recur repeatedly while others never appear.

## Notes

Tumblr API rate limits apply. The server endpoint walks backward through video posts using the `before` timestamp parameter and caches the resulting library for one hour. The default safety cap is 500 API pages (up to 10,000 video posts).

YouTube can refuse some videos in embedded players. When that happens, the app automatically advances to the next item.
