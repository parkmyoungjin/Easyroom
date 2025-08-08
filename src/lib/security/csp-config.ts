/**
 * Content Security Policy 설정
 * 보안 헤더 관리를 위한 중앙화된 설정
 */

export interface CSPConfig {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  fontSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  frameSrc: string[];
  objectSrc: string[];
  baseUri: string[];
  formAction: string[];
  frameAncestors: string[];
  upgradeInsecureRequests: boolean;
  blockAllMixedContent: boolean;
}

/**
 * 환경별 CSP 설정 생성
 */
export function createCSPConfig(): CSPConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jynolqsukaltetwmjczh.supabase.co';
  const supabaseDomain = supabaseUrl.replace('https://', '').replace('http://', '');
  const supabaseWsUrl = `wss://${supabaseDomain}`;
  
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 기본 설정
  const baseConfig: CSPConfig = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    connectSrc: ["'self'", supabaseUrl, supabaseWsUrl],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: true,
    blockAllMixedContent: true
  };

  // 환경별 추가 설정
  if (isDevelopment) {
    // 개발 환경에서는 더 관대한 설정
    baseConfig.scriptSrc.push("'unsafe-eval'", "https://unpkg.com");
    baseConfig.connectSrc.push("ws://localhost:*", "http://localhost:*");
  }

  if (isProduction) {
    // 프로덕션에서는 더 엄격한 설정
    // unpkg.com 제거, unsafe-eval 제거
    baseConfig.scriptSrc = baseConfig.scriptSrc.filter(src => 
      src !== "'unsafe-eval'" && !src.includes("unpkg.com")
    );
    
    // Supabase 도메인만 허용
    baseConfig.scriptSrc.push(supabaseUrl);
  }

  return baseConfig;
}

/**
 * CSP 설정을 문자열로 변환
 */
export function cspConfigToString(config: CSPConfig): string {
  const directives: string[] = [];

  // 각 지시어를 문자열로 변환
  if (config.defaultSrc.length > 0) {
    directives.push(`default-src ${config.defaultSrc.join(' ')}`);
  }
  
  if (config.scriptSrc.length > 0) {
    directives.push(`script-src ${config.scriptSrc.join(' ')}`);
  }
  
  if (config.styleSrc.length > 0) {
    directives.push(`style-src ${config.styleSrc.join(' ')}`);
  }
  
  if (config.fontSrc.length > 0) {
    directives.push(`font-src ${config.fontSrc.join(' ')}`);
  }
  
  if (config.imgSrc.length > 0) {
    directives.push(`img-src ${config.imgSrc.join(' ')}`);
  }
  
  if (config.connectSrc.length > 0) {
    directives.push(`connect-src ${config.connectSrc.join(' ')}`);
  }
  
  if (config.frameSrc.length > 0) {
    directives.push(`frame-src ${config.frameSrc.join(' ')}`);
  }
  
  if (config.objectSrc.length > 0) {
    directives.push(`object-src ${config.objectSrc.join(' ')}`);
  }
  
  if (config.baseUri.length > 0) {
    directives.push(`base-uri ${config.baseUri.join(' ')}`);
  }
  
  if (config.formAction.length > 0) {
    directives.push(`form-action ${config.formAction.join(' ')}`);
  }
  
  if (config.frameAncestors.length > 0) {
    directives.push(`frame-ancestors ${config.frameAncestors.join(' ')}`);
  }

  // 불린 지시어들
  if (config.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }
  
  if (config.blockAllMixedContent) {
    directives.push('block-all-mixed-content');
  }

  // 개발 환경에서만 CSP 리포팅 활성화
  if (process.env.NODE_ENV === 'development') {
    directives.push('report-uri /api/csp-report');
  }

  return directives.join('; ');
}

/**
 * 보안 헤더 전체 설정
 */
export function getSecurityHeaders() {
  const cspConfig = createCSPConfig();
  const cspString = cspConfigToString(cspConfig);

  return [
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'X-XSS-Protection',
      value: '1; mode=block',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains; preload',
    },
    {
      key: 'Content-Security-Policy',
      value: cspString,
    },
  ];
}

/**
 * 개발 환경에서 CSP 위반 리포팅
 */
export function logCSPViolation(violationReport: any) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('🚨 CSP Violation:', violationReport);
    console.warn('Blocked URI:', violationReport['blocked-uri']);
    console.warn('Violated Directive:', violationReport['violated-directive']);
    console.warn('Original Policy:', violationReport['original-policy']);
  }
}