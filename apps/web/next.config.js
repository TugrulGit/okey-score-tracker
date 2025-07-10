/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['ui-kit'],
  experimental: {
    externalDir: true
  },
  webpack(config) {
    // (optional) if you’d rather alias straight to your src:
    // config.resolve.alias['ui-kit'] = path.resolve(__dirname, '../../packages/ui-kit/src');
    return config;
  }
};
module.exports = nextConfig;
