/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    /**
     * The cron route, the collage endpoint and /live read chart PNGs and the
     * signals seed off disk at runtime. Next's tracer cannot see those reads,
     * so include them in the serverless bundles explicitly.
     */
    outputFileTracingIncludes: {
      // assets/fonts is required: Vercel's runtime has no system fonts, so
      // without it sharp renders every SVG label as tofu boxes.
      "/api/cron/analyze": [
        "./public/charts/latest/**",
        "./data/**",
        "./assets/fonts/**",
      ],
      "/api/collage": ["./public/charts/latest/**", "./assets/fonts/**"],
      "/live": ["./public/charts/latest/**", "./data/**"],
    },
  },
};

export default nextConfig;
