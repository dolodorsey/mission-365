/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: false,
  turbopack: { root: __dirname },
  async rewrites() {
    return [
      {
        source: '/brand/:path*',
        destination: 'https://mission-365-ik92kdw4k-dr-dorseys-projects.vercel.app/brand/:path*',
      },
    ]
  },
};
module.exports = nextConfig;
