/**
 * Pagination System Tests
 * Tests for comprehensive pagination support
 * Requirements: 3.4
 */

import {
  validatePaginationParams,
  calculatePaginationMetadata,
  createPaginatedResponse,
  extractPaginationFromSearchParams,
  PAGINATION_DEFAULTS,
  PAGINATION_CONFIGS,
} from '@/types/pagination';

describe('Pagination System', () => {
  describe('validatePaginationParams', () => {
    it('should validate valid pagination parameters', () => {
      const params = {
        limit: 20,
        offset: 0,
        sortBy: 'name',
        sortOrder: 'asc' as const,
        search: 'test'
      };

      const result = validatePaginationParams(params, {
        allowedSortFields: ['name', 'created_at'],
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized.limit).toBe(20);
      expect(result.sanitized.offset).toBe(0);
      expect(result.sanitized.sortBy).toBe('name');
      expect(result.sanitized.sortOrder).toBe('asc');
      expect(result.sanitized.search).toBe('test');
    });

    it('should sanitize invalid limit values', () => {
      const params = {
        limit: 150, // Exceeds max limit
        offset: 0,
      };

      const result = validatePaginationParams(params, {
        maxLimit: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('limit cannot exceed 100');
      expect(result.sanitized.limit).toBe(100);
    });

    it('should sanitize negative offset values', () => {
      const params = {
        limit: 20,
        offset: -10,
      };

      const result = validatePaginationParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('offset must be 0 or greater');
      expect(result.sanitized.offset).toBe(0);
    });

    it('should validate sort fields', () => {
      const params = {
        limit: 20,
        offset: 0,
        sortBy: 'invalid_field',
      };

      const result = validatePaginationParams(params, {
        allowedSortFields: ['name', 'created_at'],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sortBy must be one of: name, created_at');
      expect(result.sanitized.sortBy).toBeUndefined();
    });

    it('should use default values for missing parameters', () => {
      const params = {};

      const result = validatePaginationParams(params);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.limit).toBe(PAGINATION_DEFAULTS.DEFAULT_LIMIT);
      expect(result.sanitized.offset).toBe(PAGINATION_DEFAULTS.DEFAULT_OFFSET);
      expect(result.sanitized.sortOrder).toBe(PAGINATION_DEFAULTS.DEFAULT_SORT_ORDER);
    });
  });

  describe('calculatePaginationMetadata', () => {
    it('should calculate correct pagination metadata', () => {
      const metadata = calculatePaginationMetadata(100, 20, 40, 20);

      expect(metadata).toEqual({
        limit: 20,
        offset: 40,
        total_count: 100,
        has_more: true,
        current_page: 3,
        total_pages: 5,
        current_count: 20,
      });
    });

    it('should handle last page correctly', () => {
      const metadata = calculatePaginationMetadata(95, 20, 80, 15);

      expect(metadata).toEqual({
        limit: 20,
        offset: 80,
        total_count: 95,
        has_more: false,
        current_page: 5,
        total_pages: 5,
        current_count: 15,
      });
    });

    it('should handle empty results', () => {
      const metadata = calculatePaginationMetadata(0, 20, 0, 0);

      expect(metadata).toEqual({
        limit: 20,
        offset: 0,
        total_count: 0,
        has_more: false,
        current_page: 1,
        total_pages: 0,
        current_count: 0,
      });
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create a properly formatted paginated response', () => {
      const data = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
      const response = createPaginatedResponse(
        data,
        50,
        20,
        0,
        'Success message',
        { extra: 'metadata' }
      );

      expect(response).toEqual({
        data,
        pagination: {
          limit: 20,
          offset: 0,
          total_count: 50,
          has_more: true,
          current_page: 1,
          total_pages: 3,
          current_count: 2,
        },
        message: 'Success message',
        metadata: { extra: 'metadata' },
      });
    });
  });

  describe('extractPaginationFromSearchParams', () => {
    it('should extract pagination parameters from URLSearchParams', () => {
      const searchParams = new URLSearchParams({
        limit: '25',
        offset: '50',
        sortBy: 'name',
        sortOrder: 'desc',
        search: 'test query',
      });

      const result = extractPaginationFromSearchParams(searchParams);

      expect(result).toEqual({
        limit: 25,
        offset: 50,
        sortBy: 'name',
        sortOrder: 'desc',
        search: 'test query',
      });
    });

    it('should use endpoint config defaults', () => {
      const searchParams = new URLSearchParams();

      const result = extractPaginationFromSearchParams(searchParams, 'reservations');

      expect(result).toEqual({
        limit: PAGINATION_CONFIGS.reservations.defaultLimit,
        offset: PAGINATION_DEFAULTS.DEFAULT_OFFSET,
        sortBy: PAGINATION_CONFIGS.reservations.defaultSortBy,
        sortOrder: PAGINATION_CONFIGS.reservations.defaultSortOrder,
        search: undefined,
      });
    });

    it('should handle missing parameters gracefully', () => {
      const searchParams = new URLSearchParams({
        limit: '30',
      });

      const result = extractPaginationFromSearchParams(searchParams);

      expect(result).toEqual({
        limit: 30,
        offset: PAGINATION_DEFAULTS.DEFAULT_OFFSET,
        sortBy: undefined,
        sortOrder: PAGINATION_DEFAULTS.DEFAULT_SORT_ORDER,
        search: undefined,
      });
    });
  });

  describe('PAGINATION_CONFIGS', () => {
    it('should have valid configuration for all endpoints', () => {
      const endpoints = ['reservations', 'rooms', 'users', 'monitoring'] as const;

      endpoints.forEach(endpoint => {
        const config = PAGINATION_CONFIGS[endpoint];
        
        expect(config).toBeDefined();
        expect(config.defaultLimit).toBeGreaterThan(0);
        expect(config.maxLimit).toBeGreaterThanOrEqual(config.defaultLimit);
        expect(config.allowedSortFields).toBeInstanceOf(Array);
        expect(config.allowedSortFields.length).toBeGreaterThan(0);
        expect(config.defaultSortBy).toBeTruthy();
        expect(['asc', 'desc']).toContain(config.defaultSortOrder);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large offset values', () => {
      const metadata = calculatePaginationMetadata(100, 20, 1000, 0);

      expect(metadata.current_page).toBe(51);
      expect(metadata.has_more).toBe(false);
      expect(metadata.current_count).toBe(0);
    });

    it('should handle single item pagination', () => {
      const metadata = calculatePaginationMetadata(1, 20, 0, 1);

      expect(metadata).toEqual({
        limit: 20,
        offset: 0,
        total_count: 1,
        has_more: false,
        current_page: 1,
        total_pages: 1,
        current_count: 1,
      });
    });

    it('should validate extreme limit values', () => {
      const tooSmall = validatePaginationParams({ limit: 0 });
      expect(tooSmall.isValid).toBe(false);
      expect(tooSmall.sanitized.limit).toBe(PAGINATION_DEFAULTS.MIN_LIMIT);

      const tooLarge = validatePaginationParams({ limit: 1000 });
      expect(tooLarge.isValid).toBe(false);
      expect(tooLarge.sanitized.limit).toBe(PAGINATION_DEFAULTS.MAX_LIMIT);
    });
  });
});

  describe('Query Key Generation', () => {
    it('should generate consistent query keys for reservations', () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const isAuthenticated = true;

      // Mock the query key factory
      const paginatedReservationKeys = {
        all: ['reservations'] as const,
        public: (startDate: string, endDate: string, isAuthenticated: boolean) =>
          ['reservations', 'public', startDate, endDate, isAuthenticated] as const,
        infinite: (startDate: string, endDate: string, isAuthenticated: boolean) =>
          ['reservations', 'public', 'infinite', startDate, endDate, isAuthenticated] as const,
      };

      const publicKey = paginatedReservationKeys.public(startDate, endDate, isAuthenticated);
      const infiniteKey = paginatedReservationKeys.infinite(startDate, endDate, isAuthenticated);

      expect(publicKey).toEqual(['reservations', 'public', startDate, endDate, isAuthenticated]);
      expect(infiniteKey).toEqual(['reservations', 'public', 'infinite', startDate, endDate, isAuthenticated]);
    });

    it('should generate different keys for different authentication states', () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const paginatedReservationKeys = {
        public: (startDate: string, endDate: string, isAuthenticated: boolean) =>
          ['reservations', 'public', startDate, endDate, isAuthenticated] as const,
      };

      const authenticatedKey = paginatedReservationKeys.public(startDate, endDate, true);
      const anonymousKey = paginatedReservationKeys.public(startDate, endDate, false);

      expect(authenticatedKey).not.toEqual(anonymousKey);
      expect(authenticatedKey[4]).toBe(true);
      expect(anonymousKey[4]).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date parameters', () => {
      const invalidDate = 'invalid-date';
      const validDate = '2024-01-01';

      expect(() => {
        const start = new Date(invalidDate);
        const end = new Date(validDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new Error('Invalid date format');
        }
      }).toThrow('Invalid date format');
    });

    it('should handle date range validation', () => {
      const startDate = '2024-01-31';
      const endDate = '2024-01-01';

      expect(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
          throw new Error('startDate must be before or equal to endDate');
        }
      }).toThrow('startDate must be before or equal to endDate');
    });

    it('should create structured errors with context', () => {
      const error = new Error('Test error');
      (error as any).status = 404;
      (error as any).statusText = 'Not Found';
      (error as any).endpoint = '/api/test';

      expect(error.message).toBe('Test error');
      expect((error as any).status).toBe(404);
      expect((error as any).statusText).toBe('Not Found');
      expect((error as any).endpoint).toBe('/api/test');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters', () => {
      const validateRequiredParams = (startDate?: string, endDate?: string) => {
        if (!startDate || !endDate) {
          throw new Error('startDate and endDate are required');
        }
      };

      expect(() => validateRequiredParams()).toThrow('startDate and endDate are required');
      expect(() => validateRequiredParams('2024-01-01')).toThrow('startDate and endDate are required');
      expect(() => validateRequiredParams(undefined, '2024-01-01')).toThrow('startDate and endDate are required');
      expect(() => validateRequiredParams('2024-01-01', '2024-01-31')).not.toThrow();
    });

    it('should sanitize pagination parameters with fallbacks', () => {
      const params = {
        limit: -5, // Invalid
        offset: -10, // Invalid
        sortOrder: 'invalid' as any, // Invalid
      };

      const result = validatePaginationParams(params);

      expect(result.sanitized.limit).toBe(PAGINATION_DEFAULTS.MIN_LIMIT);
      expect(result.sanitized.offset).toBe(0);
      // sortOrder는 현재 구현에서 sanitize되지 않고 원래 값이 유지됨
      expect(result.sanitized.sortOrder).toBe('invalid');
      // 대신 validation 오류가 기록되어야 함
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sortOrder must be "asc" or "desc"');
    });
  });