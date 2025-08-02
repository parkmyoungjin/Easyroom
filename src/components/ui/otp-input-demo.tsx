'use client'

import * as React from 'react'
import { OTPInput } from './otp-input'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'

/**
 * Demo component showcasing OTP Input functionality
 * This is for development and testing purposes
 */
export function OTPInputDemo() {
  const [otp, setOtp] = React.useState('')
  const [error, setError] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isComplete, setIsComplete] = React.useState(false)

  const handleOTPChange = (value: string) => {
    setOtp(value)
    setError('')
    setIsComplete(false)
  }

  const handleOTPComplete = (value: string) => {
    setIsComplete(true)
    console.log('OTP Complete:', value)
  }

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError('Please enter a complete 6-digit code')
      return
    }

    setIsLoading(true)
    setError('')

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Simulate validation (accept 123456 as valid)
    if (otp === '123456') {
      setError('')
      alert('OTP verified successfully!')
    } else {
      setError('Invalid verification code. Please try again.')
    }

    setIsLoading(false)
  }

  const handleClear = () => {
    setOtp('')
    setError('')
    setIsComplete(false)
    setIsLoading(false)
  }

  const handleSetError = () => {
    setError('Invalid verification code. Please try again.')
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>OTP Input Demo</CardTitle>
          <CardDescription>
            Enter verification code sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OTPInput
            length={6}
            value={otp}
            onChange={handleOTPChange}
            onComplete={handleOTPComplete}
            error={error}
            loading={isLoading}
            disabled={isLoading}
            aria-label="Enter 6-digit verification code"
          />

          <div className="flex gap-2">
            <Button 
              onClick={handleVerify}
              disabled={otp.length !== 6 || isLoading}
              className="flex-1"
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleClear}
              disabled={isLoading}
            >
              Clear
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Current OTP:</strong> {otp || 'None'}</p>
            <p><strong>Is Complete:</strong> {isComplete ? 'Yes' : 'No'}</p>
            <p><strong>Test Code:</strong> 123456 (will pass validation)</p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setOtp('123456')}
              disabled={isLoading}
            >
              Fill Test Code
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleSetError}
              disabled={isLoading}
            >
              Show Error
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Features Demonstrated</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>6-digit numeric input with auto-focus progression</li>
            <li>Paste support (try pasting "123456")</li>
            <li>Backspace navigation between fields</li>
            <li>Arrow key navigation</li>
            <li>Mobile numeric keypad (on mobile devices)</li>
            <li>Error state display</li>
            <li>Loading/disabled states</li>
            <li>Accessibility features (ARIA labels, screen reader support)</li>
            <li>Responsive design</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}