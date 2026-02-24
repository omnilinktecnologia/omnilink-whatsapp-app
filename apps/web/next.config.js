const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@omnilink/shared'],
  output: 'standalone',
  experimental: {
    // Required for monorepos: tells Next.js to trace node_modules from root
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
}

module.exports = nextConfig
