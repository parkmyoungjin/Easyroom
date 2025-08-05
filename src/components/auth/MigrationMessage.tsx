/**
 * Migration message component to inform users about the change from Magic Link to OTP
 */

'use client';

import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Alert } from '@mantine/core';
import { 
  getMigrationMessage, 
  type MigrationMessageType 
} from '@/lib/auth/migration-compatibility';

interface MigrationMessageProps {
  type: MigrationMessageType;
  className?: string;
  onDismiss?: () => void;
}

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

export function MigrationMessage({ type, className, onDismiss }: MigrationMessageProps) {
  const message = getMigrationMessage(type);
  const Icon = iconMap[message.type];
  
  return (
    <Alert 
      color={message.type === 'warning' ? 'red' : message.type === 'success' ? 'green' : 'blue'}
      title={message.title}
      icon={<Icon size={16} />}
      className={className}
    >
      {message.description}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 text-sm underline hover:no-underline"
        >
          닫기
        </button>
      )}
    </Alert>
  );
}

/**
 * Hook to manage migration message display
 */
export function useMigrationMessage() {
  const showMigrationMessage = (type: MigrationMessageType) => {
    // Store in sessionStorage to show only once per session
    const key = `migration-message-${type}`;
    const hasShown = sessionStorage.getItem(key);
    
    if (!hasShown) {
      sessionStorage.setItem(key, 'true');
      return true;
    }
    
    return false;
  };
  
  const dismissMigrationMessage = (type: MigrationMessageType) => {
    const key = `migration-message-${type}`;
    sessionStorage.setItem(key, 'true');
  };
  
  return {
    showMigrationMessage,
    dismissMigrationMessage,
  };
}