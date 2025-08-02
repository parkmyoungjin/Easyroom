// jest.config.js (The Final Boss)

module.exports = {
  // 각 테스트 실행 전에 설정할 파일들을 지정합니다.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // 테스트 환경을 jsdom(브라우저와 유사한 환경)으로 설정합니다.
  testEnvironment: 'jest-environment-jsdom',

  // 경로 별칭('@/...' 등)을 실제 경로로 매핑합니다.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Jest가 파일을 변환할 때 SWC 대신 babel-jest를 사용하도록 명시적으로 지정합니다.
  // 이것이 모든 제어권을 우리에게 가져오는 핵심 설정입니다.
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },

  // 이제 babel-jest를 직접 제어하므로, 이 설정이 100% 동작합니다.
  transformIgnorePatterns: [
    '/node_modules/(?!' +
    [
      'jose',
      'isows',
      'uuid',
      '@supabase/ssr',
      '@supabase/auth-helpers-nextjs',
      '@supabase/realtime-js',
      '@panva/hkdf',
    ].join('|') +
    ')',
    '^.+\\.module\\.(css|sass|scss)$',
  ],

  // Next.js가 필요로 하는 추가적인 설정들
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};