import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  redirects: async () => [
    { source: '/', destination: '/it', permanent: true },
  ],
}

export default nextConfig
