# OTP Input Component

A comprehensive, accessible, and mobile-optimized OTP (One-Time Password) input component built for React applications.

## Features

### Core Functionality
- ✅ **6-digit numeric input** with individual input fields
- ✅ **Automatic focus progression** when entering digits
- ✅ **Backspace navigation** to previous fields
- ✅ **Arrow key navigation** between fields
- ✅ **Paste support** for complete or partial OTP codes
- ✅ **Auto-completion** when all digits are entered

### Mobile Optimizations
- ✅ **Numeric keypad** activation on mobile devices
- ✅ **Browser auto-fill** support with `autocomplete="one-time-code"`
- ✅ **Touch-friendly** input fields with proper sizing
- ✅ **Responsive design** for all device sizes

### Accessibility
- ✅ **ARIA labels** for screen readers
- ✅ **Keyboard navigation** support
- ✅ **Focus management** with proper tab order
- ✅ **Error announcements** with `aria-live` regions
- ✅ **High contrast** mode compatibility

### Error Handling & States
- ✅ **Error display** with visual and textual feedback
- ✅ **Loading state** with disabled inputs
- ✅ **Disabled state** support
- ✅ **Validation** for numeric-only input

## Usage

### Basic Usage

```tsx
import { OTPInput } from '@/components/ui/otp-input'

function MyComponent() {
  const [otp, setOtp] = useState('')

  const handleOTPComplete = (value: string) => {
    console.log('OTP entered:', value)
    // Verify the OTP
  }

  return (
    <OTPInput
      length={6}
      value={otp}
      onChange={setOtp}
      onComplete={handleOTPComplete}
    />
  )
}
```

### With Error Handling

```tsx
import { OTPInput } from '@/components/ui/otp-input'

function LoginForm() {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleVerifyOTP = async (value: string) => {
    setIsLoading(true)
    setError('')

    try {
      await verifyOTPCode(value)
      // Success - redirect or update UI
    } catch (err) {
      setError('Invalid verification code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OTPInput
      length={6}
      value={otp}
      onChange={setOtp}
      onComplete={handleVerifyOTP}
      error={error}
      loading={isLoading}
      aria-label="Enter verification code sent to your email"
    />
  )
}
```

### Custom Length

```tsx
<OTPInput
  length={4}
  value={otp}
  onChange={setOtp}
  onComplete={handleComplete}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `length` | `number` | `6` | Number of OTP digits |
| `value` | `string` | `''` | Current OTP value |
| `onChange` | `(otp: string) => void` | - | Callback when OTP changes |
| `onComplete` | `(otp: string) => void` | - | Callback when OTP is complete |
| `disabled` | `boolean` | `false` | Whether inputs are disabled |
| `loading` | `boolean` | `false` | Whether in loading state |
| `error` | `string` | - | Error message to display |
| `placeholder` | `string` | `''` | Placeholder for empty fields |
| `className` | `string` | - | Additional CSS classes |
| `aria-label` | `string` | `'Enter verification code'` | ARIA label for accessibility |
| `aria-describedby` | `string` | - | ARIA description reference |

## Keyboard Interactions

| Key | Action |
|-----|--------|
| `0-9` | Enter digit and move to next field |
| `Backspace` | Clear current field or move to previous |
| `Delete` | Clear current field |
| `ArrowLeft` | Move to previous field |
| `ArrowRight` | Move to next field |
| `Ctrl+V` / `Cmd+V` | Paste OTP code |

## Mobile Features

### Numeric Keypad
The component automatically triggers the numeric keypad on mobile devices using:
- `inputMode="numeric"`
- `pattern="[0-9]*"`

### Auto-fill Support
The first input field includes `autocomplete="one-time-code"` to support browser and SMS auto-fill functionality.

### Touch Optimization
- Larger touch targets on mobile devices
- Proper spacing between input fields
- Responsive sizing with `sm:` breakpoints

## Accessibility Features

### Screen Reader Support
- Each input has a descriptive `aria-label`
- Error messages use `aria-live="polite"` for announcements
- Proper `role="group"` for the input container

### Keyboard Navigation
- Full keyboard accessibility
- Logical tab order
- Focus management during input

### Visual Accessibility
- High contrast mode support
- Clear focus indicators
- Error state visual feedback

## Styling

The component uses Tailwind CSS classes and follows the existing design system patterns:

### CSS Classes Used
- `border-input` - Default border color
- `border-destructive` - Error state border
- `border-primary` - Filled state border
- `focus:ring-ring` - Focus ring color
- `text-destructive` - Error text color

### Responsive Design
- Base size: `w-12 h-12` (48x48px)
- Mobile size: `sm:w-14 sm:h-14` (56x56px)
- Text size: `text-lg sm:text-xl`

## Testing

The component includes comprehensive unit tests covering:

### Rendering Tests
- Correct number of input fields
- Initial value display
- Error state rendering
- Disabled/loading states

### Interaction Tests
- Numeric input validation
- Auto-focus progression
- Keyboard navigation
- Paste functionality

### Accessibility Tests
- ARIA attributes
- Screen reader compatibility
- Keyboard navigation

### Mobile Tests
- Numeric keypad activation
- Auto-fill attributes
- Touch interactions

## Browser Support

- ✅ Chrome/Chromium (including mobile)
- ✅ Firefox (including mobile)
- ✅ Safari (including iOS)
- ✅ Edge
- ✅ Samsung Internet
- ✅ PWA environments

## Requirements Satisfied

This component satisfies the following requirements from the specification:

### Requirement 4.1 - Individual Input Fields
- ✅ 6 individual input fields with automatic focus progression

### Requirement 4.2 - Focus Navigation
- ✅ Automatic focus progression on digit entry
- ✅ Backspace navigation to previous field

### Requirement 4.3 - Paste Handling
- ✅ Automatic distribution of pasted digits across fields

### Requirement 4.4 - Mobile Support
- ✅ Numeric keypad activation
- ✅ Browser auto-fill with `autocomplete="one-time-code"`

### Requirement 4.5 - Responsive Design
- ✅ Fully responsive on mobile, tablet, and desktop
- ✅ Accessibility features for all devices

### Requirement 3.1 - PWA Compatibility
- ✅ Works in PWA environments
- ✅ Mobile-optimized interactions

### Requirement 3.3 - Auto-fill Support
- ✅ Browser auto-fill functionality
- ✅ SMS code auto-fill on supported devices

## Performance

- **Bundle Size**: Minimal impact (~2KB gzipped)
- **Rendering**: Optimized with React.useCallback for event handlers
- **Memory**: Efficient state management with minimal re-renders
- **Accessibility**: No performance impact from accessibility features

## Future Enhancements

Potential future improvements:
- Custom validation patterns
- Animation support for state transitions
- Theme customization options
- Integration with form libraries (React Hook Form, Formik)