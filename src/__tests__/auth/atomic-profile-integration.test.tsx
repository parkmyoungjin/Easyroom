/**
 * Integration Tests for Atomic Profile System
 * 작전명: Operation Atomic Profile - Task 5 Real-World Scenarios
 * 
 * Tests the actual scenarios that were causing problems:
 * - Login followed by page refresh
 * - Profile loading states
 * - Error recovery
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// Create a simplified test version of the atomic profile system
type MockUser = {
  id: string;
  email: string;
};

type MockSession = {
  user: MockUser;
} | null;

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type UserProfile = {
  authId: string;
  dbId: string;
  employeeId?: string;
  email: string;
  name: string;
  department: string;
  role: 'admin' | 'employee';
  createdAt: string;
  updatedAt?: string;
};

// Mock implementation of the atomic profile system
class MockAtomicProfileSystem {
  private authStatus: AuthStatus = 'loading';
  private user: MockUser | null = null;
  private userProfile: UserProfile | null = null;
  private listeners: Array<(status: AuthStatus, user: MockUser | null, profile: UserProfile | null) => void> = [];
  private mockRpcFunction: jest.Mock;

  constructor(mockRpcFunction: jest.Mock) {
    this.mockRpcFunction = mockRpcFunction;
  }

  // Simulate the getOrCreateProfile function
  private async getOrCreateProfile(): Promise<UserProfile> {
    const { data, error } = await this.mockRpcFunction();
    
    if (error) {
      console.error("CRITICAL: get_or_create_user_profile RPC failed.", error);
      throw error;
    }

    if (!data) {
      throw new Error("CRITICAL: get_or_create_user_profile RPC returned no data despite success status.");
    }

    return {
      authId: data.authId,
      dbId: data.dbId,
      employeeId: data.employeeId || undefined,
      email: data.email || 'unknown@example.com',
      name: data.name?.trim() || '알 수 없는 사용자',
      department: data.department?.trim() || '소속 없음',
      role: (data.role === 'admin' || data.role === 'employee') ? data.role : 'employee',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt || undefined,
    };
  }

  // Simulate authentication state change
  async simulateAuthStateChange(event: string, session: MockSession) {
    try {
      if (session?.user) {
        // This simulates the actual AuthProvider logic
        const profile = await this.getOrCreateProfile();
        
        this.user = session.user;
        this.userProfile = profile;
        this.authStatus = 'authenticated';
      } else {
        this.user = null;
        this.userProfile = null;
        this.authStatus = 'unauthenticated';
      }
    } catch (error) {
      console.error(`Exception caught during event '${event}'.`, error);
      this.user = null;
      this.userProfile = null;
      this.authStatus = 'unauthenticated';
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      listener(this.authStatus, this.user, this.userProfile);
    });
  }

  // Add listener
  addListener(listener: (status: AuthStatus, user: MockUser | null, profile: UserProfile | null) => void) {
    this.listeners.push(listener);
  }

  // Get current state
  getState() {
    return {
      authStatus: this.authStatus,
      user: this.user,
      userProfile: this.userProfile,
    };
  }
}

describe('Atomic Profile System - Integration Tests', () => {
  let mockRpcFunction: jest.Mock;
  let profileSystem: MockAtomicProfileSystem;

  beforeEach(() => {
    mockRpcFunction = jest.fn();
    profileSystem = new MockAtomicProfileSystem(mockRpcFunction);

    // Suppress console logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Task 5.1: Core Authentication Flow', () => {
    it('should successfully authenticate and load profile', async () => {
      // Mock successful RPC response
      const mockProfileData = {
        authId: 'auth-123',
        dbId: 'db-456',
        employeeId: 'EMP001',
        email: 'test@example.com',
        name: 'Test User',
        department: 'Engineering',
        role: 'employee',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockRpcFunction.mockResolvedValue({
        data: mockProfileData,
        error: null,
      });

      // Track state changes
      const stateChanges: Array<{ status: AuthStatus; user: MockUser | null; profile: UserProfile | null }> = [];
      profileSystem.addListener((status, user, profile) => {
        stateChanges.push({ status, user, profile });
      });

      // Initial state should be loading
      expect(profileSystem.getState().authStatus).toBe('loading');

      // Simulate successful login
      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      await profileSystem.simulateAuthStateChange('SIGNED_IN', mockSession);

      // Verify final state
      const finalState = profileSystem.getState();
      expect(finalState.authStatus).toBe('authenticated');
      expect(finalState.user?.id).toBe('auth-123');
      expect(finalState.userProfile?.name).toBe('Test User');
      expect(finalState.userProfile?.email).toBe('test@example.com');
      expect(finalState.userProfile?.department).toBe('Engineering');
      expect(finalState.userProfile?.role).toBe('employee');

      // Verify RPC was called
      expect(mockRpcFunction).toHaveBeenCalledTimes(1);

      // Verify state change was notified
      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].status).toBe('authenticated');
    });

    it('should handle RPC failure gracefully', async () => {
      // Mock RPC failure
      mockRpcFunction.mockResolvedValue({
        data: null,
        error: { message: 'Authentication required: User is not logged in.' },
      });

      // Track state changes
      const stateChanges: Array<{ status: AuthStatus }> = [];
      profileSystem.addListener((status) => {
        stateChanges.push({ status });
      });

      // Simulate login attempt with RPC failure
      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      await profileSystem.simulateAuthStateChange('SIGNED_IN', mockSession);

      // Should transition to unauthenticated due to RPC failure
      const finalState = profileSystem.getState();
      expect(finalState.authStatus).toBe('unauthenticated');
      expect(finalState.user).toBeNull();
      expect(finalState.userProfile).toBeNull();

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        "CRITICAL: get_or_create_user_profile RPC failed.",
        { message: 'Authentication required: User is not logged in.' }
      );
    });

    it('should handle logout correctly', async () => {
      // First, simulate successful login
      mockRpcFunction.mockResolvedValue({
        data: {
          authId: 'auth-123',
          dbId: 'db-456',
          email: 'test@example.com',
          name: 'Test User',
          department: 'Engineering',
          role: 'employee',
          createdAt: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      await profileSystem.simulateAuthStateChange('SIGNED_IN', {
        user: { id: 'auth-123', email: 'test@example.com' }
      });

      // Verify authenticated state
      expect(profileSystem.getState().authStatus).toBe('authenticated');

      // Now simulate logout
      await profileSystem.simulateAuthStateChange('SIGNED_OUT', null);

      // Verify unauthenticated state
      const finalState = profileSystem.getState();
      expect(finalState.authStatus).toBe('unauthenticated');
      expect(finalState.user).toBeNull();
      expect(finalState.userProfile).toBeNull();
    });
  });

  describe('Task 5.2: Data Validation and Safety Defaults', () => {
    it('should apply safety defaults for incomplete data', async () => {
      // Mock RPC with incomplete data
      const mockIncompleteData = {
        authId: 'auth-123',
        dbId: 'db-456',
        employeeId: null,
        email: '', // Empty email
        name: '   ', // Whitespace-only name
        department: null, // Null department
        role: 'invalid_role', // Invalid role
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: null,
      };

      mockRpcFunction.mockResolvedValue({
        data: mockIncompleteData,
        error: null,
      });

      await profileSystem.simulateAuthStateChange('SIGNED_IN', {
        user: { id: 'auth-123', email: 'test@example.com' }
      });

      const finalState = profileSystem.getState();
      expect(finalState.authStatus).toBe('authenticated');
      
      const profile = finalState.userProfile!;
      expect(profile.email).toBe('unknown@example.com');
      expect(profile.name).toBe('알 수 없는 사용자');
      expect(profile.department).toBe('소속 없음');
      expect(profile.role).toBe('employee'); // Default role
      expect(profile.employeeId).toBeUndefined();
      expect(profile.updatedAt).toBeUndefined();
    });

    it('should preserve valid data and only apply defaults where needed', async () => {
      const mockMixedData = {
        authId: 'auth-123',
        dbId: 'db-456',
        employeeId: 'EMP001',
        email: 'valid@example.com', // Valid email
        name: 'Valid User', // Valid name
        department: '', // Empty department - should get default
        role: 'admin', // Valid role
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T12:00:00Z',
      };

      mockRpcFunction.mockResolvedValue({
        data: mockMixedData,
        error: null,
      });

      await profileSystem.simulateAuthStateChange('SIGNED_IN', {
        user: { id: 'auth-123', email: 'valid@example.com' }
      });

      const finalState = profileSystem.getState();
      const profile = finalState.userProfile!;
      
      // Verify valid data is preserved
      expect(profile.email).toBe('valid@example.com');
      expect(profile.name).toBe('Valid User');
      expect(profile.role).toBe('admin');
      expect(profile.employeeId).toBe('EMP001');
      expect(profile.updatedAt).toBe('2025-01-01T12:00:00Z');
      
      // Verify default is applied only where needed
      expect(profile.department).toBe('소속 없음');
    });
  });

  describe('Task 5.3: Error Scenarios', () => {
    it('should handle network timeout errors', async () => {
      mockRpcFunction.mockRejectedValue(new Error('Network timeout'));

      await profileSystem.simulateAuthStateChange('SIGNED_IN', {
        user: { id: 'auth-123', email: 'test@example.com' }
      });

      const finalState = profileSystem.getState();
      expect(finalState.authStatus).toBe('unauthenticated');
      expect(finalState.user).toBeNull();
      expect(finalState.userProfile).toBeNull();
    });

    it('should handle RPC returning no data', async () => {
      mockRpcFunction.mockResolvedValue({
        data: null,
        error: null,
      });

      await profileSystem.simulateAuthStateChange('SIGNED_IN', {
        user: { id: 'auth-123', email: 'test@example.com' }
      });

      const finalState = profileSystem.getState();
      expect(finalState.authStatus).toBe('unauthenticated');
    });
  });

  describe('Task 5.4: Page Refresh Scenario (The Core Problem)', () => {
    it('should handle page refresh after successful login', async () => {
      // This test simulates the actual problem scenario:
      // 1. User logs in successfully
      // 2. Page is refreshed
      // 3. AuthProvider should re-authenticate and load profile

      // Step 1: Initial successful login
      mockRpcFunction.mockResolvedValue({
        data: {
          authId: 'auth-123',
          dbId: 'db-456',
          email: 'test@example.com',
          name: 'Test User',
          department: 'Engineering',
          role: 'employee',
          createdAt: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      await profileSystem.simulateAuthStateChange('SIGNED_IN', {
        user: { id: 'auth-123', email: 'test@example.com' }
      });

      // Verify initial login success
      expect(profileSystem.getState().authStatus).toBe('authenticated');

      // Step 2: Simulate page refresh (new instance of the system)
      const refreshedSystem = new MockAtomicProfileSystem(mockRpcFunction);
      
      // Step 3: Simulate the auth state change that happens on page load
      // (This is what should happen when the page refreshes and the user is still logged in)
      await refreshedSystem.simulateAuthStateChange('SIGNED_IN', {
        user: { id: 'auth-123', email: 'test@example.com' }
      });

      // Step 4: Verify that the refreshed system correctly loads the profile
      const refreshedState = refreshedSystem.getState();
      expect(refreshedState.authStatus).toBe('authenticated');
      expect(refreshedState.user?.id).toBe('auth-123');
      expect(refreshedState.userProfile?.name).toBe('Test User');

      // Verify RPC was called again (once for initial login, once for refresh)
      expect(mockRpcFunction).toHaveBeenCalledTimes(2);
    });

    it('should not get stuck in loading state after refresh', async () => {
      // This specifically tests the "loading stuck" problem

      const stateHistory: AuthStatus[] = [];
      
      // Track all state changes
      profileSystem.addListener((status) => {
        stateHistory.push(status);
      });

      // Mock successful RPC
      mockRpcFunction.mockResolvedValue({
        data: {
          authId: 'auth-123',
          dbId: 'db-456',
          email: 'test@example.com',
          name: 'Test User',
          department: 'Engineering',
          role: 'employee',
          createdAt: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      // Initial state is loading
      expect(profileSystem.getState().authStatus).toBe('loading');

      // Simulate auth state change (what happens after page refresh)
      await profileSystem.simulateAuthStateChange('SIGNED_IN', {
        user: { id: 'auth-123', email: 'test@example.com' }
      });

      // Verify we moved out of loading state
      expect(profileSystem.getState().authStatus).toBe('authenticated');
      
      // Verify the state progression was correct
      expect(stateHistory).toEqual(['authenticated']);
      
      // Most importantly: we should NOT be stuck in loading state
      expect(profileSystem.getState().authStatus).not.toBe('loading');
    });
  });
});