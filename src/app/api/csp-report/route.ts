import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

/**
 * CSP 위반 리포트 수집 엔드포인트
 * 개발 환경에서 CSP 위반을 모니터링하기 위해 사용
 */
export async function POST(request: NextRequest) {
  try {
    const report = await request.json();
    
    // 개발 환경에서만 로깅
    if (process.env.NODE_ENV === 'development') {
      logger.warn('CSP Violation Report', {
        blockedUri: report['csp-report']?.['blocked-uri'],
        violatedDirective: report['csp-report']?.['violated-directive'],
        originalPolicy: report['csp-report']?.['original-policy'],
        documentUri: report['csp-report']?.['document-uri'],
        referrer: report['csp-report']?.['referrer'],
        sourceFile: report['csp-report']?.['source-file'],
        lineNumber: report['csp-report']?.['line-number'],
        columnNumber: report['csp-report']?.['column-number'],
        timestamp: new Date().toISOString()
      });
    }

    // 프로덕션에서는 보안 로그로만 기록
    if (process.env.NODE_ENV === 'production') {
      logger.security({
        type: 'suspicious_activity',
        action: 'csp_violation',
        success: false,
        details: {
          blockedUri: report['csp-report']?.['blocked-uri'],
          violatedDirective: report['csp-report']?.['violated-directive'],
          documentUri: report['csp-report']?.['document-uri']
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    // 타입 가드를 사용한 안전한 에러 처리
    const errorToLog = error instanceof Error 
      ? error 
      : { 
          message: 'Unknown error occurred while processing CSP report', 
          details: error,
          timestamp: new Date().toISOString()
        };
    
    logger.error('Failed to process CSP report', errorToLog);
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  }
}

// OPTIONS 요청 처리 (CORS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}