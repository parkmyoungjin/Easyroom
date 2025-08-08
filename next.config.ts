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
  webpack: (config, { isServer }) => {
    // Essential fallback configuration for server isolation
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Server-side module resolution
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/polyfills/server-isolation': require.resolve('./src/lib/polyfills/server-isolation.ts'),
      };
      
      // Ignore problematic modules that cause server-side issues
      config.externals = config.externals || [];
      config.externals.push({
        'react-native-sqlite-storage': 'react-native-sqlite-storage',
        'react-native': 'react-native',
      });
    } else {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/polyfills/client-polyfills': require.resolve('./src/lib/polyfills/client-polyfills.ts'),
      };
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
    scriptSrc += ` ${supabaseUrl} https://vercel.live`;
    
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
      "frame-src https://vercel.live",
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
