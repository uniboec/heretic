import type { NextConfig } from 'next'
import { getAppSecurityHeaders } from './lib/securityHeaders'

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      { source: '/participants', destination: '/athletes', permanent: true },
      { source: '/participants/:path*', destination: '/athletes/:path*', permanent: true },
      { source: '/uchastniki', destination: '/athletes', permanent: true },
      { source: '/uchastniki/:path*', destination: '/athletes/:path*', permanent: true },
      { source: '/setki', destination: '/brackets', permanent: true },
      { source: '/setki/:path*', destination: '/brackets/:path*', permanent: true },
      { source: '/rezultaty', destination: '/results', permanent: true },
      { source: '/rezultaty/:path*', destination: '/results/:path*', permanent: true },
      { source: '/poedinoki', destination: '/bouts', permanent: true },
      { source: '/poedinoki/:path*', destination: '/bouts/:path*', permanent: true },
      { source: '/norm-qualifications', destination: '/norms', permanent: true },
      { source: '/norm-qualifications/:path*', destination: '/norms/:path*', permanent: true },
      { source: '/rank-qualifications', destination: '/norms', permanent: true },
      { source: '/rank-qualifications/:path*', destination: '/norms/:path*', permanent: true },
      { source: '/vypolnenie-normativov', destination: '/norms', permanent: true },
      { source: '/vypolnenie-normativov/:path*', destination: '/norms/:path*', permanent: true },
      { source: '/register', destination: '/registratsiya', permanent: true },
      { source: '/my-registrations', destination: '/moi-zayavki', permanent: true },
      { source: '/registration/:id', destination: '/registratsiya/:id', permanent: true },
      { source: '/edit/:token', destination: '/redaktirovanie/:token', permanent: true },
      { source: '/admin/poedinoki', destination: '/admin/bouts', permanent: true },
      { source: '/admin/poedinoki/:path*', destination: '/admin/bouts/:path*', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Language', value: 'ru' },
          ...getAppSecurityHeaders(),
        ],
      },
    ]
  },
}

export default nextConfig
