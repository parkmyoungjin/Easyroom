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
  // experimental 설정 제거 - 빌드 안정성을 위해
  webpack: (config, { isServer, dev }) => {
    // 기본적인 fallback만 설정
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // 서버 사이드에서 self 정의
    if (isServer) {
      const webpack = require('webpack');
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.DefinePlugin({
          'typeof self': '"object"',
          'self': 'globalThis'
        })
      );
    }

    // 프로덕션 빌드에서 console.log 제거
    if (!dev) {
      config.optimization = config.optimization || {};
      config.optimization.minimizer = config.optimization.minimizer || [];
      
      const TerserPlugin = require('terser-webpack-plugin');
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true, // console.log 제거
              drop_debugger: true, // debugger 제거
            },
          },
        })
      );
    }
    
    return config;
  },
};

export default nextConfig;
