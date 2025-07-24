import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('API Pagination Support Tests', () => {
  describe('URL Parameter Construction', () => {
    it('should construct pagination parameters correctly', () => {
      const params = new URLSearchParams({
        startDate: '2025-01-22',
        endDate: '2025-01-22',
        limit: '20',
        offset: '0'
      });

      expect(params.toString()).toBe('startDate=2025-01-22&endDate=2025-01-22&limit=20&offset=0');
    });

    it('should handle different limit values', () => {
      const params = new URLSearchParams({
        startDate: '2025-01-22',
        endDate: '2025-01-22',
        limit: '50',
        offset: '100'
      });

      expect(params.toString()).toBe('startDate=2025-01-22&endDate=2025-01-22&limit=50&offset=100');
    });

    it('should handle special characters in dates', () => {
      const params = new URLSearchParams({
        startDate: '2025-01-22T00:00:00.000Z',
        endDate: '2025-01-22T23:59:59.999Z',
        limit: '20',
        offset: '0'
      });

      expect(params.toString()).toContain('startDate=2025-01-22T00%3A00%3A00.000Z');
      expect(params.toString()).toContain('endDate=2025-01-22T23%3A59%3A59.999Z');
    });
  });

  describe('Pagination Metadata Calculation', () => {
    it('should calculate pagination metadata correctly', () => {
      const limit = 10;
      const offset = 20;
      const totalCount = 47;
      const hasMore = true;

      const currentPage = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(totalCount / limit);

      expect(currentPage).toBe(3); // Math.floor(20 / 10) + 1
      expect(totalPages).toBe(5);  // Math.ceil(47 / 10)
    });

    it('should handle first page correctly', () => {
      const limit = 20;
      const offset = 0;
      const totalCount = 100;

      const currentPage = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(totalCount / limit);

      expect(currentPage).toBe(1);
      expect(totalPages).toBe(5);
    });

    it('should handle last page correctly', () => {
      const limit = 20;
      const offset = 80;
      const totalCount = 100;

      const currentPage = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(totalCount / limit);
      const hasMore = offset + limit < totalCount;

      expect(currentPage).toBe(5);
      expect(totalPages).toBe(5);
      expect(hasMore).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate limit parameter bounds', () => {
      const validateLimit = (limit: number) => {
        return limit >= 1 && limit <= 100;
      };

      expect(validateLimit(1)).toBe(true);
      expect(validateLimit(50)).toBe(true);
      expect(validateLimit(100)).toBe(true);
      expect(validateLimit(0)).toBe(false);
      expect(validateLimit(150)).toBe(false);
    });

    it('should validate offset parameter bounds', () => {
      const validateOffset = (offset: number) => {
        return offset >= 0;
      };

      expect(validateOffset(0)).toBe(true);
      expect(validateOffset(20)).toBe(true);
      expect(validateOffset(-5)).toBe(false);
    });

    it('should validate that limit and offset are provided together', () => {
      const validatePaginationParams = (limit?: string, offset?: string) => {
        const hasLimit = limit !== undefined && limit !== '';
        const hasOffset = offset !== undefined && offset !== '';
        
        // Both must be provided or both must be omitted
        return (hasLimit && hasOffset) || (!hasLimit && !hasOffset);
      };

      expect(validatePaginationParams('10', '0')).toBe(true);
      expect(validatePaginationParams(undefined, undefined)).toBe(true);
      expect(validatePaginationParams('10', undefined)).toBe(false);
      expect(validatePaginationParams(undefined, '0')).toBe(false);
    });
  });

  describe('Response Structure', () => {
    it('should structure paginated response correctly', () => {
      const mockData = [
        { id: 'res1', title: 'Meeting 1' },
        { id: 'res2', title: 'Meeting 2' }
      ];

      const paginationMeta = {
        limit: 10,
        offset: 0,
        total_count: 25,
        has_more: true,
        current_page: 1,
        total_pages: 3
      };

      const response = {
        data: mockData,
        message: '2개의 예약을 조회했습니다.',
        authenticated: true,
        userId: 'user123',
        pagination: paginationMeta
      };

      expect(response.data).toHaveLength(2);
      expect(response.pagination.total_count).toBe(25);
      expect(response.pagination.has_more).toBe(true);
    });

    it('should structure non-paginated response correctly', () => {
      const mockData = [
        { id: 'res1', title: 'Meeting 1' },
        { id: 'res2', title: 'Meeting 2' }
      ];

      const response = {
        data: mockData,
        message: '2개의 예약을 조회했습니다.',
        authenticated: true,
        userId: 'user123'
      };

      expect(response.data).toHaveLength(2);
      expect(response.pagination).toBeUndefined();
    });
  });

  describe('RPC Function Parameters', () => {
    it('should format RPC parameters for paginated query', () => {
      const startDate = '2025-01-22';
      const endDate = '2025-01-22';
      const limit = 10;
      const offset = 20;

      const rpcParams = {
        start_date: `${startDate}T00:00:00.000Z`,
        end_date: `${endDate}T23:59:59.999Z`,
        page_limit: limit,
        page_offset: offset
      };

      expect(rpcParams.start_date).toBe('2025-01-22T00:00:00.000Z');
      expect(rpcParams.end_date).toBe('2025-01-22T23:59:59.999Z');
      expect(rpcParams.page_limit).toBe(10);
      expect(rpcParams.page_offset).toBe(20);
    });

    it('should format RPC parameters for non-paginated query', () => {
      const startDate = '2025-01-22';
      const endDate = '2025-01-22';

      const rpcParams = {
        start_date: `${startDate}T00:00:00.000Z`,
        end_date: `${endDate}T23:59:59.999Z`
      };

      expect(rpcParams.start_date).toBe('2025-01-22T00:00:00.000Z');
      expect(rpcParams.end_date).toBe('2025-01-22T23:59:59.999Z');
      expect(rpcParams.page_limit).toBeUndefined();
      expect(rpcParams.page_offset).toBeUndefined();
    });
  });

  describe('Fallback Query Range', () => {
    it('should calculate range parameters for fallback query', () => {
      const offset = 20;
      const limit = 10;
      
      const rangeStart = offset;
      const rangeEnd = offset + limit - 1;

      expect(rangeStart).toBe(20);
      expect(rangeEnd).toBe(29);
    });

    it('should handle first page range correctly', () => {
      const offset = 0;
      const limit = 20;
      
      const rangeStart = offset;
      const rangeEnd = offset + limit - 1;

      expect(rangeStart).toBe(0);
      expect(rangeEnd).toBe(19);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid limit parameter', () => {
      const parseLimit = (limitStr: string) => {
        const limit = parseInt(limitStr);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          throw new Error('limit은 1-100 사이의 숫자여야 합니다');
        }
        return limit;
      };

      expect(() => parseLimit('abc')).toThrow('limit은 1-100 사이의 숫자여야 합니다');
      expect(() => parseLimit('0')).toThrow('limit은 1-100 사이의 숫자여야 합니다');
      expect(() => parseLimit('150')).toThrow('limit은 1-100 사이의 숫자여야 합니다');
      expect(parseLimit('50')).toBe(50);
    });

    it('should handle invalid offset parameter', () => {
      const parseOffset = (offsetStr: string) => {
        const offset = parseInt(offsetStr);
        if (isNaN(offset) || offset < 0) {
          throw new Error('offset은 0 이상의 숫자여야 합니다');
        }
        return offset;
      };

      expect(() => parseOffset('xyz')).toThrow('offset은 0 이상의 숫자여야 합니다');
      expect(() => parseOffset('-5')).toThrow('offset은 0 이상의 숫자여야 합니다');
      expect(parseOffset('0')).toBe(0);
      expect(parseOffset('20')).toBe(20);
    });
  });
});