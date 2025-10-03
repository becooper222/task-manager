/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure proper handling of Supabase authentication
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
    ]
  }
};

module.exports = nextConfig; 