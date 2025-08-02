'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface OTPInputProps {
  /** Number of OTP digits (default: 6) */
  length?: number
  /** Callback when OTP is complete */
  onComplete?: (otp: string) => void
  /** Callback when OTP value changes */
  onChange?: (otp: string) => void
  /** Current OTP value */
  value?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Whether the input is in loading state */
  loading?: boolean
  /** Error message to display */
  error?: string
  /** Placeholder character for empty fields */
  placeholder?: string
  /** Additional CSS classes */
  className?: string
  /** ARIA label for accessibility */
  'aria-label'?: string
  /** ARIA description for accessibility */
  'aria-describedby'?: string
}

const OTPInput = React.forwardRef<HTMLDivElement, OTPInputProps>(
  (
    {
      length = 6,
      onComplete,
      onChange,
      value = '',
      disabled = false,
      loading = false,
      error,
      placeholder = '',
      className,
      'aria-label': ariaLabel = 'Enter verification code',
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const [otp, setOtp] = React.useState<string[]>(
      Array(length).fill('').map((_, i) => value[i] || '')
    )
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

    // Update internal state when value prop changes
    React.useEffect(() => {
      const newOtp = Array(length).fill('').map((_, i) => value[i] || '')
      setOtp(newOtp)
    }, [value, length])

    // Handle input change
    const handleChange = React.useCallback(
      (index: number, inputValue: string) => {
        // Only allow numeric input
        const numericValue = inputValue.replace(/[^0-9]/g, '')
        
        if (numericValue.length > 1) {
          // Handle paste scenario
          const pastedDigits = numericValue.slice(0, length).split('')
          const newOtp = Array(length).fill('')
          
          pastedDigits.forEach((digit, i) => {
            if (i < length) {
              newOtp[i] = digit
            }
          })
          
          setOtp(newOtp)
          onChange?.(newOtp.join(''))
          
          // Focus on the next empty field or the last field
          const nextEmptyIndex = newOtp.findIndex(digit => digit === '')
          const focusIndex = nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex
          inputRefs.current[focusIndex]?.focus()
          
          // Check if OTP is complete
          if (newOtp.every(digit => digit !== '')) {
            onComplete?.(newOtp.join(''))
          }
          
          return
        }

        // Handle single digit input
        const newOtp = [...otp]
        newOtp[index] = numericValue
        setOtp(newOtp)
        onChange?.(newOtp.join(''))

        // Auto-focus next field if digit was entered
        if (numericValue && index < length - 1) {
          inputRefs.current[index + 1]?.focus()
        }

        // Check if OTP is complete
        if (newOtp.every(digit => digit !== '')) {
          onComplete?.(newOtp.join(''))
        }
      },
      [otp, length, onChange, onComplete]
    )

    // Handle key down events
    const handleKeyDown = React.useCallback(
      (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
          e.preventDefault()
          
          if (otp[index]) {
            // Clear current field
            const newOtp = [...otp]
            newOtp[index] = ''
            setOtp(newOtp)
            onChange?.(newOtp.join(''))
          } else if (index > 0) {
            // Move to previous field and clear it
            const newOtp = [...otp]
            newOtp[index - 1] = ''
            setOtp(newOtp)
            onChange?.(newOtp.join(''))
            inputRefs.current[index - 1]?.focus()
          }
        } else if (e.key === 'ArrowLeft' && index > 0) {
          e.preventDefault()
          inputRefs.current[index - 1]?.focus()
        } else if (e.key === 'ArrowRight' && index < length - 1) {
          e.preventDefault()
          inputRefs.current[index + 1]?.focus()
        } else if (e.key === 'Delete') {
          e.preventDefault()
          const newOtp = [...otp]
          newOtp[index] = ''
          setOtp(newOtp)
          onChange?.(newOtp.join(''))
        } else if (/^[0-9]$/.test(e.key)) {
          // Handle direct numeric input - don't prevent default, let the input handle it naturally
          // The onChange event will be triggered automatically
        }
      },
      [otp, length, onChange, handleChange]
    )

    // Handle paste event
    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text/plain')
        const numericData = pastedData.replace(/[^0-9]/g, '')
        
        if (numericData) {
          const digits = numericData.slice(0, length).split('')
          const newOtp = Array(length).fill('')
          
          digits.forEach((digit, i) => {
            if (i < length) {
              newOtp[i] = digit
            }
          })
          
          setOtp(newOtp)
          onChange?.(newOtp.join(''))
          
          // Focus on the next empty field or the last field
          const nextEmptyIndex = newOtp.findIndex(digit => digit === '')
          const focusIndex = nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex
          inputRefs.current[focusIndex]?.focus()
          
          // Check if OTP is complete
          if (newOtp.every(digit => digit !== '')) {
            onComplete?.(newOtp.join(''))
          }
        }
      },
      [length, onChange, onComplete]
    )

    // Handle focus events
    const handleFocus = React.useCallback((index: number) => {
      // Focus handling is managed by CSS focus states, no need for React state
    }, [])

    const handleBlur = React.useCallback(() => {
      // Blur handling is managed by CSS focus states, no need for React state
    }, [])

    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-2', className)}
        role="group"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        {...props}
      >
        <div className="flex gap-2 justify-center">
          {Array.from({ length }, (_, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={otp[index]}
              placeholder={placeholder}
              disabled={disabled || loading}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              className={cn(
                // Base styles
                'w-12 h-12 text-center text-lg font-semibold',
                'border rounded-md transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                
                // Mobile optimizations
                'sm:w-14 sm:h-14 sm:text-xl',
                
                // State-based styles
                {
                  // Default state
                  'border-input bg-background text-foreground': !error && !disabled,
                  'focus:ring-ring focus:border-ring': !error && !disabled,
                  
                  // Error state
                  'border-destructive bg-destructive/5 text-destructive': error,
                  'focus:ring-destructive focus:border-destructive': error,
                  
                  // Disabled state
                  'border-muted bg-muted text-muted-foreground cursor-not-allowed': disabled,
                  
                  // Loading state
                  'opacity-50 cursor-wait': loading,
                  
                  // Filled state
                  'border-primary bg-primary/5': otp[index] && !error && !disabled,
                }
              )}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              onPaste={handlePaste}
              aria-label={`Digit ${index + 1} of ${length}`}
              aria-invalid={!!error}
            />
          ))}
        </div>
        
        {error && (
          <p
            className="text-sm font-medium text-destructive text-center"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

OTPInput.displayName = 'OTPInput'

export { OTPInput }