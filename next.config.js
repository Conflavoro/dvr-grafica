/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export statico per deploy su cPanel shared (no Node SSR runtime)
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    // cPanel non ha Image Optimization Server: tutte le <Image> servite raw
    unoptimized: true,
  },
  // Build normale: radice del dominio (public_html/). Demo dal vivo:
  // NEXT_PUBLIC_BASE_PATH=/demo (public_html/demo/), stesso dominio.
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, ''),
  assetPrefix: '',
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api',
  },
}

module.exports = nextConfig
