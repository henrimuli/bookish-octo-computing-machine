import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // forbidden(): admin pages show an "admins only" page (403) to signed-in non-staff.
  experimental: { authInterrupts: true },
  async redirects() {
    return [
      // Submitting happens in a modal on the homepage; editing lives in the dashboard.
      { source: "/submit", destination: "/?debut=1", permanent: false },
      { source: "/submit/:id/plan", destination: "/dashboard/products/:id/plan", permanent: false },
      { source: "/submit/:id", destination: "/dashboard/products/:id", permanent: false },
      // Prices now sit next to what they're for (submit flow, directory service, dashboard).
      { source: "/pricing", destination: "/", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
