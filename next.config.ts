import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer, dev }) => {
    // Enhanced fallback configuration for better server isolation
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    };

    // Enhanced server-side isolation without global injection
    if (isServer) {
      // Server-side optimizations without polluting globals
      config.plugins = config.plugins || [];
      
      // Add server-specific optimizations
      config.resolve.alias = {
        ...config.resolve.alias,
        // Ensure server-only modules are properly resolved
        '@/lib/polyfills/server-isolation': require.resolve('./src/lib/polyfills/server-isolation.ts'),
      };
    } else {
      // Client-side optimizations
      config.resolve.alias = {
        ...config.resolve.alias,
        // Ensure client-only modules are properly resolved
        '@/lib/polyfills/client-polyfills': require.resolve('./src/lib/polyfills/client-polyfills.ts'),
      };
    }

    // Enhanced production optimizations
    if (!dev) {
      config.optimization = config.optimization || {};
      config.optimization.minimizer = config.optimization.minimizer || [];
      
      const TerserPlugin = require('terser-webpack-plugin');
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true, // Remove console.log in production
              drop_debugger: true, // Remove debugger statements
              pure_funcs: ['console.info', 'console.debug', 'console.warn'], // Remove specific console methods
            },
            mangle: {
              safari10: true, // Fix Safari 10 issues
            },
          },
          extractComments: false, // Don't extract comments to separate files
        })
      );

      // Split chunks for better caching
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };
    }

    // Ignore problematic modules that cause server-side issues
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        'react-native-sqlite-storage': 'react-native-sqlite-storage',
        'react-native': 'react-native',
      });
    }
    
    return config;
  },
  
  // Enhanced experimental features for better performance
  experimental: {
    optimizeCss: true, // Enable CSS optimization
    scrollRestoration: true, // Better scroll restoration
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
