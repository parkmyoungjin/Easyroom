'use client';

/**
 * Startup Validation Status Component
 * Development component to display environment validation status
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4
 */

import React, { useState } from 'react';
import { useStartupValidation, useServiceReadiness, useValidationPerformance, useDevValidationFeatures } from '@/hooks/useStartupValidation';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface StartupValidationStatusProps {
  className?: string;
  showInProduction?: boolean;
  compact?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StartupValidationStatus({
  className = '',
  showInProduction = false,
  compact = false
}: StartupValidationStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    isValidating,
    validationResult,
    error,
    canContinue,
    requiresUserAction
  } = useStartupValidation();
  
  const {
    serviceStatus,
    isDatabaseReady,
    isAuthReady,
    isStorageReady,
    isMonitoringReady,
    areAllServicesReady
  } = useServiceReadiness();
  
  const {
    validationDuration,
    isSlowValidation,
    environment
  } = useValidationPerformance();
  
  const {
    isDevelopment,
    showTechnicalDetails,
    toggleTechnicalDetails,
    technicalDetails,
    validationSummary
  } = useDevValidationFeatures();

  // Don't show in production unless explicitly allowed
  if (!isDevelopment && !showInProduction) {
    return null;
  }

  // Don't show if validation is in progress and compact mode
  if (compact && isValidating) {
    return null;
  }

  // ============================================================================
  // STATUS INDICATORS
  // ============================================================================

  const getStatusColor = (status: boolean | undefined) => {
    if (status === undefined) return 'text-gray-400';
    return status ? 'text-green-500' : 'text-red-500';
  };

  const getStatusIcon = (status: boolean | undefined) => {
    if (status === undefined) return '⏳';
    return status ? '✅' : '❌';
  };

  const overallStatus = validationResult?.success && areAllServicesReady;

  // ============================================================================
  // COMPACT VIEW
  // ============================================================================

  if (compact) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors ${
            overallStatus
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : 'bg-red-100 text-red-800 hover:bg-red-200'
          }`}
        >
          {getStatusIcon(overallStatus)} ENV
        </button>
        
        {isExpanded && (
          <div className="absolute bottom-full right-0 mb-2 w-80 bg-white border rounded-lg shadow-xl p-4">
            <FullStatusView />
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // FULL VIEW
  // ============================================================================

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <FullStatusView />
    </div>
  );

  // ============================================================================
  // FULL STATUS VIEW COMPONENT
  // ============================================================================

  function FullStatusView() {
    return (
      <>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Environment Status</h3>
          <div className="flex items-center space-x-2">
            <span className={`text-sm ${getStatusColor(overallStatus)}`}>
              {getStatusIcon(overallStatus)} {overallStatus ? 'Ready' : 'Issues'}
            </span>
            <span className="text-xs text-muted-foreground">
              {environment}
            </span>
          </div>
        </div>

        {/* Validation Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Validation</span>
            <div className="flex items-center space-x-2">
              {isValidating ? (
                <span className="text-xs text-blue-600">Validating...</span>
              ) : (
                <span className={`text-xs ${getStatusColor(validationResult?.success)}`}>
                  {getStatusIcon(validationResult?.success)} 
                  {validationResult?.success ? 'Valid' : 'Failed'}
                </span>
              )}
              {validationDuration && (
                <span className={`text-xs ${isSlowValidation ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  {validationDuration.toFixed(0)}ms
                </span>
              )}
            </div>
          </div>

          {/* Service Status */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Database</span>
              <span className={getStatusColor(isDatabaseReady)}>
                {getStatusIcon(isDatabaseReady)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Auth</span>
              <span className={getStatusColor(isAuthReady)}>
                {getStatusIcon(isAuthReady)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Storage</span>
              <span className={getStatusColor(isStorageReady)}>
                {getStatusIcon(isStorageReady)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Monitoring</span>
              <span className={getStatusColor(isMonitoringReady)}>
                {getStatusIcon(isMonitoringReady)}
              </span>
            </div>
          </div>

          {/* Validation Summary */}
          {validationSummary && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              <div className="grid grid-cols-3 gap-2">
                <span>Valid: {validationSummary.valid}</span>
                <span>Invalid: {validationSummary.invalid}</span>
                <span>Missing: {validationSummary.missing}</span>
              </div>
              {validationSummary.criticalErrors > 0 && (
                <div className="text-red-600 mt-1">
                  Critical Errors: {validationSummary.criticalErrors}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <div className="text-sm font-medium text-red-800">{error.title}</div>
              <div className="text-xs text-red-600 mt-1">{error.message}</div>
            </div>
          )}

          {/* Technical Details (Development Only) */}
          {isDevelopment && technicalDetails && (
            <div className="border-t pt-2">
              <button
                onClick={toggleTechnicalDetails}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showTechnicalDetails ? 'Hide' : 'Show'} Technical Details
              </button>
              {showTechnicalDetails && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                  {technicalDetails}
                </pre>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {requiresUserAction && (
            <div className="flex space-x-2 pt-2 border-t">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Retry
              </button>
              {isDevelopment && (
                <button
                  onClick={() => {
                    // Skip validation logic would go here
                    console.log('Skip validation requested');
                  }}
                  className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                >
                  Skip
                </button>
              )}
            </div>
          )}
        </div>
      </>
    );
  }
}

// ============================================================================
// DEVELOPMENT ONLY WRAPPER
// ============================================================================

export function DevStartupValidationStatus(props: StartupValidationStatusProps) {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return <StartupValidationStatus {...props} />;
}