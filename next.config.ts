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
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
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
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', 'lucide-react'], // 트리 쉐이킹 개선
  },

  // Force CSS cache busting
  generateBuildId: async () => {
    // Generate unique build ID to force cache invalidation
    return `build-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  },

  // Security headers
  async headers() {
    // 환경에 따른 동적 Supabase URL 설정
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jynolqsukaltetwmjczh.supabase.co';
    const supabaseDomain = supabaseUrl.replace('https://', '').replace('http://', '');
    const supabaseWsUrl = `wss://${supabaseDomain}`;
    
    // 프로덕션에서는 더 엄격한 CSP 적용
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // 환경별 script-src 설정
    let scriptSrc = "'self' 'unsafe-inline'";
    if (isDevelopment) {
      scriptSrc += " 'unsafe-eval' https://unpkg.com";
    }
    scriptSrc += ` ${supabaseUrl}`;
    
    // 환경별 connect-src 설정
    let connectSrc = `'self' ${supabaseUrl} ${supabaseWsUrl}`;
    if (isDevelopment) {
      connectSrc += " ws://localhost:* http://localhost:*";
    }

    // CSP 지시어 구성
    const cspDirectives = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      `connect-src ${connectSrc}`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
      "block-all-mixed-content"
    ];

    // 개발 환경에서만 CSP 리포팅 추가
    if (isDevelopment) {
      cspDirectives.push("report-uri /api/csp-report");
    }

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
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: cspDirectives.join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
