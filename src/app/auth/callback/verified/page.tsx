'use client';

import { useEffect } from 'react';
import SmartVerifiedPage from '@/components/auth/SmartVerifiedPage';
import { runStartupMigration } from '@/lib/auth/migration-script';

export default function AuthVerifiedPage() {
  useEffect(() => {
    // Run migration on page load to handle any legacy auth state
    runStartupMigration().then(result => {
      console.log('[AuthVerifiedPage] Migration result:', result);
    }).catch(error => {
      console.error('[AuthVerifiedPage] Migration failed:', error);
    });
  }, []);

  const handleAuthStateSet = (success: boolean) => {
    console.log('[AuthVerifiedPage] Auth state set result:', success);
  };

  return (
    <SmartVerifiedPage
      autoCloseDelay={3000}
      onAuthStateSet={handleAuthStateSet}
    />
  );
}