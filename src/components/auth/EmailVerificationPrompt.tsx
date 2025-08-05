'use client'

import { useState } from 'react'
import { Button, Card } from '@mantine/core'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Mail, RefreshCw } from 'lucide-react'

interface EmailVerificationPromptProps {
  email: string
  onClose?: () => void
}

export function EmailVerificationPrompt({ email, onClose }: EmailVerificationPromptProps) {
  const [isResending, setIsResending] = useState(false)

  const { resendMagicLink } = useAuth()

  const handleResendEmail = async () => {
    setIsResending(true)
    
    try {
      await resendMagicLink(email)
      
      toast.success('Magic Link 재발송 완료', {
        description: 'Magic Link가 다시 발송되었습니다. 이메일을 확인해주세요.',
      })
    } catch (error) {
      console.error('Email resend error:', error)
      
      toast.error('Magic Link 재발송 실패', {
        description: error instanceof Error ? error.message : 'Magic Link 재발송 중 오류가 발생했습니다.',
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Card withBorder className="w-full max-w-md mx-auto">
      <Card.Section withBorder inheritPadding py="xs" className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <h3 className="text-xl font-semibold">이메일 인증이 필요합니다</h3>
        <p className="text-sm text-gray-600">
          회원가입이 완료되었습니다. 이메일 인증을 완료해주세요.
        </p>
      </Card.Section>
      
      <Card.Section inheritPadding py="md" className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>{email}</strong>로 인증 이메일이 발송되었습니다.
          </p>
          <p className="text-xs text-blue-600 mt-2">
            이메일의 인증 링크를 클릭하여 계정을 활성화해주세요.
          </p>
        </div>
        
        <div className="space-y-3">
          <Button
            onClick={handleResendEmail}
            disabled={isResending}
            variant="outline"
            className="w-full"
          >
            {isResending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                재발송 중...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                인증 이메일 재발송
              </>
            )}
          </Button>
          
          {onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full"
            >
              닫기
            </Button>
          )}
        </div>
        
        <div className="text-center">
          <p className="text-xs text-gray-500">
            이메일이 도착하지 않았나요? 스팸 폴더도 확인해보세요.
          </p>
        </div>
      </Card.Section>
    </Card>
  )
}