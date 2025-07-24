import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database";
import { getPublicEnvVar, getSecureServiceRoleKey } from "@/lib/security/secure-environment-access";

// 애플리케이션 시작 시 환경 변수 검증
if (typeof window === 'undefined') {
  Promise.all([
    import('@/lib/security/environment-manager'),
    import('@/lib/security/environment-config')
  ]).then(async ([{ environmentManager }, { logEnvironmentConfig }]) => {
    // ✅ nodeEnv 변수를 블록 외부에 선언
    let nodeEnv: 'development' | 'production' | 'test' = 'development'; 

    try {
      try {
        // ✅ try...catch로 getPublicEnvVar 호출을 감쌉니다.
        nodeEnv = getPublicEnvVar('NODE_ENV', 'environment-validation') as 'development' | 'production' | 'test';
      } catch (e) {
        console.warn('NODE_ENV를 가져오는 데 실패하여 "development"로 폴백합니다.');
        nodeEnv = 'development';
      }

      // 개발 환경에서만 환경 설정 정보 출력
      if (nodeEnv === 'development') {
        logEnvironmentConfig();
      }
      
      const validationResult = environmentManager.validateEnvironment();
      
      // 경고가 있는 경우 로그 출력
      if (validationResult.warnings.length > 0) {
        console.warn('환경 변수 검증 경고:', validationResult.warnings);
      }
      
      // 오류가 있는 경우 처리
      if (!validationResult.valid) {
        console.error('환경 변수 검증 실패:', validationResult.errors);
        
        // 프로덕션 환경에서는 프로세스 종료
        if (nodeEnv === 'production') {
          console.error('프로덕션 환경에서 환경 변수 검증 실패로 인해 애플리케이션을 종료합니다.');
          process.exit(1);
        } else {
          // 개발 환경에서는 경고만 출력하고 계속 진행
          console.warn('개발 환경에서 환경 변수 검증 실패가 감지되었습니다. 설정을 확인하세요.');
        }
      } else {
        console.log('✅ 환경 변수 검증 완료');
      }
    } catch (error) {
      console.error('환경 변수 검증 중 예외 발생:', error);
      // ✅ nodeEnv 변수를 여기서도 사용
      if (nodeEnv === 'production') {
        process.exit(1);
      }
    }
  }).catch((error) => {
    console.error('환경 변수 관리자 로드 실패:', error);
    const nodeEnvFallback = process.env.NODE_ENV || 'development';
    if (nodeEnvFallback === 'production') {
      process.exit(1);
    }
  });
}

export async function createClient() {
  const cookieStore = await cookies();

  // Get environment variables securely
  const supabaseUrl = await getPublicEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'supabase-server');
  const supabaseAnonKey = await getPublicEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'supabase-server');

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function createAdminClient(context?: { endpoint?: string; userId?: string }) {
  // 동적 import로 환경 관리자 로드 (순환 의존성 방지)
  // ✅ getPublicEnvVarSecure도 import 합니다.
  const { getServiceRoleKey } = await import('@/lib/security/environment-manager');
  const { getPublicEnvVarSecure } = await import('@/lib/security/secure-environment-access');
  
  try {
    const serviceRoleKey = getServiceRoleKey({
      caller: 'createAdminClient',
      endpoint: context?.endpoint,
      userId: context?.userId
    });

    // Get Supabase URL securely for admin client
    // ✅ 함수 이름을 getPublicEnvVarSecure로 변경합니다.
    const supabaseUrl = await getPublicEnvVarSecure('NEXT_PUBLIC_SUPABASE_URL', 'createAdminClient', context?.endpoint);

    return createServerClient<Database>(
      supabaseUrl,
      serviceRoleKey,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // No-op for admin client
          },
        },
      }
    );
  } catch (error) {
    throw new Error(`관리자 클라이언트 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}