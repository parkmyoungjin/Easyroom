'use client';

/**
 * Startup Validation Hook
 * Custom React hook for accessing startup validation state and actions
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4
 */

import { useCallback, useEffect, useState } from 'react';
import { useStartupValidation as useStartupValidationContext } from '@/components/providers/StartupValidationProvider';
import { validateStartupRequirements, getStartupValidationStatus } from '@/lib/startup/environment-startup-validator';
import type { StartupValidationResult } from '@/lib/startup/environment-startup-validator';

// ============================================================================
// HOOK INTERFACES
// ============================================================================

export interface UseStartupValidationReturn {
  // Validation state
  isValidating: boolean;
  validationResult: StartupValidationResult | null;
  error: any;
  canContinue: boolean;
  requiresUserAction: boolean;
  validationStartTime: number | null;
  
  // Service status
  serviceStatus: {
    database: boolean;
    auth: boolean;
    storage: boolean;
    monitoring: boolean;
  } | null;
  
  // Validation metadata
  validationStatus: {
    cacheSize: number;
    lastValidation?: Date;
    environment: string;
  } | null;
  
  // Actions
  retryValidation: () => Promise<void>;
  skipValidation: () => void;
  checkServiceStatus: () => Promise<void>;
  refreshValidationStatus: () => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useStartupValidation(): UseStartupValidationReturn {
  const context = useStartupValidationContext();
  const [serviceStatus, setServiceStatus] = useState<{
    database: boolean;
    auth: boolean;
    storage: boolean;
    monitoring: boolean;
  } | null>(null);
  const [validationStatus, setValidationStatus] = useState<{
    cacheSize: number;
    lastValidation?: Date;
    environment: string;
  } | null>(null);

  // ============================================================================
  // SERVICE STATUS CHECK
  // ============================================================================

  const checkServiceStatus = useCallback(async () => {
    try {
      const status = await validateStartupRequirements();
      setServiceStatus(status);
    } catch (error) {
      console.error('Failed to check service status:', error);
      setServiceStatus({
        database: false,
        auth: false,
        storage: false,
        monitoring: false
      });
    }
  }, []);

  // ============================================================================
  // VALIDATION STATUS REFRESH
  // ============================================================================

  const refreshValidationStatus = useCallback(() => {
    try {
      const status = getStartupValidationStatus();
      setValidationStatus(status);
    } catch (error) {
      console.error('Failed to get validation status:', error);
      setValidationStatus(null);
    }
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Check service status when validation completes successfully
  useEffect(() => {
    if (context.validationResult?.success && !serviceStatus) {
      checkServiceStatus();
    }
  }, [context.validationResult?.success, serviceStatus, checkServiceStatus]);

  // Refresh validation status periodically
  useEffect(() => {
    refreshValidationStatus();
    
    const interval = setInterval(refreshValidationStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [refreshValidationStatus]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // Context values
    isValidating: context.isValidating,
    validationResult: context.validationResult,
    error: context.error,
    canContinue: context.canContinue,
    requiresUserAction: context.requiresUserAction,
    validationStartTime: context.validationStartTime,
    
    // Additional state
    serviceStatus,
    validationStatus,
    
    // Actions
    retryValidation: context.retryValidation,
    skipValidation: context.skipValidation,
    checkServiceStatus,
    refreshValidationStatus
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook for checking if specific services are ready
 */
export function useServiceReadiness() {
  const { serviceStatus, checkServiceStatus } = useStartupValidation();
  
  return {
    serviceStatus,
    checkServiceStatus,
    isDatabaseReady: serviceStatus?.database ?? false,
    isAuthReady: serviceStatus?.auth ?? false,
    isStorageReady: serviceStatus?.storage ?? false,
    isMonitoringReady: serviceStatus?.monitoring ?? false,
    areAllServicesReady: serviceStatus ? 
      Object.values(serviceStatus).every(status => status) : false
  };
}

/**
 * Hook for validation error handling
 */
export function useValidationError() {
  const { error, retryValidation, skipValidation } = useStartupValidation();
  
  const handleRetry = useCallback(async () => {
    try {
      await retryValidation();
    } catch (retryError) {
      console.error('Retry validation failed:', retryError);
    }
  }, [retryValidation]);
  
  const handleSkip = useCallback(() => {
    try {
      skipValidation();
    } catch (skipError) {
      console.error('Skip validation failed:', skipError);
    }
  }, [skipValidation]);
  
  return {
    error,
    hasError: !!error,
    errorTitle: error?.title,
    errorMessage: error?.message,
    errorActions: error?.actions || [],
    canRetry: error?.canRetry ?? false,
    retryDelay: error?.retryDelay,
    handleRetry,
    handleSkip
  };
}

/**
 * Hook for validation performance monitoring
 */
export function useValidationPerformance() {
  const { validationResult, validationStartTime, validationStatus } = useStartupValidation();
  
  const validationDuration = validationResult?.startupTime;
  const isSlowValidation = validationDuration ? validationDuration > 5000 : false; // > 5 seconds
  
  return {
    validationDuration,
    isSlowValidation,
    validationStartTime,
    lastValidation: validationStatus?.lastValidation,
    cacheSize: validationStatus?.cacheSize ?? 0,
    environment: validationStatus?.environment ?? 'unknown'
  };
}

/**
 * Hook for development-specific validation features
 */
export function useDevValidationFeatures() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const { validationResult, error, validationStatus } = useStartupValidation();
  
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  
  const toggleTechnicalDetails = useCallback(() => {
    setShowTechnicalDetails(prev => !prev);
  }, []);
  
  return {
    isDevelopment,
    showTechnicalDetails,
    toggleTechnicalDetails,
    technicalDetails: error?.technicalDetails,
    validationSummary: validationResult?.validationResult?.summary,
    validationDetails: validationResult?.validationResult?.details,
    debugInfo: isDevelopment ? {
      validationStatus,
      validationResult,
      error
    } : null
  };
}