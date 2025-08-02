# OTP Authentication Hook Extension

This document describes the OTP (One-Time Password) functionality added to the `useAuth` hook as part of the Supabase OTP authentication migration.

## Overview

The `useAuth` hook has been extended with two new methods for OTP-based authentication:
- `requestOTP(email: string)` - Requests a 6-digit OTP code to be sent to the user's email
- `verifyOTP(email: string, token: string)` - Verifies the OTP code and authenticates the user

## New Methods

### `requestOTP(email: string): Promise<void>`

Requests a 6-digit OTP code to be sent to the specified email address.

**Parameters:**
- `email` - The user's email address (must be registered)

**Behavior:**
- Checks network connectivity before making the request
- Only works for existing users (shouldCreateUser: false)
- Handles rate limiting and provides user-friendly error messages
- Throws descriptive errors for various failure scenarios

**Error Handling:**
- `"인증 서비스가 준비되지 않았습니다"` - Supabase client not ready
- `"인터넷 연결을 확인해주세요"` - Offline or network issues
- `"등록되지 않은 이메일입니다"` - User not found
- `"너무 많은 요청이 발생했습니다"` - Rate limiting
- `"올바른 이메일 주소를 입력해주세요"` - Invalid email format

### `verifyOTP(email: string, token: string): Promise<AuthResponse>`

Verifies the OTP code and authenticates the user.

**Parameters:**
- `email` - The user's email address
- `token` - The 6-digit OTP code (must be exactly 6 numeric digits)

**Returns:**
- `AuthResponse` - Contains session and user data on success

**Behavior:**
- Validates OTP format (6 digits) before making the request
- Checks network connectivity
- Creates a valid user session on successful verification
- AuthContext automatically updates the authentication state

**Error Handling:**
- `"인증 서비스가 준비되지 않았습니다"` - Supabase client not ready
- `"인터넷 연결을 확인해주세요"` - Offline or network issues
- `"OTP 코드는 6자리 숫자여야 합니다"` - Invalid format
- `"잘못된 OTP 코드이거나 만료된 코드입니다"` - Invalid/expired OTP
- `"너무 많은 시도가 발생했습니다"` - Rate limiting
- `"등록되지 않은 이메일입니다"` - User not found
- `"로그인에 실패했습니다"` - Missing session data

## Usage Example

```typescript
import { useAuth } from '@/hooks/useAuth';

function LoginComponent() {
  const { requestOTP, verifyOTP, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');

  const handleRequestOTP = async () => {
    try {
      await requestOTP(email);
      setStep('otp');
      // Show success message: "OTP 코드가 이메일로 전송되었습니다"
    } catch (error) {
      // Handle error with user-friendly message
      console.error('OTP request failed:', error.message);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      const result = await verifyOTP(email, otp);
      // Authentication successful - user will be redirected automatically
      console.log('Login successful:', result);
    } catch (error) {
      // Handle error with user-friendly message
      console.error('OTP verification failed:', error.message);
    }
  };

  // ... render UI
}
```

## PWA Considerations

The OTP functionality is designed to work seamlessly in PWA environments:

- **Offline Detection**: Both methods check network connectivity and provide appropriate messaging
- **Network Error Handling**: Distinguishes between network errors and authentication errors
- **User-Friendly Messages**: All error messages are in Korean and provide clear guidance
- **Retry Logic**: Users can retry operations when connectivity is restored

## Backward Compatibility

All existing authentication methods remain unchanged:
- `signInWithMagicLink()` - Still available for magic link authentication
- `signUpDirectly()` - User registration process unchanged
- `signOut()` - Logout functionality unchanged
- `resendMagicLink()` - Magic link resend functionality unchanged

## Security Features

- **6-Digit Validation**: OTP codes must be exactly 6 numeric digits
- **Rate Limiting**: Built-in protection against brute force attacks
- **Expiration**: OTP codes expire after 5 minutes (handled by Supabase)
- **Single Use**: Each OTP code can only be used once
- **Network Security**: All requests require active internet connection

## Testing

Comprehensive test coverage includes:
- Unit tests for OTP logic (`useAuth-otp.test.ts`)
- Integration tests with actual hook (`useAuth-integration.test.ts`)
- Error scenario testing
- Network connectivity testing
- PWA-specific scenarios
- Backward compatibility verification

## Migration Notes

This implementation is part of the migration from Magic Link to OTP authentication:
- Both systems can coexist during the transition period
- Existing user sessions remain valid
- No changes to user data or permissions
- Gradual rollout strategy supported

## Requirements Fulfilled

This implementation addresses the following requirements from the specification:
- **2.1-2.5**: Complete OTP authentication flow
- **3.2**: PWA offline detection and messaging
- **4.1-4.5**: User-friendly error handling and validation
- **5.1-5.5**: Migration compatibility
- **6.1-6.5**: Integration with existing system