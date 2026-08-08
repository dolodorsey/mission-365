/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: false,
  turbopack: { root: __dirname },
  async rewrites() {
    return [
      {
        source: '/brand/:path*',
        destination: 'https://raw.githubusercontent.com/dolodorsey/mission-365/main/public/brand/:path*',
      },
    ]
  },
};
module.exports = nextConfig;
