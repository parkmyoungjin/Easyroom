import { validateEmailFormat } from '../email-validation-service';

describe('EmailValidation Basic Tests', () => {
  describe('validateEmailFormat', () => {
    it('should validate correct email formats', () => {
      expect(validateEmailFormat('test@example.com')).toBe(true);
      expect(validateEmailFormat('user.name@domain.co.kr')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmailFormat('invalid-email')).toBe(false);
      expect(validateEmailFormat('test@')).toBe(false);
      expect(validateEmailFormat('')).toBe(false);
    });
  });
});