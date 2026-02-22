import type { NextConfig } from "next";

const baseSecurityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://vercel.com https://api.vercel.com https://cdn.jsdelivr.net https://*.blob.vercel-storage.com",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
].join("; ");

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    const headers = [...baseSecurityHeaders];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Content-Security-Policy",
        value: contentSecurityPolicy,
      });
    }

    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
};

export default nextConfig;
