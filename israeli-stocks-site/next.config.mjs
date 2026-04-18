/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Allow embedding in shlomiardan.com WordPress site + same-origin
  { key: 'X-Frame-Options', value: 'ALLOW-FROM https://shlomiardan.com' },
  // Stop browsers from MIME-sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Enable XSS filter in older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Only send the origin as referrer for cross-origin requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable invasive browser features we don't need
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Basic Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + inline (needed for Next.js hydration)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind generates inline styles)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + known WordPress/Google image CDNs + data URIs
      "img-src 'self' data: https://i0.wp.com https://shlomiardan.com https://lh7-us.googleusercontent.com https://lh3.googleusercontent.com",
      // Fetch/XHR: self + Yahoo Finance API (for stock data)
      "connect-src 'self' https://query1.finance.yahoo.com https://query2.finance.yahoo.com",
      "font-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self' https://shlomiardan.com https://*.shlomiardan.com",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig = {
  // output: 'export', // removed to enable API routes for stock data
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i0.wp.com' },
      { protocol: 'https', hostname: 'shlomiardan.com' },
      { protocol: 'https', hostname: 'lh7-us.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Data files: no browser cache (always fresh), Vercel CDN handles caching per deploy
        source: '/data/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
