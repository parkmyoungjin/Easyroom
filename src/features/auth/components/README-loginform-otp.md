# LoginForm OTP Integration

## Overview

The LoginForm component has been updated to support OTP (One-Time Password) authentication flow while maintaining the existing UI/UX patterns. This implementation provides a seamless transition from email input to OTP verification.

## Features Implemented

### 1. Multi-Step Authentication Flow
- **Email Step**: User enters email address
- **OTP Step**: User enters 6-digit OTP code received via email
- **Success Step**: Confirmation of successful authentication

### 2. State Management
- Proper form state management using React Hook Form
- Separate forms for email and OTP verification
- Comprehensive error handling and loading states
- Timer management for OTP expiration (5 minutes)

### 3. User Experience Enhancements
- **Countdown Timer**: Shows remaining time for OTP validity
- **Resend Functionality**: Allows users to request new OTP after expiration
- **Back Navigation**: Users can return to email step to change email
- **Error Recovery**: Clear error messages with retry options
- **Attempt Tracking**: Limits OTP verification attempts (3 attempts)

### 4. PWA Compatibility
- **Offline Detection**: Uses `useOfflineStatus` hook to detect connectivity
- **Offline Messaging**: Clear warnings when offline during OTP operations
- **Disabled States**: Appropriate UI states when offline

### 5. Accessibility
- Proper ARIA labels and descriptions
- Screen reader compatible error announcements
- Keyboard navigation support
- Focus management between steps

## Component Structure

```typescript
// Authentication flow states
type AuthStep = 'email' | 'otp' | 'success';

// Key state variables
const [currentStep, setCurrentStep] = useState<AuthStep>('email');
const [userEmail, setUserEmail] = useState<string>('');
const [otpAttempts, setOtpAttempts] = useState(0);
const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
const [canResend, setCanResend] = useState(false);
```

## Integration with Existing Systems

### Authentication Hook
- Uses `requestOTP(email)` for sending OTP codes
- Uses `verifyOTP(email, otp)` for verification
- Maintains compatibility with existing `signInWithMagicLink` (for fallback)

### Validation Schemas
- Added `otpVerificationSchema` for OTP validation
- Maintains existing `magicLinkLoginSchema` for email validation
- 6-digit numeric OTP validation with proper error messages

### UI Components
- Integrates with existing `OTPInput` component
- Uses existing UI components (Card, Button, Alert, etc.)
- Maintains consistent styling and theming

## Error Handling

### OTP Request Errors
- **Unregistered Email**: "등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요."
- **Rate Limiting**: "보안을 위해 잠시 후 다시 시도해주세요. (약 30초 후)"
- **Network Issues**: "인터넷 연결을 확인해주세요."

### OTP Verification Errors
- **Invalid/Expired OTP**: "잘못된 OTP 코드입니다. (X회 남음)"
- **Max Attempts**: "OTP 인증 시도 횟수를 초과했습니다. 새로운 코드를 요청해주세요."
- **Network Issues**: "인터넷 연결을 확인해주세요."

## Timer Management

```typescript
// 5-minute countdown timer
useEffect(() => {
  let interval: NodeJS.Timeout;
  
  if (currentStep === 'otp' && timeRemaining > 0) {
    interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return () => {
    if (interval) clearInterval(interval);
  };
}, [currentStep, timeRemaining]);
```

## Testing

### Basic Functionality Tests
- Email input validation
- Step transitions (email → OTP → success)
- Back navigation
- Timer display
- Success state rendering

### Integration Tests
- Complete authentication flow
- Error handling scenarios
- Offline behavior
- Resend functionality
- State management

## Requirements Satisfied

This implementation addresses the following requirements from the specification:

- **2.1-2.5**: Complete OTP authentication flow with proper error handling
- **3.1-3.4**: PWA compatibility with offline detection and mobile optimization
- **4.1-4.5**: Intuitive OTP input interface with responsive design
- **5.1-5.5**: Migration compatibility (maintains existing patterns)
- **6.1-6.5**: Seamless integration with existing application features

## Usage

The LoginForm component is used exactly as before - no props changes required:

```tsx
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return <LoginForm />;
}
```

The component automatically handles the OTP flow when users submit their email address, providing a seamless transition from the existing magic link system to OTP authentication.