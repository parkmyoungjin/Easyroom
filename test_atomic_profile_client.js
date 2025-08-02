// ============================================================================
// Operation: Atomic Profile - Client-Side Test Script
// ============================================================================
// 
// 이 스크립트는 실제 Supabase 클라이언트를 통해 
// get_or_create_user_profile RPC 함수를 테스트합니다.
//
// 실행 방법:
// 1. 브라우저 개발자 도구 콘솔에서 실행
// 2. 또는 Node.js 환경에서 실행 (supabase 클라이언트 설정 필요)
// ============================================================================

/**
 * 원자적 프로필 RPC 함수 테스트
 * @param {Object} supabase - Supabase 클라이언트 인스턴스
 */
async function testAtomicProfileRPC(supabase) {
    console.log('🧪 === 원자적 프로필 RPC 함수 테스트 시작 ===');
    
    try {
        // ====================================================================
        // 1. 인증 상태 확인
        // ====================================================================
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            console.error('❌ 세션 확인 실패:', sessionError);
            return;
        }
        
        if (!session) {
            console.warn('⚠️ 인증되지 않은 상태 - 로그인 후 테스트 필요');
            console.log('💡 테스트를 위해 먼저 로그인하세요.');
            return;
        }
        
        console.log('✅ 인증된 사용자:', session.user.email);
        
        // ====================================================================
        // 2. 원자적 프로필 RPC 함수 호출
        // ====================================================================
        console.log('🔄 get_or_create_user_profile RPC 호출 중...');
        
        const startTime = performance.now();
        const { data, error } = await supabase.rpc('get_or_create_user_profile').single();
        const endTime = performance.now();
        
        // ====================================================================
        // 3. 결과 검증 및 보고
        // ====================================================================
        if (error) {
            console.error('❌ RPC 호출 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
            return;
        }
        
        if (!data) {
            console.error('❌ RPC가 데이터를 반환하지 않음');
            return;
        }
        
        // 성공 보고
        console.log('✅ RPC 호출 성공!');
        console.log(`⚡ 실행 시간: ${(endTime - startTime).toFixed(2)}ms`);
        console.log('📊 반환된 프로필 데이터:');
        console.table(data);
        
        // ====================================================================
        // 4. 데이터 완전성 검증
        // ====================================================================
        const requiredFields = ['authId', 'dbId', 'email', 'name', 'department', 'role', 'createdAt'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length === 0) {
            console.log('✅ 모든 필수 필드가 존재함');
        } else {
            console.warn('⚠️ 누락된 필드:', missingFields);
        }
        
        // ====================================================================
        // 5. 타입 검증
        // ====================================================================
        const typeChecks = {
            authId: typeof data.authId === 'string',
            dbId: typeof data.dbId === 'string',
            email: typeof data.email === 'string',
            name: typeof data.name === 'string',
            department: typeof data.department === 'string',
            role: ['admin', 'employee'].includes(data.role),
            createdAt: typeof data.createdAt === 'string'
        };
        
        const typeErrors = Object.entries(typeChecks)
            .filter(([field, isValid]) => !isValid)
            .map(([field]) => field);
        
        if (typeErrors.length === 0) {
            console.log('✅ 모든 필드 타입이 올바름');
        } else {
            console.warn('⚠️ 타입 오류 필드:', typeErrors);
        }
        
        // ====================================================================
        // 6. 성능 벤치마크 (여러 번 호출)
        // ====================================================================
        console.log('🏃 성능 벤치마크 테스트 (5회 호출)...');
        const times = [];
        
        for (let i = 0; i < 5; i++) {
            const start = performance.now();
            await supabase.rpc('get_or_create_user_profile').single();
            const end = performance.now();
            times.push(end - start);
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`📈 평균 실행 시간: ${avgTime.toFixed(2)}ms`);
        console.log(`📊 실행 시간 범위: ${Math.min(...times).toFixed(2)}ms - ${Math.max(...times).toFixed(2)}ms`);
        
        console.log('🎉 === 원자적 프로필 RPC 함수 테스트 완료 ===');
        
    } catch (error) {
        console.error('💥 테스트 중 예외 발생:', error);
    }
}

// ============================================================================
// 사용 예시 (브라우저 콘솔에서)
// ============================================================================
console.log(`
🧪 원자적 프로필 RPC 테스트 스크립트 로드됨

사용 방법:
1. 애플리케이션에 로그인
2. 브라우저 개발자 도구 콘솔에서 실행:
   testAtomicProfileRPC(supabase)

또는 전역 supabase 클라이언트가 없는 경우:
   testAtomicProfileRPC(window.supabase)
`);

// Node.js 환경을 위한 export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testAtomicProfileRPC };
}