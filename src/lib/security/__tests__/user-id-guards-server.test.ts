// Mock server-only module to allow testing
jest.mock('server-only', () => ({}));

import { validateUserIdServer, getCorrectUserIdFromAuthIdServer } from '../user-id-guards-server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Mock the server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}));

// Mock logger to avoid console output during tests
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockSupabase = {
  from: jest.fn(),
};

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>;

describe('User ID Guards Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateServerClient.mockReturnValue(mockSupabase as any);
  });

  describe('validateUserIdServer', () => {
    it('should return invalid for non-UUID format', async () => {
      const result = await validateUserIdServer('invalid-id');
      
      expect(result).toEqual({
        isValid: false,
        error: 'Invalid UUID format for user_id'
      });
    });

    it('should return valid result for existing user_id', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440001'; // Valid UUID for user_id
      const mockUser = {
        id: validUserId,
        auth_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test User',
        email: 'test@example.com'
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await validateUserIdServer(validUserId);
      
      expect(result).toEqual({
        isValid: true,
        userId: validUserId,
        authId: '550e8400-e29b-41d4-a716-446655440000'
      });
      
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockQuery.select).toHaveBeenCalledWith('id, auth_id, name, email');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', validUserId);
    });

    it('should detect when user_id is actually auth_id', async () => {
      const authId = '550e8400-e29b-41d4-a716-446655440000';
      const mockUser = {
        id: 123,
        auth_id: authId,
        name: 'Test User',
        email: 'test@example.com'
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: null, error: new Error('Not found') }) // First query fails
          .mockResolvedValueOnce({ data: mockUser, error: null }), // Second query succeeds
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await validateUserIdServer(authId);
      
      expect(result).toEqual({
        isValid: false,
        userId: authId,
        authId: authId,
        error: 'user_id appears to be auth_id instead of database id',
        correctedUserId: mockUser.id
      });
    });

    it('should return invalid for non-existent user_id', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: null, error: new Error('Not found') }) // First query fails
          .mockResolvedValueOnce({ data: null, error: new Error('Not found') }), // Second query also fails
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await validateUserIdServer('550e8400-e29b-41d4-a716-446655440000');
      
      expect(result).toEqual({
        isValid: false,
        userId: '550e8400-e29b-41d4-a716-446655440000',
        error: 'user_id does not exist in users table'
      });
    });

    it('should handle database errors gracefully', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440001'; // Valid UUID for user_id
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await validateUserIdServer(validUserId);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation error: Database connection failed');
    });
  });

  describe('getCorrectUserIdFromAuthIdServer', () => {
    it('should return null for invalid auth_id format', async () => {
      const result = await getCorrectUserIdFromAuthIdServer('invalid-auth-id');
      
      expect(result).toBeNull();
    });

    it('should return correct user_id for valid auth_id', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const mockUser = { id: userId };
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getCorrectUserIdFromAuthIdServer('550e8400-e29b-41d4-a716-446655440000');
      
      expect(result).toBe(userId);
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockQuery.select).toHaveBeenCalledWith('id');
      expect(mockQuery.eq).toHaveBeenCalledWith('auth_id', '550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return null for non-existent auth_id', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getCorrectUserIdFromAuthIdServer('550e8400-e29b-41d4-a716-446655440000');
      
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getCorrectUserIdFromAuthIdServer('550e8400-e29b-41d4-a716-446655440000');
      
      expect(result).toBeNull();
    });
  });
});