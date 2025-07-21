# Migration History

이 디렉토리는 Supabase 데이터베이스 마이그레이션 파일들을 포함합니다.

## 📋 Migration Timeline

### RPC Function Development (get_public_reservations)

| 파일명 | 날짜 | 상태 | 설명 |
|--------|------|------|------|
| `20250716192239_create_get_public_reservations_function.sql` | 2025-07-16 19:22 | ⚠️ 초기버전 | 함수 초기 생성, VARCHAR 타입 사용 |
| `20250716195116_fix_get_public_reservations_return_types.sql` | 2025-07-16 19:51 | ⚠️ 부분수정 | 타입 수정 시도, 여전히 타입 불일치 |
| `20250716201146_fix_rpc_function_exact_types.sql` | 2025-07-16 20:11 | ✅ **최종버전** | TEXT 타입 명시적 캐스팅으로 완전 해결 |
| `20250716202015_migration_cleanup_documentation.sql` | 2025-07-16 20:20 | 📝 문서화 | 마이그레이션 히스토리 정리 및 문서화 |

## 🎯 Current Status

- **Function**: `get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ)`
- **Status**: ✅ **완전 작동** (모든 테스트 통과 4/4)
- **Permissions**: `authenticated`, `anon` 역할 모두 접근 가능
- **Features**: 
  - 인증된 사용자: 자신의 예약 상세 정보 제공
  - 비인증 사용자: 기본 예약 현황 조회 (제목 마스킹)

## 🔧 Function Signature

```sql
CREATE OR REPLACE FUNCTION get_public_reservations(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  user_id UUID,
  title TEXT,           -- 인증 상태에 따라 마스킹
  purpose TEXT,         -- 자신의 예약만 표시
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  department TEXT,
  user_name TEXT,
  is_mine BOOLEAN       -- 현재 사용자의 예약 여부
)
```

## 📝 Development Notes

### 해결된 문제들
1. **RPC 함수 충돌**: 중복 함수 시그니처 제거
2. **타입 불일치**: PostgreSQL VARCHAR → TEXT 명시적 캐스팅
3. **인증 정책**: 선택적 인증으로 공개 API 구현
4. **권한 설정**: anon 역할에 실행 권한 부여

### 향후 수정 시 참고사항
- **주요 파일**: `20250716201146_fix_rpc_function_exact_types.sql`
- **타입 캐스팅**: 모든 VARCHAR 필드는 `::TEXT`로 명시적 캐스팅 필요
- **권한 설정**: `authenticated`, `anon` 모두에게 EXECUTE 권한 부여 필수

## 🧪 Testing

```bash
npm run test-auth-flow
```

**Expected Result**: 4/4 테스트 통과
- ✅ 데이터베이스 연결
- ✅ 사용자 스키마  
- ✅ RPC 함수
- ✅ API 엔드포인트