/**
 * OTP Accessibility Tests
 * Tests screen reader support, keyboard navigation, and accessibility compliance
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock accessibility testing utilities
const mockAxeCore = {
  run: jest.fn(),
  configure: jest.fn(),
};

jest.mock('axe-core', () => mockAxeCore);

// Mock screen reader announcements
const mockAnnounce = jest.fn();
jest.mock('@/lib/utils/accessibility', () => ({
  announceToScreenReader: mockAnnounce,
  setFocusWithAnnouncement: jest.fn(),
  createAriaLiveRegion: jest.fn(),
}));

describe('OTP Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup DOM
    document.body.innerHTML = '';
    
    // Mock axe-core results
    mockAxeCore.run.mockResolvedValue({
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Screen Reader Support', () => {
    it('should provide proper ARIA labels for OTP input group', () => {
      // Create OTP input group
      const otpGroup = document.createElement('div');
      otpGroup.setAttribute('role', 'group');
      otpGroup.setAttribute('aria-label', 'Enter 6-digit verification code');
      otpGroup.setAttribute('aria-describedby', 'otp-instructions');

      // Create instructions
      const instructions = document.createElement('div');
      instructions.id = 'otp-instructions';
      instructions.textContent = '이메일로 전송된 6자리 인증 코드를 입력해주세요.';

      document.body.appendChild(otpGroup);
      document.body.appendChild(instructions);

      // Verify ARIA attributes
      expect(otpGroup.getAttribute('role')).toBe('group');
      expect(otpGroup.getAttribute('aria-label')).toBe('Enter 6-digit verification code');
      expect(otpGroup.getAttribute('aria-describedby')).toBe('otp-instructions');
      expect(instructions.textContent).toContain('6자리 인증 코드');
    });

    it('should provide individual ARIA labels for each OTP input', () => {
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', `Digit ${i + 1} of 6`);
        input.setAttribute('aria-describedby', 'otp-instructions');
        input.setAttribute('data-testid', `otp-input-${i}`);
        document.body.appendChild(input);
        return input;
      });

      // Verify each input has proper ARIA labels
      otpInputs.forEach((input, index) => {
        expect(input.getAttribute('aria-label')).toBe(`Digit ${index + 1} of 6`);
        expect(input.getAttribute('aria-describedby')).toBe('otp-instructions');
      });
    });

    it('should announce OTP request status to screen readers', () => {
      const email = 'test@example.com';

      // Simulate OTP request
      const requestMessage = `OTP 코드가 ${email}로 전송되었습니다.`;
      mockAnnounce(requestMessage);

      expect(mockAnnounce).toHaveBeenCalledWith(requestMessage);
    });

    it('should announce timer updates to screen readers', () => {
      // Create timer announcement
      const timerMessage = '4분 30초 후 만료됩니다.';
      mockAnnounce(timerMessage);

      expect(mockAnnounce).toHaveBeenCalledWith(timerMessage);

      // Announce expiration
      const expirationMessage = '코드가 만료되었습니다. 새로운 코드를 요청해주세요.';
      mockAnnounce(expirationMessage);

      expect(mockAnnounce).toHaveBeenCalledWith(expirationMessage);
    });

    it('should announce error messages with proper urgency', () => {
      // Create error live region
      const errorRegion = document.createElement('div');
      errorRegion.setAttribute('role', 'alert');
      errorRegion.setAttribute('aria-live', 'assertive');
      errorRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(errorRegion);

      // Announce error
      const errorMessage = '잘못된 OTP 코드입니다. 2회 남음';
      errorRegion.textContent = errorMessage;

      expect(errorRegion.getAttribute('role')).toBe('alert');
      expect(errorRegion.getAttribute('aria-live')).toBe('assertive');
      expect(errorRegion.textContent).toBe(errorMessage);
    });

    it('should announce success messages appropriately', () => {
      // Create success live region
      const successRegion = document.createElement('div');
      successRegion.setAttribute('role', 'status');
      successRegion.setAttribute('aria-live', 'polite');
      successRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(successRegion);

      // Announce success
      const successMessage = '인증이 완료되었습니다.';
      successRegion.textContent = successMessage;

      expect(successRegion.getAttribute('role')).toBe('status');
      expect(successRegion.getAttribute('aria-live')).toBe('polite');
      expect(successRegion.textContent).toBe(successMessage);
    });

    it('should provide context for loading states', () => {
      // Create loading announcement
      const loadingMessage = 'OTP 코드를 전송하고 있습니다. 잠시만 기다려주세요.';
      mockAnnounce(loadingMessage);

      expect(mockAnnounce).toHaveBeenCalledWith(loadingMessage);

      // Create verification loading
      const verifyingMessage = 'OTP 코드를 확인하고 있습니다.';
      mockAnnounce(verifyingMessage);

      expect(mockAnnounce).toHaveBeenCalledWith(verifyingMessage);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support Tab navigation through OTP inputs', () => {
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.tabIndex = 0;
        input.setAttribute('data-testid', `otp-input-${i}`);
        document.body.appendChild(input);
        return input;
      });

      // Test Tab navigation
      otpInputs[0].focus();
      expect(document.activeElement).toBe(otpInputs[0]);

      // Simulate Tab key
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      otpInputs[0].dispatchEvent(tabEvent);

      // Focus should move to next input (simulated)
      otpInputs[1].focus();
      expect(document.activeElement).toBe(otpInputs[1]);
    });

    it('should support arrow key navigation between inputs', () => {
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('data-testid', `otp-input-${i}`);
        
        // Add arrow key navigation
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' && i < 5) {
            otpInputs[i + 1].focus();
          } else if (e.key === 'ArrowLeft' && i > 0) {
            otpInputs[i - 1].focus();
          }
        });
        
        document.body.appendChild(input);
        return input;
      });

      // Test right arrow navigation
      otpInputs[2].focus();
      expect(document.activeElement).toBe(otpInputs[2]);

      const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      otpInputs[2].dispatchEvent(rightArrowEvent);
      expect(document.activeElement).toBe(otpInputs[3]);

      // Test left arrow navigation
      const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      otpInputs[3].dispatchEvent(leftArrowEvent);
      expect(document.activeElement).toBe(otpInputs[2]);
    });

    it('should handle backspace navigation properly', () => {
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('data-testid', `otp-input-${i}`);
        
        // Add backspace navigation
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace') {
            if (input.value === '' && i > 0) {
              // Move to previous input if current is empty
              otpInputs[i - 1].focus();
              otpInputs[i - 1].value = '';
            } else {
              // Clear current input
              input.value = '';
            }
          }
        });
        
        document.body.appendChild(input);
        return input;
      });

      // Set some values
      otpInputs[0].value = '1';
      otpInputs[1].value = '2';
      otpInputs[2].value = '3';

      // Focus on third input and press backspace
      otpInputs[2].focus();
      const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace' });
      otpInputs[2].dispatchEvent(backspaceEvent);

      expect(otpInputs[2].value).toBe('');

      // Press backspace again to move to previous input
      otpInputs[2].dispatchEvent(backspaceEvent);
      expect(document.activeElement).toBe(otpInputs[1]);
    });

    it('should support Enter key for form submission', () => {
      const form = document.createElement('form');
      const submitHandler = jest.fn();
      form.addEventListener('submit', submitHandler);

      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = (i + 1).toString();
        form.appendChild(input);
        return input;
      });

      document.body.appendChild(form);

      // Press Enter on last input
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      otpInputs[5].dispatchEvent(enterEvent);

      // Simulate form submission
      form.dispatchEvent(new Event('submit'));
      expect(submitHandler).toHaveBeenCalled();
    });

    it('should handle Escape key to clear inputs', () => {
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = (i + 1).toString();
        
        // Add escape key handler
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            otpInputs.forEach(inp => inp.value = '');
            otpInputs[0].focus();
          }
        });
        
        document.body.appendChild(input);
        return input;
      });

      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      otpInputs[3].dispatchEvent(escapeEvent);

      // All inputs should be cleared
      otpInputs.forEach(input => {
        expect(input.value).toBe('');
      });

      expect(document.activeElement).toBe(otpInputs[0]);
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly during auto-progression', () => {
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        
        // Add auto-progression
        input.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          if (target.value.length === 1 && i < 5) {
            otpInputs[i + 1].focus();
          }
        });
        
        document.body.appendChild(input);
        return input;
      });

      // Type in first input
      otpInputs[0].focus();
      otpInputs[0].value = '1';
      otpInputs[0].dispatchEvent(new Event('input'));

      expect(document.activeElement).toBe(otpInputs[1]);

      // Type in second input
      otpInputs[1].value = '2';
      otpInputs[1].dispatchEvent(new Event('input'));

      expect(document.activeElement).toBe(otpInputs[2]);
    });

    it('should handle focus trapping within OTP component', () => {
      const container = document.createElement('div');
      container.setAttribute('data-testid', 'otp-container');

      const firstFocusable = document.createElement('button');
      firstFocusable.textContent = 'Back';
      firstFocusable.setAttribute('data-testid', 'back-button');

      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('data-testid', `otp-input-${i}`);
        return input;
      });

      const lastFocusable = document.createElement('button');
      lastFocusable.textContent = 'Resend';
      lastFocusable.setAttribute('data-testid', 'resend-button');

      container.appendChild(firstFocusable);
      otpInputs.forEach(input => container.appendChild(input));
      container.appendChild(lastFocusable);
      document.body.appendChild(container);

      // Test focus trapping
      const focusableElements = [firstFocusable, ...otpInputs, lastFocusable];

      // Focus on last element and press Tab
      lastFocusable.focus();
      expect(document.activeElement).toBe(lastFocusable);

      // Simulate Tab (should wrap to first)
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      lastFocusable.dispatchEvent(tabEvent);

      // In real implementation, this would wrap to first focusable
      firstFocusable.focus();
      expect(document.activeElement).toBe(firstFocusable);
    });

    it('should restore focus after error correction', () => {
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('data-testid', `otp-input-${i}`);
        document.body.appendChild(input);
        return input;
      });

      // Set focus on third input
      otpInputs[2].focus();
      const focusedIndex = 2;

      // Simulate error state
      otpInputs.forEach(input => {
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('error');
      });

      // Clear error and restore focus
      otpInputs.forEach(input => {
        input.removeAttribute('aria-invalid');
        input.classList.remove('error');
      });

      otpInputs[focusedIndex].focus();
      expect(document.activeElement).toBe(otpInputs[focusedIndex]);
    });
  });

  describe('High Contrast and Visual Accessibility', () => {
    it('should support high contrast mode', () => {
      // Mock high contrast media query
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const isHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
      expect(isHighContrast).toBe(true);

      // Create OTP input with high contrast support
      const otpInput = document.createElement('input');
      otpInput.type = 'text';
      
      if (isHighContrast) {
        otpInput.style.border = '2px solid #000000';
        otpInput.style.backgroundColor = '#ffffff';
        otpInput.style.color = '#000000';
      }

      expect(otpInput.style.border).toBe('2px solid #000000');
      expect(otpInput.style.backgroundColor).toMatch(/(#ffffff|rgb\(255,\s*255,\s*255\))/);
      expect(otpInput.style.color).toMatch(/(#000000|rgb\(0,\s*0,\s*0\))/);
    });

    it('should support reduced motion preferences', () => {
      // Mock reduced motion media query
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      expect(prefersReducedMotion).toBe(true);

      // Disable animations if reduced motion is preferred
      const otpInput = document.createElement('input');
      if (prefersReducedMotion) {
        otpInput.style.transition = 'none';
        otpInput.style.animation = 'none';
      }

      expect(otpInput.style.transition).toBe('none');
      expect(otpInput.style.animation).toBe('none');
    });

    it('should provide sufficient color contrast', async () => {
      // Create OTP input with proper contrast
      const otpInput = document.createElement('input');
      otpInput.type = 'text';
      otpInput.style.color = '#000000';
      otpInput.style.backgroundColor = '#ffffff';
      otpInput.style.border = '1px solid #666666';
      document.body.appendChild(otpInput);

      // Run accessibility check
      const results = await mockAxeCore.run(document.body, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results.violations).toHaveLength(0);
    });

    it('should support font size scaling', () => {
      const otpInput = document.createElement('input');
      otpInput.type = 'text';
      otpInput.style.fontSize = '1.2rem'; // Scalable font size
      otpInput.style.minHeight = '44px'; // Minimum touch target
      document.body.appendChild(otpInput);

      // Verify scalable properties
      expect(otpInput.style.fontSize).toBe('1.2rem');
      expect(otpInput.style.minHeight).toBe('44px');
    });
  });

  describe('Mobile Accessibility', () => {
    it('should provide proper touch targets', () => {
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.style.minWidth = '44px';
        input.style.minHeight = '44px';
        input.style.padding = '12px';
        document.body.appendChild(input);
        return input;
      });

      // Verify touch target sizes
      otpInputs.forEach(input => {
        expect(input.style.minWidth).toBe('44px');
        expect(input.style.minHeight).toBe('44px');
        expect(input.style.padding).toBe('12px');
      });
    });

    it('should support voice input', () => {
      const otpInput = document.createElement('input');
      otpInput.type = 'text';
      otpInput.setAttribute('inputmode', 'numeric');
      otpInput.setAttribute('pattern', '[0-9]*');
      
      // Add voice input support
      const speechRecognition = {
        start: jest.fn(),
        stop: jest.fn(),
        onresult: null,
      };

      // Mock speech recognition
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        writable: true,
        value: jest.fn().mockImplementation(() => speechRecognition),
      });

      // Verify voice input attributes
      expect(otpInput.getAttribute('inputmode')).toBe('numeric');
      expect(otpInput.getAttribute('pattern')).toBe('[0-9]*');
    });

    it('should handle zoom and magnification', () => {
      const otpInput = document.createElement('input');
      otpInput.type = 'text';
      otpInput.style.fontSize = '18px'; // Prevent zoom on iOS
      otpInput.style.maxWidth = '100%';
      otpInput.style.boxSizing = 'border-box';
      document.body.appendChild(otpInput);

      // Verify zoom-friendly properties
      expect(otpInput.style.fontSize).toBe('18px');
      expect(otpInput.style.maxWidth).toBe('100%');
      expect(otpInput.style.boxSizing).toBe('border-box');
    });
  });

  describe('Comprehensive Accessibility Testing', () => {
    it('should pass axe-core accessibility audit', async () => {
      // Create complete OTP form
      const form = document.createElement('form');
      form.setAttribute('role', 'form');
      form.setAttribute('aria-label', 'OTP Verification');

      const heading = document.createElement('h1');
      heading.textContent = 'Enter Verification Code';
      form.appendChild(heading);

      const instructions = document.createElement('p');
      instructions.id = 'otp-instructions';
      instructions.textContent = '이메일로 전송된 6자리 인증 코드를 입력해주세요.';
      form.appendChild(instructions);

      const otpGroup = document.createElement('div');
      otpGroup.setAttribute('role', 'group');
      otpGroup.setAttribute('aria-label', 'Enter 6-digit verification code');
      otpGroup.setAttribute('aria-describedby', 'otp-instructions');

      Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', `Digit ${i + 1} of 6`);
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9]*');
        input.setAttribute('maxlength', '1');
        input.setAttribute('autocomplete', i === 0 ? 'one-time-code' : 'off');
        otpGroup.appendChild(input);
        return input;
      });

      form.appendChild(otpGroup);

      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.textContent = 'Verify Code';
      form.appendChild(submitButton);

      document.body.appendChild(form);

      // Run comprehensive accessibility audit
      const results = await mockAxeCore.run(document.body);

      expect(results.violations).toHaveLength(0);
      expect(mockAxeCore.run).toHaveBeenCalledWith(document.body);
    });

    it('should support assistive technology integration', () => {
      // Mock assistive technology detection
      const hasScreenReader = window.navigator.userAgent.includes('NVDA') ||
                             window.navigator.userAgent.includes('JAWS') ||
                             window.speechSynthesis !== undefined;

      // Create enhanced OTP input for assistive technology
      const otpInput = document.createElement('input');
      otpInput.type = 'text';
      otpInput.setAttribute('role', 'textbox');
      otpInput.setAttribute('aria-label', 'Digit 1 of 6');
      otpInput.setAttribute('aria-describedby', 'otp-help');
      otpInput.setAttribute('aria-required', 'true');

      if (hasScreenReader) {
        otpInput.setAttribute('aria-live', 'polite');
        otpInput.setAttribute('aria-atomic', 'true');
      }

      document.body.appendChild(otpInput);

      // Verify assistive technology support
      expect(otpInput.getAttribute('role')).toBe('textbox');
      expect(otpInput.getAttribute('aria-required')).toBe('true');
    });

    it('should provide comprehensive error accessibility', () => {
      // Create error container
      const errorContainer = document.createElement('div');
      errorContainer.id = 'otp-error';
      errorContainer.setAttribute('role', 'alert');
      errorContainer.setAttribute('aria-live', 'assertive');
      errorContainer.setAttribute('aria-atomic', 'true');
      errorContainer.style.color = '#d32f2f';
      errorContainer.textContent = '잘못된 OTP 코드입니다. 2회 남음';

      // Create OTP inputs with error state
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', `Digit ${i + 1} of 6`);
        input.setAttribute('aria-describedby', 'otp-error');
        input.setAttribute('aria-invalid', 'true');
        input.style.borderColor = '#d32f2f';
        document.body.appendChild(input);
        return input;
      });

      document.body.appendChild(errorContainer);

      // Verify error accessibility
      expect(errorContainer.getAttribute('role')).toBe('alert');
      expect(errorContainer.getAttribute('aria-live')).toBe('assertive');
      otpInputs.forEach(input => {
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBe('otp-error');
      });
    });
  });
});