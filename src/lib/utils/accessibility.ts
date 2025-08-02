/**
 * Accessibility Utilities for OTP Authentication
 * Provides screen reader support and accessibility features
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

/**
 * Announces a message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') {
    return;
  }

  // Find existing live region or create one
  let liveRegion = document.getElementById('sr-live-region');
  
  if (!liveRegion) {
    liveRegion = createAriaLiveRegion();
  }

  // Update the live region attributes and content
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.textContent = message;

  // Clear the message after a delay to allow for re-announcements
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = '';
    }
  }, 1000);
}

/**
 * Creates an ARIA live region for screen reader announcements
 */
export function createAriaLiveRegion(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('Document is not available');
  }

  // Remove existing live region if it exists
  const existing = document.getElementById('sr-live-region');
  if (existing) {
    existing.remove();
  }

  const liveRegion = document.createElement('div');
  liveRegion.id = 'sr-live-region';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.setAttribute('aria-relevant', 'text');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-10000px';
  liveRegion.style.width = '1px';
  liveRegion.style.height = '1px';
  liveRegion.style.overflow = 'hidden';

  document.body.appendChild(liveRegion);
  return liveRegion;
}

/**
 * Sets focus on an element with an announcement
 */
export function setFocusWithAnnouncement(element: HTMLElement, announcement?: string): void {
  if (!element) {
    return;
  }

  // Set focus
  element.focus();

  // Make announcement if provided
  if (announcement) {
    announceToScreenReader(announcement);
  }
}

/**
 * Creates accessible OTP input labels
 */
export function createOTPInputLabels(length: number = 6): string[] {
  return Array.from({ length }, (_, i) => `Digit ${i + 1} of ${length}`);
}

/**
 * Generates accessible error messages for OTP
 */
export function generateOTPErrorMessage(
  error: string,
  attemptsRemaining?: number,
  canResend?: boolean
): string {
  let message = error;

  if (attemptsRemaining !== undefined && attemptsRemaining > 0) {
    message += ` ${attemptsRemaining}회 남음`;
  }

  if (canResend) {
    message += '. 새로운 코드를 요청할 수 있습니다';
  }

  return message;
}

/**
 * Generates accessible success messages for OTP
 */
export function generateOTPSuccessMessage(email?: string): string {
  let message = '인증이 완료되었습니다';
  
  if (email) {
    message = `${email} 계정으로 인증이 완료되었습니다`;
  }

  return message;
}

/**
 * Generates accessible timer announcements
 */
export function generateTimerAnnouncement(timeRemaining: number): string {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초 후 만료됩니다`;
  } else if (seconds > 30) {
    return `${seconds}초 후 만료됩니다`;
  } else if (seconds > 0) {
    return `${seconds}초 후 만료됩니다. 곧 만료됩니다`;
  } else {
    return '코드가 만료되었습니다. 새로운 코드를 요청해주세요';
  }
}

/**
 * Handles keyboard navigation for OTP inputs
 */
export function handleOTPKeyboardNavigation(
  event: KeyboardEvent,
  currentIndex: number,
  inputs: HTMLInputElement[]
): void {
  const { key } = event;
  const currentInput = inputs[currentIndex];

  switch (key) {
    case 'ArrowRight':
      event.preventDefault();
      if (currentIndex < inputs.length - 1) {
        setFocusWithAnnouncement(inputs[currentIndex + 1]);
      }
      break;

    case 'ArrowLeft':
      event.preventDefault();
      if (currentIndex > 0) {
        setFocusWithAnnouncement(inputs[currentIndex - 1]);
      }
      break;

    case 'Backspace':
      if (currentInput.value === '' && currentIndex > 0) {
        event.preventDefault();
        const previousInput = inputs[currentIndex - 1];
        previousInput.value = '';
        setFocusWithAnnouncement(previousInput);
      }
      break;

    case 'Delete':
      event.preventDefault();
      currentInput.value = '';
      break;

    case 'Home':
      event.preventDefault();
      setFocusWithAnnouncement(inputs[0]);
      break;

    case 'End':
      event.preventDefault();
      setFocusWithAnnouncement(inputs[inputs.length - 1]);
      break;

    case 'Escape':
      event.preventDefault();
      // Clear all inputs and focus first
      inputs.forEach(input => input.value = '');
      setFocusWithAnnouncement(inputs[0], '모든 입력이 지워졌습니다');
      break;
  }
}

/**
 * Manages focus trap for OTP component
 */
export function createFocusTrap(container: HTMLElement): () => void {
  if (!container) {
    return () => {};
  }

  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleTabKey = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') {
      return;
    }

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTabKey);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Checks if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Checks if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Gets accessible color scheme preference
 */
export function getColorSchemePreference(): 'light' | 'dark' | 'no-preference' {
  if (typeof window === 'undefined') {
    return 'no-preference';
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return 'no-preference';
}

/**
 * Applies accessibility enhancements to OTP inputs
 */
export function enhanceOTPAccessibility(inputs: HTMLInputElement[]): void {
  inputs.forEach((input, index) => {
    // Set ARIA labels
    input.setAttribute('aria-label', `Digit ${index + 1} of ${inputs.length}`);
    
    // Set input mode for mobile keyboards
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]*');
    
    // Set autocomplete for first input only
    input.setAttribute('autocomplete', index === 0 ? 'one-time-code' : 'off');
    
    // Ensure proper font size to prevent zoom on iOS
    if (input.style.fontSize === '' || parseFloat(input.style.fontSize) < 16) {
      input.style.fontSize = '16px';
    }
    
    // Ensure minimum touch target size
    if (!input.style.minHeight) {
      input.style.minHeight = '44px';
    }
    if (!input.style.minWidth) {
      input.style.minWidth = '44px';
    }
  });
}

/**
 * Creates accessible loading state announcement
 */
export function announceLoadingState(isLoading: boolean, action: string): void {
  if (isLoading) {
    announceToScreenReader(`${action}을 처리하고 있습니다. 잠시만 기다려주세요.`);
  }
}

/**
 * Creates accessible form validation messages
 */
export function announceFormValidation(
  field: string,
  isValid: boolean,
  errorMessage?: string
): void {
  if (isValid) {
    announceToScreenReader(`${field} 입력이 올바릅니다.`, 'polite');
  } else if (errorMessage) {
    announceToScreenReader(`${field} 오류: ${errorMessage}`, 'assertive');
  }
}

/**
 * Manages ARIA live region updates for dynamic content
 */
export class AriaLiveManager {
  private liveRegion: HTMLElement | null = null;
  private updateTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.liveRegion = createAriaLiveRegion();
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.liveRegion) {
      return;
    }

    // Clear any pending updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // Update live region
    this.liveRegion.setAttribute('aria-live', priority);
    this.liveRegion.textContent = message;

    // Clear after delay to allow re-announcements
    this.updateTimeout = setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = '';
      }
    }, 1000);
  }

  destroy(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    if (this.liveRegion) {
      this.liveRegion.remove();
      this.liveRegion = null;
    }
  }
}