import withPWA from 'next-pwa';

// Enable PWA in production, disable in dev to simplify local dev
const isProd = process.env.NODE_ENV === 'production';

const pwa = withPWA({
  dest: 'public',
  disable: !isProd,
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^(http|https):\/\/.*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'https-calls',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
});

export default pwa({
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-progress',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-wallets',
    ],
  },
});
