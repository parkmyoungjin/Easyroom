import { AuthMigrationScript, runStartupMigration } from '@/lib/auth/migration-script';
import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';

// Mock the UniversalAuthStateManager
jest.mock('@/lib/auth/universal-auth-state-manager');

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation()
};

describe('AuthMigrationScript', () => {
  let mockAuthStateManager: jest.Mocked<UniversalAuthStateManager>;
  let migrationScript: AuthMigrationScript;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAuthStateManager = {
      setAuthState: jest.fn(),
      getAuthState: jest.fn(),
      clearAuthState: jest.fn(),
      onStateChange: jest.fn()
    } as any;
    
    // Mock the getInstance static method to return our mock
    (UniversalAuthStateManager as jest.MockedClass<typeof UniversalAuthStateManager>).getInstance = jest.fn().mockReturnValue(mockAuthStateManager);
    
    migrationScript = new AuthMigrationScript();
    
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation();
    localStorageMock.removeItem.mockImplementation();
  });

  afterEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    consoleSpy.warn.mockClear();
  });

  describe('Migration Detection', () => {
    it('detects when migration is needed', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      expect(AuthMigrationScript.isMigrationNeeded()).toBe(true);
    });

    it('detects when migration is not needed', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        version: '2.0',
        timestamp: Date.now(),
        success: true
      }));
      
      expect(AuthMigrationScript.isMigrationNeeded()).toBe(false);
    });

    it('handles corrupted migration log', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      expect(AuthMigrationScript.isMigrationNeeded()).toBe(true);
    });
  });

  describe('Legacy State Detection', () => {
    it('detects legacy auth state with isAuthenticated flag', async () => {
      const legacyState = {
        isAuthenticated: true,
        user: { id: 'user123', email: 'test@example.com' },
        timestamp: Date.now()
      };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify(legacyState);
        return null;
      });
      
      const result = await migrationScript.performMigration();
      
      expect(result.migrationPerformed).toBe(true);
      expect(result.success).toBe(true);
      expect(result.legacyDataFound).toBe(true);
      expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith({
        status: 'authenticated',
        timestamp: expect.any(Number),
        userId: 'user123',
        sessionToken: undefined,
        source: 'internal'
      });
    });

    it('detects legacy token-only state', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_token') return 'legacy-token-123';
        return null;
      });
      
      const result = await migrationScript.performMigration();
      
      expect(result.migrationPerformed).toBe(true);
      expect(result.success).toBe(true);
      expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith({
        status: 'authenticated',
        timestamp: expect.any(Number),
        userId: undefined,
        sessionToken: 'legacy-token-123',
        source: 'internal'
      });
    });

    it('detects legacy user-only state', async () => {
      const legacyState = { user: { id: 'user456', email: 'user@example.com' } };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_migration_log') return null;
        if (key === 'easyroom_user') return JSON.stringify(legacyState);
        return null;
      });
      
      mockAuthStateManager.getAuthState.mockReturnValue(null);
      
      const result = await migrationScript.performMigration();
      
      expect(result.migrationPerformed).toBe(true);
      expect(result.success).toBe(true);
      expect(result.legacyDataFound).toBe(true);
      expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith({
        status: 'authenticated',
        timestamp: expect.any(Number),
        userId: 'user456',
        sessionToken: undefined,
        source: 'internal'
      });
    });

    it('handles multiple legacy keys and uses first valid one', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        if (key === 'easyroom_user') return JSON.stringify({ id: 'user789' });
        return null;
      });
      
      const result = await migrationScript.performMigration();
      
      expect(result.success).toBe(true);
      expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'authenticated' })
      );
    });
  });

  describe('Migration Process', () => {
    it('skips migration if already performed for current version', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_migration_log') {
          return JSON.stringify({
            version: '2.0',
            timestamp: Date.now(),
            success: true
          });
        }
        return null;
      });
      
      const result = await migrationScript.performMigration();
      
      expect(result.migrationPerformed).toBe(false);
      expect(result.success).toBe(true);
      expect(mockAuthStateManager.setAuthState).not.toHaveBeenCalled();
    });

    it('skips migration if new format state already exists', async () => {
      mockAuthStateManager.getAuthState.mockReturnValue({
        status: 'authenticated',
        timestamp: Date.now(),
        source: 'internal'
      });
      
      const result = await migrationScript.performMigration();
      
      expect(result.migrationPerformed).toBe(true);
      expect(result.success).toBe(true);
      expect(result.legacyDataFound).toBe(false);
    });

    it('handles no legacy data found', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      mockAuthStateManager.getAuthState.mockReturnValue(null);
      
      const result = await migrationScript.performMigration();
      
      expect(result.migrationPerformed).toBe(true);
      expect(result.success).toBe(true);
      expect(result.legacyDataFound).toBe(false);
    });

    it('cleans up legacy data after successful migration', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        if (key === 'easyroom_token') return 'token123';
        return null;
      });
      
      await migrationScript.performMigration();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('easyroom_auth');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('easyroom_token');
    });

    it('updates migration log after successful migration', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        return null;
      });
      
      await migrationScript.performMigration();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_migration_log',
        expect.stringContaining('"version":"2.0"')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_migration_log',
        expect.stringContaining('"success":true')
      );
    });
  });

  describe('Error Handling', () => {
    it('handles localStorage access errors during detection', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_migration_log') return null; // Allow migration log access
        throw new Error('localStorage access denied');
      });
      
      mockAuthStateManager.getAuthState.mockReturnValue(null);
      
      const result = await migrationScript.performMigration();
      
      // The actual implementation handles localStorage errors gracefully
      // and continues with migration even if legacy data can't be read
      expect(result.migrationPerformed).toBe(true);
      expect(result.success).toBe(true);
      expect(result.legacyDataFound).toBe(false);
    });

    it('handles auth state manager errors', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        return null;
      });
      
      mockAuthStateManager.setAuthState.mockImplementation(() => {
        throw new Error('Auth state error');
      });
      
      const result = await migrationScript.performMigration();
      
      expect(result.migrationPerformed).toBe(true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Auth state error');
    });

    it('handles cleanup errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        return null;
      });
      
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Cleanup error');
      });
      
      const result = await migrationScript.performMigration();
      
      // Migration should still succeed even if cleanup fails
      expect(result.success).toBe(true);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clean up legacy key'),
        expect.any(String),
        ':',
        expect.any(Error)
      );
    });

    it('handles migration log update errors', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        return null;
      });
      
      localStorageMock.setItem.mockImplementation((key) => {
        if (key === 'easyroom_migration_log') {
          throw new Error('Log update error');
        }
      });
      
      const result = await migrationScript.performMigration();
      
      expect(result.success).toBe(true);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update migration log'),
        expect.any(Error)
      );
    });
  });

  describe('State Conversion', () => {
    it('converts authenticated legacy state correctly', async () => {
      const legacyState = {
        isAuthenticated: true,
        user: { id: 'user123' },
        token: 'token456',
        timestamp: 1234567890
      };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify(legacyState);
        return null;
      });
      
      await migrationScript.performMigration();
      
      expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith({
        status: 'authenticated',
        timestamp: 1234567890,
        userId: 'user123',
        sessionToken: 'token456',
        source: 'internal'
      });
    });

    it('converts unauthenticated legacy state correctly', async () => {
      const legacyState = {
        isAuthenticated: false,
        timestamp: 1234567890
      };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify(legacyState);
        return null;
      });
      
      await migrationScript.performMigration();
      
      expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith({
        status: 'unauthenticated',
        timestamp: 1234567890,
        userId: undefined,
        sessionToken: undefined,
        source: 'internal'
      });
    });

    it('adds current timestamp if missing', async () => {
      const legacyState = { isAuthenticated: true };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify(legacyState);
        return null;
      });
      
      const beforeTime = Date.now();
      await migrationScript.performMigration();
      const afterTime = Date.now();
      
      const setAuthStateCall = mockAuthStateManager.setAuthState.mock.calls[0][0];
      expect(setAuthStateCall.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(setAuthStateCall.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Migration Status', () => {
    it('returns correct migration status', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_migration_log') {
          return JSON.stringify({
            version: '1.0',
            timestamp: 1234567890,
            success: true,
            message: 'Previous migration'
          });
        }
        return null;
      });
      
      const status = migrationScript.getMigrationStatus();
      
      expect(status).toEqual({
        version: '2.0',
        migrationNeeded: true,
        lastMigration: {
          timestamp: 1234567890,
          success: true,
          message: 'Previous migration'
        }
      });
    });

    it('handles missing migration log', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const status = migrationScript.getMigrationStatus();
      
      expect(status).toEqual({
        version: '2.0',
        migrationNeeded: true,
        lastMigration: undefined
      });
    });
  });

  describe('Startup Migration Function', () => {
    it('runs migration through convenience function', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        return null;
      });
      
      const result = await runStartupMigration();
      
      expect(result.migrationPerformed).toBe(true);
      expect(result.success).toBe(true);
      expect(mockAuthStateManager.setAuthState).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('logs migration process steps', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        return null;
      });
      
      await migrationScript.performMigration();
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[Migration] Starting auth state migration')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[Migration] Legacy auth state detected')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[Migration] Migration completed successfully')
      );
    });

    it('logs cleanup operations', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'easyroom_migration_log') return null;
        if (key === 'easyroom_auth') return JSON.stringify({ isAuthenticated: true });
        if (key === 'easyroom_token') return 'token123';
        return null;
      });
      
      mockAuthStateManager.getAuthState.mockReturnValue(null);
      
      await migrationScript.performMigration();
      
      // Check for cleanup logs - verify that cleanup operations are logged
      // The actual implementation logs individual key cleanup and summary
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[Migration] Cleaned up legacy key:'),
        'easyroom_auth'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[Migration] Cleaned up'),
        expect.any(Number),
        expect.stringContaining('legacy storage keys')
      );
    });
  });
});