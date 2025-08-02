/**
 * Security Event Monitoring System
 * 실시간 보안 이벤트 모니터링 및 알림 시스템
 */

import { logger } from '@/lib/utils/logger';

export interface SecurityEvent {
  type: 'auth_failure' | 'suspicious_access' | 'data_integrity_violation' | 'rate_limit_exceeded' | 'privilege_escalation_attempt' | 'api_access' | 'authenticated_api_access' | 'anonymous_api_access' | 'admin_operation_attempt' | 'admin_operation_success';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
  source?: string;
}

export interface SecurityAlert {
  id: string;
  eventType: SecurityEvent['type'];
  severity: SecurityEvent['severity'];
  count: number;
  firstOccurrence: string;
  lastOccurrence: string;
  threshold: number;
  timeWindow: number; // minutes
  isActive: boolean;
  details: Record<string, any>;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private alerts: Map<string, SecurityAlert> = new Map();
  private readonly maxEvents = 10000; // 메모리 사용량 제한
  private readonly alertThresholds = {
    auth_failure: { count: 5, window: 15 }, // 15분 내 5회 실패
    suspicious_access: { count: 3, window: 10 }, // 10분 내 3회 의심스러운 접근
    data_integrity_violation: { count: 1, window: 5 }, // 5분 내 1회 데이터 무결성 위반
    rate_limit_exceeded: { count: 10, window: 5 }, // 5분 내 10회 속도 제한 초과
    privilege_escalation_attempt: { count: 1, window: 1 }, // 1분 내 1회 권한 상승 시도
    api_access: { count: 100, window: 5 }, // 5분 내 100회 API 접근 (일반적인 사용량 모니터링)
    authenticated_api_access: { count: 200, window: 5 }, // 5분 내 200회 인증된 API 접근
    anonymous_api_access: { count: 50, window: 5 }, // 5분 내 50회 익명 API 접근
    admin_operation_attempt: { count: 10, window: 10 }, // 10분 내 10회 관리자 작업 시도
    admin_operation_success: { count: 5, window: 5 } // 5분 내 5회 관리자 작업 성공 (모니터링용)
  };

  /**
   * 보안 이벤트 기록
   */
  recordEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    // 이벤트 저장
    this.events.push(securityEvent);
    
    // 메모리 사용량 제한
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // 로깅
    logger.warn('보안 이벤트 감지', {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      endpoint: event.endpoint,
      details: event.details
    });

    // 알림 확인 및 생성
    this.checkAndCreateAlert(securityEvent);
  }

  /**
   * 인증 실패 이벤트 기록
   */
  recordAuthFailure(details: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint: string;
    reason: string;
    attemptedCredentials?: string;
    metadata?: Record<string, any>;
  }): void {
    this.recordEvent({
      type: 'auth_failure',
      severity: 'medium',
      userId: details.userId,
      sessionId: details.sessionId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      endpoint: details.endpoint,
      source: 'authentication_system',
      details: {
        reason: details.reason,
        attemptedCredentials: details.attemptedCredentials ? '[REDACTED]' : undefined
      },
      metadata: details.metadata
    });
  }

  /**
   * 의심스러운 접근 패턴 기록
   */
  recordSuspiciousAccess(details: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint: string;
    pattern: string;
    riskScore: number;
  }): void {
    const severity = details.riskScore >= 80 ? 'high' : 
                    details.riskScore >= 60 ? 'medium' : 'low';

    this.recordEvent({
      type: 'suspicious_access',
      severity,
      userId: details.userId,
      sessionId: details.sessionId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      endpoint: details.endpoint,
      source: 'access_pattern_analyzer',
      details: {
        pattern: details.pattern,
        riskScore: details.riskScore
      }
    });
  }

  /**
   * 데이터 무결성 위반 기록
   */
  recordDataIntegrityViolation(details: {
    userId?: string;
    table: string;
    operation: string;
    violationType: string;
    affectedRecords: number;
    endpoint?: string;
  }): void {
    this.recordEvent({
      type: 'data_integrity_violation',
      severity: 'high',
      userId: details.userId,
      endpoint: details.endpoint,
      source: 'data_integrity_validator',
      details: {
        table: details.table,
        operation: details.operation,
        violationType: details.violationType,
        affectedRecords: details.affectedRecords
      }
    });
  }

  /**
   * 속도 제한 초과 기록
   */
  recordRateLimitExceeded(details: {
    userId?: string;
    ipAddress?: string;
    endpoint: string;
    requestCount: number;
    timeWindow: number;
    limit: number;
  }): void {
    this.recordEvent({
      type: 'rate_limit_exceeded',
      severity: 'medium',
      userId: details.userId,
      ipAddress: details.ipAddress,
      endpoint: details.endpoint,
      source: 'rate_limiter',
      details: {
        requestCount: details.requestCount,
        timeWindow: details.timeWindow,
        limit: details.limit
      }
    });
  }

  /**
   * 권한 상승 시도 기록
   */
  recordPrivilegeEscalationAttempt(details: {
    userId: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint: string;
    attemptedAction: string;
    currentRole: string;
    requiredRole: string;
    metadata?: Record<string, any>;
  }): void {
    this.recordEvent({
      type: 'privilege_escalation_attempt',
      severity: 'critical',
      userId: details.userId,
      sessionId: details.sessionId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      endpoint: details.endpoint,
      source: 'authorization_system',
      details: {
        attemptedAction: details.attemptedAction,
        currentRole: details.currentRole,
        requiredRole: details.requiredRole
      },
      metadata: details.metadata
    });
  }

  /**
   * 알림 확인 및 생성
   */
  private checkAndCreateAlert(event: SecurityEvent): void {
    const threshold = this.alertThresholds[event.type];
    if (!threshold) return;

    const alertKey = `${event.type}_${event.userId || event.ipAddress || 'unknown'}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - threshold.window * 60 * 1000);

    // 시간 창 내의 동일한 유형 이벤트 수 계산
    const recentEvents = this.events.filter(e => 
      e.type === event.type &&
      new Date(e.timestamp) >= windowStart &&
      (e.userId === event.userId || e.ipAddress === event.ipAddress)
    );

    if (recentEvents.length >= threshold.count) {
      const existingAlert = this.alerts.get(alertKey);
      
      if (existingAlert && existingAlert.isActive) {
        // 기존 알림 업데이트
        existingAlert.count = recentEvents.length;
        existingAlert.lastOccurrence = event.timestamp.toISOString();
      } else {
        // 새 알림 생성
        const alert: SecurityAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          eventType: event.type,
          severity: event.severity,
          count: recentEvents.length,
          firstOccurrence: recentEvents[0].timestamp.toISOString(),
          lastOccurrence: event.timestamp.toISOString(),
          threshold: threshold.count,
          timeWindow: threshold.window,
          isActive: true,
          details: {
            userId: event.userId,
            ipAddress: event.ipAddress,
            endpoint: event.endpoint,
            pattern: this.analyzeEventPattern(recentEvents)
          }
        };

        this.alerts.set(alertKey, alert);
        this.triggerAlert(alert);
      }
    }
  }

  /**
   * 이벤트 패턴 분석
   */
  private analyzeEventPattern(events: SecurityEvent[]): string {
    if (events.length <= 1) return 'single_event';

    const timeIntervals = [];
    for (let i = 1; i < events.length; i++) {
      const interval = new Date(events[i].timestamp).getTime() - 
                      new Date(events[i-1].timestamp).getTime();
      timeIntervals.push(interval);
    }

    const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    
    if (avgInterval < 1000) return 'rapid_succession';
    if (avgInterval < 10000) return 'burst_pattern';
    if (avgInterval < 60000) return 'sustained_attack';
    return 'periodic_attempts';
  }

  /**
   * 알림 트리거
   */
  private triggerAlert(alert: SecurityAlert): void {
    logger.error('보안 알림 발생', {
      alertId: alert.id,
      eventType: alert.eventType,
      severity: alert.severity,
      count: alert.count,
      timeWindow: alert.timeWindow,
      details: alert.details
    });

    // 실제 환경에서는 여기서 외부 알림 시스템 호출
    // 예: Slack, Discord, 이메일, SMS 등
    this.sendExternalAlert(alert);
  }

  /**
   * 외부 알림 전송 (구현 예시)
   */
  private async sendExternalAlert(alert: SecurityAlert): Promise<void> {
    try {
      // 심각도에 따른 알림 채널 선택
      const channels = this.getAlertChannels(alert.severity);
      
      const message = this.formatAlertMessage(alert);
      
      // 각 채널로 알림 전송
      for (const channel of channels) {
        await this.sendToChannel(channel, message, alert);
      }
    } catch (error) {
      logger.error('외부 알림 전송 실패', { error, alertId: alert.id });
    }
  }

  /**
   * 심각도별 알림 채널 선택
   */
  private getAlertChannels(severity: SecurityAlert['severity']): string[] {
    switch (severity) {
      case 'critical':
        return ['slack', 'email', 'sms'];
      case 'high':
        return ['slack', 'email'];
      case 'medium':
        return ['slack'];
      case 'low':
        return ['log_only'];
      default:
        return ['log_only'];
    }
  }

  /**
   * 알림 메시지 포맷팅
   */
  private formatAlertMessage(alert: SecurityAlert): string {
    const emoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    }[alert.severity];

    return `${emoji} 보안 알림: ${alert.eventType}
심각도: ${alert.severity.toUpperCase()}
발생 횟수: ${alert.count}회 (${alert.timeWindow}분 내)
첫 발생: ${alert.firstOccurrence}
마지막 발생: ${alert.lastOccurrence}
상세 정보: ${JSON.stringify(alert.details, null, 2)}`;
  }

  /**
   * 채널별 알림 전송
   */
  private async sendToChannel(channel: string, message: string, alert: SecurityAlert): Promise<void> {
    switch (channel) {
      case 'slack':
        await this.sendSlackAlert(message, alert);
        break;
      case 'email':
        await this.sendEmailAlert(message, alert);
        break;
      case 'sms':
        await this.sendSMSAlert(message, alert);
        break;
      case 'log_only':
        // 이미 로깅됨
        break;
    }
  }

  /**
   * Slack 알림 전송
   */
  private async sendSlackAlert(message: string, alert: SecurityAlert): Promise<void> {
    // 실제 구현에서는 Slack Webhook URL 사용
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          attachments: [{
            color: this.getSeverityColor(alert.severity),
            fields: [
              { title: 'Alert ID', value: alert.id, short: true },
              { title: 'Event Type', value: alert.eventType, short: true },
              { title: 'Count', value: alert.count.toString(), short: true },
              { title: 'Time Window', value: `${alert.timeWindow} minutes`, short: true }
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }
    } catch (error) {
      logger.error('Slack 알림 전송 실패', { error, alertId: alert.id });
    }
  }

  /**
   * 이메일 알림 전송
   */
  private async sendEmailAlert(message: string, alert: SecurityAlert): Promise<void> {
    // 실제 구현에서는 이메일 서비스 사용 (예: SendGrid, AWS SES)
    logger.info('이메일 알림 전송 (구현 필요)', { alertId: alert.id, message });
  }

  /**
   * SMS 알림 전송
   */
  private async sendSMSAlert(message: string, alert: SecurityAlert): Promise<void> {
    // 실제 구현에서는 SMS 서비스 사용 (예: Twilio, AWS SNS)
    logger.info('SMS 알림 전송 (구현 필요)', { alertId: alert.id, message });
  }

  /**
   * 심각도별 색상 코드
   */
  private getSeverityColor(severity: SecurityAlert['severity']): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'good';
      case 'low': return '#36a64f';
      default: return '#36a64f';
    }
  }

  /**
   * 활성 알림 조회
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.isActive);
  }

  /**
   * 최근 보안 이벤트 조회
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * 보안 이벤트 통계
   */
  getSecurityStats(timeWindow: number = 60): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    activeAlerts: number;
  } {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow * 60 * 1000);
    
    const recentEvents = this.events.filter(e => 
      new Date(e.timestamp) >= windowStart
    );

    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

    recentEvents.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsBySeverity,
      activeAlerts: this.getActiveAlerts().length
    };
  }

  /**
   * 알림 해제
   */
  resolveAlert(alertId: string): boolean {
    for (const [key, alert] of this.alerts.entries()) {
      if (alert.id === alertId) {
        alert.isActive = false;
        logger.info('보안 알림 해제', { alertId });
        return true;
      }
    }
    return false;
  }

  /**
   * 모니터링 시스템 상태 확인
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    eventsCount: number;
    alertsCount: number;
    memoryUsage: number;
    lastEventTime?: string;
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (activeAlerts.length > 5) {
      status = 'degraded';
    }

    return {
      status,
      eventsCount: this.events.length,
      alertsCount: activeAlerts.length,
      memoryUsage: this.events.length / this.maxEvents,
      lastEventTime: this.events.length > 0 ? this.events[this.events.length - 1].timestamp.toISOString() : undefined
    };
  }
}

// 싱글톤 인스턴스
export const securityMonitor = new SecurityMonitor();

// 편의 함수들
export const recordAuthFailure = securityMonitor.recordAuthFailure.bind(securityMonitor);
export const recordSuspiciousAccess = securityMonitor.recordSuspiciousAccess.bind(securityMonitor);
export const recordDataIntegrityViolation = securityMonitor.recordDataIntegrityViolation.bind(securityMonitor);
export const recordRateLimitExceeded = securityMonitor.recordRateLimitExceeded.bind(securityMonitor);
export const recordPrivilegeEscalationAttempt = securityMonitor.recordPrivilegeEscalationAttempt.bind(securityMonitor);