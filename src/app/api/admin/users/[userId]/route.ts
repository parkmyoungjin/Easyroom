import { NextResponse } from 'next/server';
import { createRouteClient, createAdminRouteClient } from '@/lib/supabase/actions';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { logger } from '@/lib/utils/logger';
import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const startTime = performance.now();
  const requestId = crypto.randomUUID();
  
  try {
    // Security monitoring: Record admin operation attempt
    securityMonitor.recordEvent({
      type: 'admin_operation_attempt',
      severity: 'high',
      userId: undefined, // Will be set after authentication
      endpoint: '/api/admin/users/[userId]',
      method: 'DELETE',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        requestId,
        targetUserId: userId,
        operation: 'user_deletion'
      }
    });

    logger.apiCall('/api/admin/users/[userId]', 'DELETE', undefined, true, { targetUserId: userId, requestId });
    
    // 서버 사이드에서 관리자 권한 확인 - auth-helpers 방식으로 변경
    const supabase = createRouteClient();
    const sessionResult = await performanceMonitor.measureAuthentication(
      async () => await supabase.auth.getSession(),
      {
        endpoint: '/api/admin/users/[userId]',
        method: 'getSession',
        requestId
      }
    );

    const { data: { session } } = sessionResult;

    if (!session) {
      // Security monitoring: Record authentication failure
      securityMonitor.recordAuthFailure({
        endpoint: '/api/admin/users/[userId]',
        reason: 'No session found',
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: { requestId, targetUserId: userId, operation: 'admin_user_deletion' }
      });

      logger.authEvent('session_check_failed', undefined, false, { endpoint: '/api/admin/users/[userId]', requestId });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 관리자 권한 확인 with performance monitoring
    const adminCheckResult = await performanceMonitor.measureAuthorization(
      async () => await supabase
        .from('users')
        .select('role')
        .eq('auth_id', session.user.id)
        .single(),
      {
        userId: session.user.id,
        operation: 'admin_role_check',
        resource: 'user_deletion',
        requestId
      }
    );

    const { data: adminCheck } = adminCheckResult;

    if (!adminCheck || adminCheck.role !== 'admin') {
      // Security monitoring: Record privilege escalation attempt
      securityMonitor.recordPrivilegeEscalationAttempt({
        userId: session.user.id,
        endpoint: '/api/admin/users/[userId]',
        attemptedAction: 'admin_user_deletion',
        currentRole: adminCheck?.role || 'unknown',
        requiredRole: 'admin',
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: { requestId, targetUserId: userId }
      });

      logger.authzEvent('admin_access_denied', 'user_deletion', session.user.id, adminCheck?.role || 'unknown', false, { 
        targetUserId: userId,
        endpoint: '/api/admin/users/[userId]',
        requestId
      });
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 관리자 권한 확인 성공 로깅
    logger.authzEvent('admin_access_granted', 'user_deletion', session.user.id, 'admin', true, { 
      targetUserId: userId,
      endpoint: '/api/admin/users/[userId]'
    });

    // 보안이 강화된 관리자 클라이언트 생성 - auth-helpers 방식으로 변경
    const supabaseAdmin = createAdminRouteClient()

    // 사용자 삭제 with performance monitoring
    await performanceMonitor.measureDatabaseQuery(
      async () => await supabaseAdmin.auth.admin.deleteUser(userId),
      {
        operation: 'admin_user_deletion',
        table: 'auth.users',
        userId: session.user.id,
        requestId
      }
    );

    // Security monitoring: Record successful admin operation
    securityMonitor.recordEvent({
      type: 'admin_operation_success',
      severity: 'high',
      userId: session.user.id,
      endpoint: '/api/admin/users/[userId]',
      method: 'DELETE',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        requestId,
        targetUserId: userId,
        operation: 'user_deletion',
        success: true
      }
    });

    // Performance monitoring: Record successful request
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric({
      operation: 'admin_api_request_complete',
      duration,
      success: true,
      metadata: {
        endpoint: '/api/admin/users/[userId]',
        userId: session.user.id,
        requestId,
        operation: 'user_deletion'
      }
    });

    // 사용자 삭제 성공 감사 로깅
    logger.dataAccess('delete', 'user', userId, session.user.id, true, {
      action: 'admin_user_deletion',
      endpoint: '/api/admin/users/[userId]',
      requestId
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const structuredError = ReservationErrorHandler.handleApiError(error, {
      action: 'delete_user',
      userId: (await params).userId,
      endpoint: '/api/admin/users/[userId]',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      { 
        error: structuredError.userMessage,
        code: structuredError.code 
      },
      { status: structuredError.type === 'permission' ? 403 : 500 }
    );
  }
} 