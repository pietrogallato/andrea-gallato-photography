import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  redirects: async () => [
    { source: '/', destination: '/it', permanent: true },
  ],
  images: {
    loader: 'custom',
    loaderFile: './lib/sanity/imageLoader.ts',
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560, 3840],
    imageSizes: [320, 480],
  },
}

export default nextConfig
