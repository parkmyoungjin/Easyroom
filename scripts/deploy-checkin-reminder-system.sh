#!/bin/bash

# 체크인 알림 시스템 배포 스크립트
# 사용법: ./scripts/deploy-checkin-reminder-system.sh

set -e

echo "🚀 체크인 알림 시스템 배포 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
print_step() {
    echo -e "${BLUE}📋 Step $1: $2${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: 환경 확인
print_step 1 "환경 확인"

if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI가 설치되지 않았습니다."
    echo "설치 방법: https://supabase.com/docs/guides/cli"
    exit 1
fi

print_success "Supabase CLI 확인됨"

# Step 2: 데이터베이스 마이그레이션 실행
print_step 2 "데이터베이스 마이그레이션 실행"

echo "마이그레이션 파일들을 실행합니다..."
supabase db push

if [ $? -eq 0 ]; then
    print_success "데이터베이스 마이그레이션 완료"
else
    print_error "데이터베이스 마이그레이션 실패"
    exit 1
fi

# Step 3: VAPID 키 확인
print_step 3 "VAPID 키 설정 확인"

echo "현재 설정된 secrets를 확인합니다..."
supabase secrets list

echo ""
echo "VAPID 키가 설정되지 않았다면 다음 명령어로 설정하세요:"
echo "supabase secrets set VAPID_PUBLIC_KEY=\"YOUR_VAPID_PUBLIC_KEY\""
echo "supabase secrets set VAPID_PRIVATE_KEY=\"YOUR_VAPID_PRIVATE_KEY\""
echo "supabase secrets set VAPID_EMAIL=\"your-email@domain.com\""
echo ""

read -p "VAPID 키가 모두 설정되었습니까? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "VAPID 키를 설정한 후 다시 실행해주세요."
    exit 1
fi

print_success "VAPID 키 설정 확인됨"

# Step 4: Edge Function 배포
print_step 4 "Edge Function 배포"

echo "send-checkin-reminders Edge Function을 배포합니다..."
supabase functions deploy send-checkin-reminders \
    --import-map supabase/functions/send-checkin-reminders/import_map.json \
    --no-verify-jwt

if [ $? -eq 0 ]; then
    print_success "Edge Function 배포 완료"
else
    print_error "Edge Function 배포 실패"
    exit 1
fi

# Step 5: 시스템 검증
print_step 5 "시스템 검증"

echo "시스템 상태를 검증합니다..."

# Supabase SQL 실행을 위한 임시 파일 생성
cat > /tmp/validate_system.sql << 'EOF'
SELECT public.validate_checkin_reminder_system();
EOF

# SQL 실행 및 결과 확인
VALIDATION_RESULT=$(supabase db query --file /tmp/validate_system.sql --output json)

if [ $? -eq 0 ]; then
    print_success "시스템 검증 완료"
    echo "검증 결과:"
    echo "$VALIDATION_RESULT" | jq '.[0].validate_checkin_reminder_system'
else
    print_error "시스템 검증 실패"
    exit 1
fi

# 임시 파일 정리
rm -f /tmp/validate_system.sql

# Step 6: 테스트 실행
print_step 6 "통합 테스트 실행"

read -p "통합 테스트를 실행하시겠습니까? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 테스트 실행을 위한 임시 파일 생성
    cat > /tmp/run_test.sql << 'EOF'
SELECT public.run_checkin_reminder_test();
EOF
    
    echo "통합 테스트를 실행합니다..."
    TEST_RESULT=$(supabase db query --file /tmp/run_test.sql --output json)
    
    if [ $? -eq 0 ]; then
        print_success "통합 테스트 완료"
        echo "테스트 결과:"
        echo "$TEST_RESULT" | jq '.[0].run_checkin_reminder_test'
    else
        print_warning "통합 테스트 실패 (시스템은 정상 배포됨)"
    fi
    
    # 임시 파일 정리
    rm -f /tmp/run_test.sql
fi

# Step 7: 배포 완료
print_step 7 "배포 완료"

echo ""
echo "🎉 체크인 알림 시스템 배포가 완료되었습니다!"
echo ""
echo "📊 모니터링 대시보드:"
echo "   - 성능 통계: SELECT * FROM public.checkin_reminder_performance;"
echo "   - 시스템 상태: SELECT * FROM public.system_status_dashboard;"
echo "   - 자동화 상태: SELECT public.get_automation_system_status();"
echo ""
echo "🧪 테스트 명령어:"
echo "   - 시스템 검증: SELECT public.validate_checkin_reminder_system();"
echo "   - 통합 테스트: SELECT public.run_checkin_reminder_test();"
echo "   - 수동 실행: SELECT public.trigger_checkin_reminders();"
echo ""
echo "📝 로그 확인:"
echo "   - Edge Function 로그: supabase functions logs send-checkin-reminders"
echo "   - Cron 작업 로그: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;"
echo ""

print_success "배포 스크립트 실행 완료"