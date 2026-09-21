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
      "/api/cron/analyze": ["./public/charts/latest/**", "./data/**"],
      "/api/collage": ["./public/charts/latest/**"],
      "/live": ["./public/charts/latest/**", "./data/**"],
    },
  },
};

export default nextConfig;
