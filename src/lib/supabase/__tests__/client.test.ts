// src/lib/supabase/__tests__/client.test.ts (최종 교체 코드)

import { createClient } from '../client';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

// @supabase/auth-helpers-nextjs 모듈 전체를 모킹합니다.
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  // 이 모듈이 export하는 함수들 중 우리가 사용하는 것만 모킹합니다.
  createPagesBrowserClient: jest.fn(),
}));

// 모킹된 함수를 타입스크립트가 인식할 수 있도록 캐스팅합니다.
const mockCreatePagesBrowserClient = createPagesBrowserClient as jest.Mock;

describe('Supabase Client Helper (client.ts)', () => {

  // 각 테스트가 실행되기 전에 모든 mock을 초기화하여 테스트 간 독립성을 보장합니다.
  beforeEach(() => {
    mockCreatePagesBrowserClient.mockClear();
  });

  it('should call createPagesBrowserClient to create a supabase client', () => {
    // 우리가 만든 createClient 함수를 호출합니다.
    createClient();

    // 내부적으로 @supabase/auth-helpers-nextjs의 함수가
    // 딱 한 번 호출되었는지를 검증합니다.
    expect(mockCreatePagesBrowserClient).toHaveBeenCalledTimes(1);
  });

  it('should return the client instance created by auth-helpers', () => {
    // auth-helpers 함수가 특정 가짜 객체를 반환하도록 설정합니다.
    const mockSupabaseClient = { id: 'mock-client' };
    mockCreatePagesBrowserClient.mockReturnValue(mockSupabaseClient);

    // 우리가 만든 createClient 함수를 호출하고 그 결과를 받습니다.
    const client = createClient();

    // 반환된 결과가 auth-helpers가 만들어준 가짜 객체와 동일한지 검증합니다.
    expect(client).toBe(mockSupabaseClient);
  });
});