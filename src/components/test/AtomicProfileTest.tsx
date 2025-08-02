// ============================================================================
// Operation: Atomic Profile - React Test Component
// ============================================================================
// 
// 이 컴포넌트는 실제 React 애플리케이션에서 
// get_or_create_user_profile RPC 함수를 테스트합니다.
//
// 사용 방법:
// 1. 임시로 페이지에 추가
// 2. 로그인 후 테스트 버튼 클릭
// 3. 결과 확인 후 컴포넌트 제거
// ============================================================================

'use client';

import React, { useState } from 'react';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useAuth } from '@/contexts/AuthContext';

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
  timestamp: string;
}

export default function AtomicProfileTest() {
  const supabase = useSupabaseClient();
  const { user, authStatus } = useAuth();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runSingleTest = async (): Promise<TestResult> => {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    try {
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await supabase.rpc('get_or_create_user_profile').single();
      const endTime = performance.now();

      if (error) {
        return {
          success: false,
          error: `${error.code}: ${error.message}`,
          executionTime: endTime - startTime,
          timestamp
        };
      }

      return {
        success: true,
        data,
        executionTime: endTime - startTime,
        timestamp
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: endTime - startTime,
        timestamp
      };
    }
  };

  const handleSingleTest = async () => {
    setIsRunning(true);
    const result = await runSingleTest();
    setTestResults(prev => [result, ...prev]);
    setIsRunning(false);
  };

  const handleBenchmarkTest = async () => {
    setIsRunning(true);
    const results: TestResult[] = [];
    
    for (let i = 0; i < 5; i++) {
      const result = await runSingleTest();
      results.push(result);
      // 각 테스트 사이에 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setTestResults(prev => [...results, ...prev]);
    setIsRunning(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getAverageTime = () => {
    const successfulTests = testResults.filter(r => r.success && r.executionTime);
    if (successfulTests.length === 0) return 0;
    return successfulTests.reduce((sum, r) => sum + (r.executionTime || 0), 0) / successfulTests.length;
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        🧪 Atomic Profile RPC Test
      </h2>
      
      {/* 상태 정보 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">현재 상태</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">인증 상태:</span>{' '}
            <span className={`px-2 py-1 rounded text-xs ${
              authStatus === 'authenticated' ? 'bg-green-100 text-green-800' :
              authStatus === 'loading' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {authStatus}
            </span>
          </div>
          <div>
            <span className="font-medium">사용자:</span>{' '}
            {user?.email || 'None'}
          </div>
          <div>
            <span className="font-medium">Supabase 클라이언트:</span>{' '}
            <span className={`px-2 py-1 rounded text-xs ${
              supabase ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {supabase ? 'Ready' : 'Not Ready'}
            </span>
          </div>
          <div>
            <span className="font-medium">테스트 실행 중:</span>{' '}
            <span className={`px-2 py-1 rounded text-xs ${
              isRunning ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {isRunning ? 'Running' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* 테스트 버튼들 */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={handleSingleTest}
          disabled={!supabase || authStatus !== 'authenticated' || isRunning}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isRunning ? '실행 중...' : '단일 테스트'}
        </button>
        
        <button
          onClick={handleBenchmarkTest}
          disabled={!supabase || authStatus !== 'authenticated' || isRunning}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isRunning ? '실행 중...' : '벤치마크 (5회)'}
        </button>
        
        <button
          onClick={clearResults}
          disabled={testResults.length === 0}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          결과 지우기
        </button>
      </div>

      {/* 통계 정보 */}
      {testResults.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-2">테스트 통계</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">총 테스트:</span> {testResults.length}
            </div>
            <div>
              <span className="font-medium">성공:</span>{' '}
              <span className="text-green-600">
                {testResults.filter(r => r.success).length}
              </span>
            </div>
            <div>
              <span className="font-medium">실패:</span>{' '}
              <span className="text-red-600">
                {testResults.filter(r => !r.success).length}
              </span>
            </div>
            <div>
              <span className="font-medium">평균 시간:</span>{' '}
              {getAverageTime().toFixed(2)}ms
            </div>
          </div>
        </div>
      )}

      {/* 테스트 결과 */}
      <div className="space-y-4">
        <h3 className="font-semibold">테스트 결과</h3>
        {testResults.length === 0 ? (
          <p className="text-gray-500 italic">아직 테스트 결과가 없습니다.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  result.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.success 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.success ? '✅ SUCCESS' : '❌ FAILED'}
                  </span>
                  <div className="text-xs text-gray-500">
                    {new Date(result.timestamp).toLocaleTimeString()} | 
                    {result.executionTime?.toFixed(2)}ms
                  </div>
                </div>
                
                {result.success && result.data ? (
                  <div className="mt-2">
                    <details className="cursor-pointer">
                      <summary className="font-medium text-sm">프로필 데이터 보기</summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : result.error ? (
                  <div className="mt-2 text-sm text-red-600">
                    <strong>에러:</strong> {result.error}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}