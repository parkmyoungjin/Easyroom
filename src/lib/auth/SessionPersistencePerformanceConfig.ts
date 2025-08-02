/**
 * Session Persistence Performance Configuration
 * 
 * Centralized configuration for performance optimizations and monitoring
 * in the session persistence system.
 * 
 * Requirements: 4.5, 5.1, 5.4
 */

// ============================================================================
// DEBOUNCE CONFIGURATION
// ============================================================================

export interface DebounceScenarioConfig {
  tabSwitching: number;
  appStateChange: number;
  authEventBurst: number;
  pageNavigation: number;
  userInteraction: number;
  networkReconnection: number;
  sessionRefresh: number;
  cookieValidation: number;
}

export interface SessionPersistencePerformanceConfig {
  // Debouncing settings for high-frequency events
  debounceScenarios: DebounceScenarioConfig;
  
  // Performance monitoring thresholds
  performanceThresholds: {
    maxCookieOperationTime: number;
    maxMiddlewareResponseTime: number;
    maxSyncTime: number;
    maxSessionCheckTime: number;
    maxMemoryUsage: number;
    minSuccessRate: number;
    maxConsecutiveFailures: number;
    maxRenderCount: number;
  };
  
  // Optimization settings
  optimizations: {
    enableBatchCookieOperations: boolean;
    enablePerformanceTracking: boolean;
    enableDebounceOptimization: boolean;
    maxOperationTimeHistory: number;
    maxResponseTimeHistory: number;
    performanceReportingInterval: number;
  };
  
  // Monitoring settings
  monitoring: {
    enableSuccessRateTracking: boolean;
    enableFailurePatternAnalysis: boolean;
    enablePerformanceWarnings: boolean;
    logPerformanceMetrics: boolean;
    performanceLogLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_PERFORMANCE_CONFIG: SessionPersistencePerformanceConfig = {
  // Optimized debounce scenarios based on user behavior patterns
  debounceScenarios: {
    tabSwitching: 200,        // Quick tab switches - short debounce
    appStateChange: 300,      // PWA foreground/background - medium debounce
    authEventBurst: 500,      // Multiple auth events - longer debounce
    pageNavigation: 100,      // Route changes - very short debounce
    userInteraction: 150,     // User-triggered events - short debounce
    networkReconnection: 1000, // Network state changes - long debounce
    sessionRefresh: 800,      // Session refresh events - medium-long debounce
    cookieValidation: 250     // Cookie validation events - short-medium debounce
  },
  
  // Performance thresholds for warning detection
  performanceThresholds: {
    maxCookieOperationTime: 2000,    // 2 seconds
    maxMiddlewareResponseTime: 3000, // 3 seconds
    maxSyncTime: 4000,              // 4 seconds
    maxSessionCheckTime: 5000,       // 5 seconds
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    minSuccessRate: 0.8,            // 80%
    maxConsecutiveFailures: 5,       // 5 consecutive failures
    maxRenderCount: 100             // 100 renders without cleanup
  },
  
  // Performance optimization settings
  optimizations: {
    enableBatchCookieOperations: true,
    enablePerformanceTracking: true,
    enableDebounceOptimization: true,
    maxOperationTimeHistory: 20,     // Keep last 20 operation times
    maxResponseTimeHistory: 10,      // Keep last 10 response times
    performanceReportingInterval: 30000 // Report every 30 seconds
  },
  
  // Monitoring and logging settings
  monitoring: {
    enableSuccessRateTracking: true,
    enableFailurePatternAnalysis: true,
    enablePerformanceWarnings: true,
    logPerformanceMetrics: process.env.NODE_ENV === 'development',
    performanceLogLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
  }
};

// ============================================================================
// ENVIRONMENT-SPECIFIC CONFIGURATIONS
// ============================================================================

export const DEVELOPMENT_PERFORMANCE_CONFIG: Partial<SessionPersistencePerformanceConfig> = {
  // More aggressive debouncing in development for better debugging
  debounceScenarios: {
    tabSwitching: 300,
    appStateChange: 500,
    authEventBurst: 800,
    pageNavigation: 200,
    userInteraction: 250,
    networkReconnection: 1500,
    sessionRefresh: 1000,
    cookieValidation: 400
  },
  
  // Lower thresholds in development for early warning
  performanceThresholds: {
    maxCookieOperationTime: 1500,
    maxMiddlewareResponseTime: 2000,
    maxSyncTime: 3000,
    maxSessionCheckTime: 4000,
    maxMemoryUsage: 80 * 1024 * 1024, // 80MB
    minSuccessRate: 0.9, // 90%
    maxConsecutiveFailures: 3,
    maxRenderCount: 50
  },
  
  monitoring: {
    enableSuccessRateTracking: true,
    enableFailurePatternAnalysis: true,
    enablePerformanceWarnings: true,
    logPerformanceMetrics: true,
    performanceLogLevel: 'debug'
  }
};

export const PRODUCTION_PERFORMANCE_CONFIG: Partial<SessionPersistencePerformanceConfig> = {
  // More conservative debouncing in production for responsiveness
  debounceScenarios: {
    tabSwitching: 150,
    appStateChange: 200,
    authEventBurst: 300,
    pageNavigation: 50,
    userInteraction: 100,
    networkReconnection: 800,
    sessionRefresh: 500,
    cookieValidation: 200
  },
  
  // Higher thresholds in production to avoid false alarms
  performanceThresholds: {
    maxCookieOperationTime: 3000,
    maxMiddlewareResponseTime: 4000,
    maxSyncTime: 5000,
    maxSessionCheckTime: 6000,
    maxMemoryUsage: 150 * 1024 * 1024, // 150MB
    minSuccessRate: 0.7, // 70%
    maxConsecutiveFailures: 8,
    maxRenderCount: 200
  },
  
  monitoring: {
    enableSuccessRateTracking: true,
    enableFailurePatternAnalysis: true,
    enablePerformanceWarnings: false, // Disable warnings in production
    logPerformanceMetrics: false,
    performanceLogLevel: 'error'
  }
};

// ============================================================================
// CONFIGURATION UTILITIES
// ============================================================================

/**
 * Gets the appropriate performance configuration based on environment
 */
export function getPerformanceConfig(): SessionPersistencePerformanceConfig {
  const baseConfig = { ...DEFAULT_PERFORMANCE_CONFIG };
  
  if (process.env.NODE_ENV === 'development') {
    return mergeConfigs(baseConfig, DEVELOPMENT_PERFORMANCE_CONFIG);
  } else if (process.env.NODE_ENV === 'production') {
    return mergeConfigs(baseConfig, PRODUCTION_PERFORMANCE_CONFIG);
  }
  
  return baseConfig;
}

/**
 * Merges performance configurations with deep merge for nested objects
 */
function mergeConfigs(
  base: SessionPersistencePerformanceConfig, 
  override: Partial<SessionPersistencePerformanceConfig>
): SessionPersistencePerformanceConfig {
  return {
    debounceScenarios: { ...base.debounceScenarios, ...override.debounceScenarios },
    performanceThresholds: { ...base.performanceThresholds, ...override.performanceThresholds },
    optimizations: { ...base.optimizations, ...override.optimizations },
    monitoring: { ...base.monitoring, ...override.monitoring }
  };
}

/**
 * Validates performance configuration values
 */
export function validatePerformanceConfig(config: SessionPersistencePerformanceConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate debounce scenarios
  Object.entries(config.debounceScenarios).forEach(([scenario, time]) => {
    if (time < 0) {
      errors.push(`Debounce time for ${scenario} cannot be negative: ${time}`);
    }
    if (time > 5000) {
      warnings.push(`Debounce time for ${scenario} is very high: ${time}ms`);
    }
  });

  // Validate performance thresholds
  if (config.performanceThresholds.minSuccessRate < 0 || config.performanceThresholds.minSuccessRate > 1) {
    errors.push(`minSuccessRate must be between 0 and 1: ${config.performanceThresholds.minSuccessRate}`);
  }

  if (config.performanceThresholds.maxConsecutiveFailures < 1) {
    errors.push(`maxConsecutiveFailures must be at least 1: ${config.performanceThresholds.maxConsecutiveFailures}`);
  }

  // Validate optimization settings
  if (config.optimizations.maxOperationTimeHistory < 1) {
    errors.push(`maxOperationTimeHistory must be at least 1: ${config.optimizations.maxOperationTimeHistory}`);
  }

  if (config.optimizations.performanceReportingInterval < 1000) {
    warnings.push(`performanceReportingInterval is very low: ${config.optimizations.performanceReportingInterval}ms`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Creates a performance configuration optimized for specific use cases
 */
export function createOptimizedConfig(useCase: 'high-frequency' | 'low-latency' | 'resource-constrained'): SessionPersistencePerformanceConfig {
  const baseConfig = getPerformanceConfig();

  switch (useCase) {
    case 'high-frequency':
      // Optimize for applications with many authentication events
      return mergeConfigs(baseConfig, {
        debounceScenarios: {
          tabSwitching: 400,
          appStateChange: 600,
          authEventBurst: 1000,
          pageNavigation: 300,
          userInteraction: 350,
          networkReconnection: 2000,
          sessionRefresh: 1500,
          cookieValidation: 500
        },
        optimizations: {
          enableBatchCookieOperations: true,
          enablePerformanceTracking: true,
          enableDebounceOptimization: true,
          maxOperationTimeHistory: 30,
          maxResponseTimeHistory: 15,
          performanceReportingInterval: 60000
        }
      });

    case 'low-latency':
      // Optimize for applications requiring fast response times
      return mergeConfigs(baseConfig, {
        debounceScenarios: {
          tabSwitching: 100,
          appStateChange: 150,
          authEventBurst: 200,
          pageNavigation: 50,
          userInteraction: 75,
          networkReconnection: 500,
          sessionRefresh: 300,
          cookieValidation: 125
        },
        performanceThresholds: {
          maxCookieOperationTime: 1000,
          maxMiddlewareResponseTime: 1500,
          maxSyncTime: 2000,
          maxSessionCheckTime: 2500,
          maxMemoryUsage: 50 * 1024 * 1024,
          minSuccessRate: 0.95,
          maxConsecutiveFailures: 2,
          maxRenderCount: 30
        }
      });

    case 'resource-constrained':
      // Optimize for applications with limited resources
      return mergeConfigs(baseConfig, {
        debounceScenarios: {
          tabSwitching: 500,
          appStateChange: 800,
          authEventBurst: 1200,
          pageNavigation: 400,
          userInteraction: 450,
          networkReconnection: 3000,
          sessionRefresh: 2000,
          cookieValidation: 600
        },
        optimizations: {
          enableBatchCookieOperations: true,
          enablePerformanceTracking: false, // Reduce overhead
          enableDebounceOptimization: true,
          maxOperationTimeHistory: 5,
          maxResponseTimeHistory: 3,
          performanceReportingInterval: 120000
        },
        monitoring: {
          enableSuccessRateTracking: true,
          enableFailurePatternAnalysis: false, // Reduce memory usage
          enablePerformanceWarnings: false,
          logPerformanceMetrics: false,
          performanceLogLevel: 'error'
        }
      });

    default:
      return baseConfig;
  }
}