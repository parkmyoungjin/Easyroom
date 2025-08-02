/**
 * 공통 테스트 헬퍼 함수들
 * 테스트 설정 및 유틸리티 함수들을 중앙화
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * 테스트용 QueryClient 생성
 */
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * React Query Provider로 래핑된 렌더링
 */
export const renderWithQueryClient = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const testQueryClient = createTestQueryClient();
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: testQueryClient }, children);

  return render(ui, { wrapper: Wrapper, ...options });
};

/**
 * 비동기 작업 대기 헬퍼
 */
export const waitForAsync = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 콘솔 에러 억제 헬퍼
 */
export const suppressConsoleError = () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });
};

/**
 * 윈도우 객체 모킹 헬퍼
 */
export const mockWindowClose = () => {
  const mockClose = jest.fn();
  Object.defineProperty(window, 'close', {
    value: mockClose,
    writable: true
  });
  return mockClose;
};

// Add a simple test to satisfy Jest requirements
describe('Test Helpers', () => {
  it('should export createTestQueryClient', () => {
    expect(createTestQueryClient).toBeDefined();
  });

  it('should create test query client', () => {
    const client = createTestQueryClient();
    expect(client).toBeDefined();
  });
});
