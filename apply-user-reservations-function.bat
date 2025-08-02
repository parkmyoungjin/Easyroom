@echo off
echo ========================================
echo Supabase 마이그레이션 적용 중...
echo ========================================

echo.
echo 1. Supabase 로컬 상태 확인...
supabase status

echo.
echo 2. 새로운 마이그레이션 적용...
supabase db push

echo.
echo 3. 함수 생성 확인...
supabase db diff

echo.
echo ========================================
echo 마이그레이션 완료!
echo get_user_reservations_detailed 함수가 생성되었습니다.
echo ========================================

pause