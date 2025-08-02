// Dynamic imports to avoid ES module issues in tests

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface EmailCheckResult {
  exists: boolean;
  error?: {
    type: 'client_not_ready' | 'network_error' | 'database_error' | 'validation_error';
    message: string;
    userMessage: string;
    canRetry: boolean;
    technicalDetails?: string;
  };
}

export interface EmailValidationService {
  checkEmailExists(email: string): Promise<EmailCheckResult>;
  validateEmailFormat(email: string): boolean;
  getValidationError(): string | null;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

// ============================================================================
// EMAIL VALIDATION SERVICE IMPLEMENTATION
// ============================================================================

class EnhancedEmailValidationService implements EmailValidationService {
  private static instance: EnhancedEmailValidationService;
  private lastValidationError: string | null = null;

  // Retry configuration
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 5000,  // 5 seconds
    retryableErrors: [
      'network',
      'timeout',
      'connection',
      'fetch',
      'ENOTFOUND',
      'client_not_ready'
    ]
  };

  private constructor() {}

  static getInstance(): EnhancedEmailValidationService {
    if (!EnhancedEmailValidationService.instance) {
      EnhancedEmailValidationService.instance = new EnhancedEmailValidationService();
    }
    return EnhancedEmailValidationService.instance;
  }

  /**
   * Check if email exists in the database with comprehensive error handling
   */
  async checkEmailExists(email: string): Promise<EmailCheckResult> {
    // Reset previous error
    this.lastValidationError = null;

    // Validate email format first
    if (!this.validateEmailFormat(email)) {
      const error = {
        type: 'validation_error' as const,
        message: 'Invalid email format',
        userMessage: '올바른 이메일 형식을 입력해주세요.',
        canRetry: false,
        technicalDetails: `Email format validation failed for: ${email}`
      };
      this.lastValidationError = error.message;
      return { exists: false, error };
    }

    // Attempt email check with retry logic
    return this.attemptEmailCheckWithRetry(email, 0);
  }

  /**
   * Validate email format using regex
   */
  validateEmailFormat(email: string): boolean {
    // Basic checks first
    if (!email || email.length > 254) return false; // RFC 5321 limit
    if (email.includes('..')) return false; // No consecutive dots
    if (email.startsWith('.') || email.endsWith('.')) return false; // No leading/trailing dots
    if (email.includes('@.') || email.includes('.@')) return false; // No dots adjacent to @
    
    // Must contain exactly one @ symbol
    const atCount = (email.match(/@/g) || []).length;
    if (atCount !== 1) return false;
    
    const [localPart, domainPart] = email.split('@');
    
    // Local part validation
    if (!localPart || localPart.length === 0 || localPart.length > 64) return false;
    
    // Domain part validation - must contain at least one dot for TLD
    if (!domainPart || domainPart.length === 0 || !domainPart.includes('.')) return false;
    
    // More comprehensive email validation regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    
    return emailRegex.test(email);
  }

  /**
   * Get the last validation error
   */
  getValidationError(): string | null {
    return this.lastValidationError;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Attempt email check with retry logic for transient failures
   */
  private async attemptEmailCheckWithRetry(email: string, retryCount: number): Promise<EmailCheckResult> {
    try {
      // Dynamic import to avoid ES module issues in tests
      const { createClient } = await import('@/lib/supabase/client');
      
      // With auth-helpers, client is always ready when created
      const supabase = createClient();
      
      if (!supabase) {
        return this.handleClientInitializationError({
          type: 'configuration',
          message: 'Failed to create Supabase client',
          canRetry: false
        }, email, retryCount);
      }
      
      // Perform the database query - use maybeSingle() to handle 0 or 1 results
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      // Handle database errors
      if (error) {
        return this.handleDatabaseError(error, email, retryCount);
      }

      // Success - return result
      return { exists: !!data };

    } catch (error) {
      return this.handleUnexpectedError(error, email, retryCount);
    }
  }

  /**
   * Handle client initialization errors
   */
  private async handleClientInitializationError(
    initError: { type: string; message: string; canRetry: boolean },
    email: string,
    retryCount: number
  ): Promise<EmailCheckResult> {
    const errorResult: EmailCheckResult = {
      exists: false,
      error: {
        type: 'client_not_ready',
        message: initError.message,
        userMessage: this.getUserFriendlyMessage('client_not_ready', initError.type),
        canRetry: initError.canRetry,
        technicalDetails: `Client initialization failed: ${initError.message}`
      }
    };

    // Retry if possible
    if (initError.canRetry && this.shouldRetry(initError.message, retryCount)) {
      return this.scheduleRetry(email, retryCount, errorResult);
    }

    this.lastValidationError = initError.message;
    return errorResult;
  }

  /**
   * Handle database query errors
   */
  private async handleDatabaseError(
    dbError: any,
    email: string,
    retryCount: number
  ): Promise<EmailCheckResult> {
    const errorMessage = dbError.message || String(dbError);
    
    // Categorize the database error
    let errorType: 'network_error' | 'database_error' = 'database_error';
    let canRetry = false;

    if (this.isNetworkError(errorMessage)) {
      errorType = 'network_error';
      canRetry = true;
    } else if (this.isTransientDatabaseError(errorMessage)) {
      canRetry = true;
    }

    const errorResult: EmailCheckResult = {
      exists: false,
      error: {
        type: errorType,
        message: errorMessage,
        userMessage: this.getUserFriendlyMessage(errorType),
        canRetry,
        technicalDetails: `Database error: ${errorMessage}, Code: ${dbError.code || 'unknown'}`
      }
    };

    // Retry if appropriate
    if (canRetry && this.shouldRetry(errorMessage, retryCount)) {
      return this.scheduleRetry(email, retryCount, errorResult);
    }

    this.lastValidationError = errorMessage;
    return errorResult;
  }

  /**
   * Handle unexpected errors
   */
  private async handleUnexpectedError(
    error: unknown,
    email: string,
    retryCount: number
  ): Promise<EmailCheckResult> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const canRetry = this.isNetworkError(errorMessage);

    const errorResult: EmailCheckResult = {
      exists: false,
      error: {
        type: canRetry ? 'network_error' : 'database_error',
        message: errorMessage,
        userMessage: this.getUserFriendlyMessage(canRetry ? 'network_error' : 'database_error'),
        canRetry,
        technicalDetails: `Unexpected error: ${errorMessage}`
      }
    };

    // Retry if appropriate
    if (canRetry && this.shouldRetry(errorMessage, retryCount)) {
      return this.scheduleRetry(email, retryCount, errorResult);
    }

    this.lastValidationError = errorMessage;
    return errorResult;
  }

  /**
   * Schedule retry with exponential backoff
   */
  private async scheduleRetry(
    email: string,
    retryCount: number,
    lastError: EmailCheckResult
  ): Promise<EmailCheckResult> {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, retryCount),
      this.retryConfig.maxDelay
    );

    // Wait for the delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Attempt retry
    return this.attemptEmailCheckWithRetry(email, retryCount + 1);
  }

  /**
   * Determine if error should trigger a retry
   */
  private shouldRetry(errorMessage: string, retryCount: number): boolean {
    if (retryCount >= this.retryConfig.maxRetries) {
      return false;
    }

    return this.retryConfig.retryableErrors.some(retryableError =>
      errorMessage.toLowerCase().includes(retryableError.toLowerCase())
    );
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(errorMessage: string): boolean {
    const networkErrorKeywords = [
      'network', 'fetch', 'connection', 'timeout', 'ENOTFOUND',
      'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'
    ];
    
    return networkErrorKeywords.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if database error is transient
   */
  private isTransientDatabaseError(errorMessage: string): boolean {
    const transientErrorKeywords = [
      'temporary', 'timeout', 'busy', 'lock', 'deadlock',
      'connection pool', 'too many connections'
    ];
    
    return transientErrorKeywords.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Get user-friendly error messages
   */
  private getUserFriendlyMessage(
    errorType: 'client_not_ready' | 'network_error' | 'database_error' | 'validation_error',
    subType?: string
  ): string {
    switch (errorType) {
      case 'client_not_ready':
        if (subType === 'environment') {
          return '시스템 설정에 문제가 있습니다. 관리자에게 문의해주세요.';
        }
        return '서비스 연결을 준비하고 있습니다. 잠시 후 다시 시도해주세요.';
      
      case 'network_error':
        return '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
      
      case 'database_error':
        return '일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      
      case 'validation_error':
        return '올바른 이메일 형식을 입력해주세요.';
      
      default:
        return '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.';
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE AND EXPORTS
// ============================================================================

const emailValidationService = EnhancedEmailValidationService.getInstance();

/**
 * Check if email exists with comprehensive error handling
 */
export async function checkEmailExists(email: string): Promise<EmailCheckResult> {
  return emailValidationService.checkEmailExists(email);
}

/**
 * Validate email format
 */
export function validateEmailFormat(email: string): boolean {
  return emailValidationService.validateEmailFormat(email);
}

/**
 * Get the email validation service instance
 */
export function getEmailValidationService(): EmailValidationService {
  return emailValidationService;
}

/**
 * Get the last validation error
 */
export function getLastValidationError(): string | null {
  return emailValidationService.getValidationError();
}