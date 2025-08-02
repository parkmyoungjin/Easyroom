import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OTPInput } from '@/components/ui/otp-input'

describe('OTPInput', () => {
  const defaultProps = {
    length: 6,
    onComplete: jest.fn(),
    onChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render correct number of input fields', () => {
      render(<OTPInput {...defaultProps} />)
      
      const inputs = screen.getAllByRole('textbox')
      expect(inputs).toHaveLength(6)
    })

    it('should render custom length', () => {
      render(<OTPInput {...defaultProps} length={4} />)
      
      const inputs = screen.getAllByRole('textbox')
      expect(inputs).toHaveLength(4)
    })

    it('should render with initial value', () => {
      render(<OTPInput {...defaultProps} value="123456" />)
      
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[0].value).toBe('1')
      expect(inputs[1].value).toBe('2')
      expect(inputs[2].value).toBe('3')
      expect(inputs[3].value).toBe('4')
      expect(inputs[4].value).toBe('5')
      expect(inputs[5].value).toBe('6')
    })

    it('should render with partial value', () => {
      render(<OTPInput {...defaultProps} value="123" />)
      
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[0].value).toBe('1')
      expect(inputs[1].value).toBe('2')
      expect(inputs[2].value).toBe('3')
      expect(inputs[3].value).toBe('')
      expect(inputs[4].value).toBe('')
      expect(inputs[5].value).toBe('')
    })

    it('should render error message', () => {
      render(<OTPInput {...defaultProps} error="Invalid code" />)
      
      expect(screen.getByText('Invalid code')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should apply error styles to inputs', () => {
      render(<OTPInput {...defaultProps} error="Invalid code" />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toHaveClass('border-destructive')
      })
    })

    it('should render disabled state', () => {
      render(<OTPInput {...defaultProps} disabled />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toBeDisabled()
        expect(input).toHaveClass('cursor-not-allowed')
      })
    })

    it('should render loading state', () => {
      render(<OTPInput {...defaultProps} loading />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toBeDisabled()
        expect(input).toHaveClass('opacity-50')
      })
    })
  })

  describe('Input Behavior', () => {
    it('should only accept numeric input', async () => {
      const user = userEvent.setup()
      render(<OTPInput {...defaultProps} />)
      
      const firstInput = screen.getAllByRole('textbox')[0]
      
      await user.type(firstInput, 'a1b2c3')
      
      expect(firstInput).toHaveValue('1')
    })

    it('should auto-focus next field on digit entry', async () => {
      const user = userEvent.setup()
      render(<OTPInput {...defaultProps} />)
      
      const inputs = screen.getAllByRole('textbox')
      
      await user.type(inputs[0], '1')
      
      expect(inputs[1]).toHaveFocus()
    })

    it('should call onChange on each digit entry', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      render(<OTPInput {...defaultProps} onChange={onChange} />)
      
      const firstInput = screen.getAllByRole('textbox')[0]
      
      await user.type(firstInput, '1')
      
      expect(onChange).toHaveBeenCalledWith('1')
    })

    it('should call onComplete when all digits are entered', async () => {
      const user = userEvent.setup()
      const onComplete = jest.fn()
      render(<OTPInput {...defaultProps} onComplete={onComplete} />)
      
      const inputs = screen.getAllByRole('textbox')
      
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], (i + 1).toString())
      }
      
      expect(onComplete).toHaveBeenCalledWith('123456')
    })

    it('should not call onComplete for partial input', async () => {
      const user = userEvent.setup()
      const onComplete = jest.fn()
      render(<OTPInput {...defaultProps} onComplete={onComplete} />)
      
      const inputs = screen.getAllByRole('textbox')
      
      await user.type(inputs[0], '1')
      await user.type(inputs[1], '2')
      await user.type(inputs[2], '3')
      
      expect(onComplete).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should handle backspace to clear current field', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      render(<OTPInput {...defaultProps} value="123456" onChange={onChange} />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs[2].focus()
      
      await user.keyboard('{Backspace}')
      
      expect(onChange).toHaveBeenCalledWith('12456')
    })

    it('should handle backspace to move to previous field when current is empty', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      render(<OTPInput {...defaultProps} value="12" onChange={onChange} />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs[2].focus()
      
      await user.keyboard('{Backspace}')
      
      expect(inputs[1]).toHaveFocus()
      expect(onChange).toHaveBeenCalledWith('1')
    })

    it('should handle arrow key navigation', async () => {
      const user = userEvent.setup()
      render(<OTPInput {...defaultProps} />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs[2].focus()
      
      await user.keyboard('{ArrowLeft}')
      expect(inputs[1]).toHaveFocus()
      
      await user.keyboard('{ArrowRight}')
      expect(inputs[2]).toHaveFocus()
    })

    it('should handle delete key', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      render(<OTPInput {...defaultProps} value="123456" onChange={onChange} />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs[2].focus()
      
      await user.keyboard('{Delete}')
      
      expect(onChange).toHaveBeenCalledWith('12456')
    })

    it('should handle direct numeric key input', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      render(<OTPInput {...defaultProps} onChange={onChange} />)
      
      const inputs = screen.getAllByRole('textbox')
      
      // Use type instead of keyboard for direct input
      await user.type(inputs[0], '5')
      
      expect(onChange).toHaveBeenCalledWith('5')
      expect(inputs[1]).toHaveFocus()
    })
  })

  describe('Paste Functionality', () => {
    it('should handle paste of complete OTP', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const onComplete = jest.fn()
      render(<OTPInput {...defaultProps} onChange={onChange} onComplete={onComplete} />)
      
      const firstInput = screen.getAllByRole('textbox')[0]
      firstInput.focus()
      
      await user.paste('123456')
      
      expect(onChange).toHaveBeenCalledWith('123456')
      expect(onComplete).toHaveBeenCalledWith('123456')
      
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[0].value).toBe('1')
      expect(inputs[1].value).toBe('2')
      expect(inputs[2].value).toBe('3')
      expect(inputs[3].value).toBe('4')
      expect(inputs[4].value).toBe('5')
      expect(inputs[5].value).toBe('6')
    })

    it('should handle paste of partial OTP', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const onComplete = jest.fn()
      render(<OTPInput {...defaultProps} onChange={onChange} onComplete={onComplete} />)
      
      const firstInput = screen.getAllByRole('textbox')[0]
      firstInput.focus()
      
      await user.paste('123')
      
      expect(onChange).toHaveBeenCalledWith('123')
      expect(onComplete).not.toHaveBeenCalled()
      
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[0].value).toBe('1')
      expect(inputs[1].value).toBe('2')
      expect(inputs[2].value).toBe('3')
      expect(inputs[3].value).toBe('')
    })

    it('should handle paste with non-numeric characters', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      render(<OTPInput {...defaultProps} onChange={onChange} />)
      
      const firstInput = screen.getAllByRole('textbox')[0]
      firstInput.focus()
      
      await user.paste('1a2b3c')
      
      expect(onChange).toHaveBeenCalledWith('123')
      
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[0].value).toBe('1')
      expect(inputs[1].value).toBe('2')
      expect(inputs[2].value).toBe('3')
    })

    it('should handle paste longer than OTP length', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      render(<OTPInput {...defaultProps} onChange={onChange} />)
      
      const firstInput = screen.getAllByRole('textbox')[0]
      firstInput.focus()
      
      await user.paste('123456789')
      
      expect(onChange).toHaveBeenCalledWith('123456')
      
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[5].value).toBe('6')
    })
  })

  describe('Focus Management', () => {
    it('should focus on next empty field after paste', async () => {
      const user = userEvent.setup()
      render(<OTPInput {...defaultProps} />)
      
      const firstInput = screen.getAllByRole('textbox')[0]
      const inputs = screen.getAllByRole('textbox')
      
      firstInput.focus()
      await user.paste('123')
      
      expect(inputs[3]).toHaveFocus()
    })

    it('should focus on last field when paste completes OTP', async () => {
      const user = userEvent.setup()
      render(<OTPInput {...defaultProps} />)
      
      const firstInput = screen.getAllByRole('textbox')[0]
      const inputs = screen.getAllByRole('textbox')
      
      firstInput.focus()
      await user.paste('123456')
      
      expect(inputs[5]).toHaveFocus()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<OTPInput {...defaultProps} aria-label="Enter verification code" />)
      
      const group = screen.getByRole('group')
      expect(group).toHaveAttribute('aria-label', 'Enter verification code')
      
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach((input, index) => {
        expect(input).toHaveAttribute('aria-label', `Digit ${index + 1} of 6`)
      })
    })

    it('should have proper ARIA attributes for error state', () => {
      render(<OTPInput {...defaultProps} error="Invalid code" />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toHaveAttribute('aria-invalid', 'true')
      })
      
      const errorMessage = screen.getByRole('alert')
      expect(errorMessage).toHaveAttribute('aria-live', 'polite')
    })

    it('should support custom aria-describedby', () => {
      render(<OTPInput {...defaultProps} aria-describedby="otp-help" />)
      
      const group = screen.getByRole('group')
      expect(group).toHaveAttribute('aria-describedby', 'otp-help')
    })
  })

  describe('Mobile Optimizations', () => {
    it('should have numeric input mode', () => {
      render(<OTPInput {...defaultProps} />)
      
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toHaveAttribute('inputMode', 'numeric')
        expect(input).toHaveAttribute('pattern', '[0-9]*')
      })
    })

    it('should have autocomplete attribute on first input', () => {
      render(<OTPInput {...defaultProps} />)
      
      const inputs = screen.getAllByRole('textbox')
      expect(inputs[0]).toHaveAttribute('autoComplete', 'one-time-code')
      
      // Other inputs should not have autocomplete
      for (let i = 1; i < inputs.length; i++) {
        expect(inputs[i]).toHaveAttribute('autoComplete', 'off')
      }
    })
  })

  describe('Value Updates', () => {
    it('should update when value prop changes', () => {
      const { rerender } = render(<OTPInput {...defaultProps} value="123" />)
      
      let inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[0].value).toBe('1')
      expect(inputs[1].value).toBe('2')
      expect(inputs[2].value).toBe('3')
      
      rerender(<OTPInput {...defaultProps} value="456789" />)
      
      inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[0].value).toBe('4')
      expect(inputs[1].value).toBe('5')
      expect(inputs[2].value).toBe('6')
      expect(inputs[3].value).toBe('7')
      expect(inputs[4].value).toBe('8')
      expect(inputs[5].value).toBe('9')
    })

    it('should clear when value prop is empty', () => {
      const { rerender } = render(<OTPInput {...defaultProps} value="123456" />)
      
      let inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      expect(inputs[0].value).toBe('1')
      
      rerender(<OTPInput {...defaultProps} value="" />)
      
      inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      inputs.forEach(input => {
        expect(input.value).toBe('')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid input changes', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      render(<OTPInput {...defaultProps} onChange={onChange} />)
      
      const inputs = screen.getAllByRole('textbox')
      
      // Rapidly type in multiple fields
      await user.type(inputs[0], '1')
      await user.type(inputs[1], '2')
      await user.type(inputs[2], '3')
      
      expect(onChange).toHaveBeenCalledTimes(3)
      expect(onChange).toHaveBeenLastCalledWith('123')
    })

    it('should handle focus events properly', async () => {
      const user = userEvent.setup()
      render(<OTPInput {...defaultProps} />)
      
      const inputs = screen.getAllByRole('textbox')
      
      await user.click(inputs[2])
      expect(inputs[2]).toHaveFocus()
      
      await user.click(inputs[4])
      expect(inputs[4]).toHaveFocus()
    })

    it('should not break with invalid length', () => {
      render(<OTPInput {...defaultProps} length={0} />)
      
      const inputs = screen.queryAllByRole('textbox')
      expect(inputs).toHaveLength(0)
    })
  })
})