/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i0.wp.com' },
      { protocol: 'https', hostname: 'shlomiardan.com' },
      { protocol: 'https', hostname: 'lh7-us.googleusercontent.com' },
    ],
    unoptimized: true,
  },
};
export default nextConfig;
