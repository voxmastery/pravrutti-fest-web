/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        /**
         * How long an edge may serve a page it has already fetched.
         *
         * Documents went out as `s-maxage=31536000` — a year — and the CDN
         * took it literally: edges were measured serving HTML nearly three
         * hours old. That matters because every deploy renames every JS
         * chunk, so HTML from before a deploy points at files that no longer
         * exist. A visitor holding that HTML taps an event, the script it
         * asks for is gone, and the page dies with nothing in our logs
         * because the request never reaches us. With four deploys in a day
         * that window was open most of the day.
         *
         * A minute is enough to absorb a burst — these pages render at the
         * origin in ~17ms — while bounding how long a stale copy can survive
         * a deploy. `stale-while-revalidate` keeps the edge answering
         * instantly while it refreshes behind the reader.
         *
         * Scoped away from /api (responses there are per-person and must
         * never be shared) and from /_next/static, whose filenames already
         * contain a content hash and so are correctly immutable forever.
         */
        source: "/:path((?!api/|_next/static/|_next/image).*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
    ];
  },
}

export default nextConfig
