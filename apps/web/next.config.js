/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['ui-kit'],
  experimental: {
    externalDir: true,
    outputFileTracingRoot: path.join(__dirname, '../..')
  },
  webpack(config) {
    // (optional) if you’d rather alias straight to your src:
    // config.resolve.alias['ui-kit'] = path.resolve(__dirname, '../../packages/ui-kit/src');
    return config;
  }
};

module.exports = nextConfig;
