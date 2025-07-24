'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { closeWindow, notifyParentWindow, cleanupBeforeClose, WindowCloseResult } from '@/lib/utils/window-close'
import { 
  getErrorMessage, 
  SUCCESS_MESSAGES, 
  WINDOW_CLOSE_MESSAGES, 
  getBrowserSpecificCloseMessage,
  AuthErrorType 
} from '@/lib/utils/error-messages'

type AuthCallbackState = 'loading' | 'success' | 'error' | 'closing';

interface AuthCallbackStatus {
  state: AuthCallbackState;
  message: string;
  canClose: boolean;
  autoCloseAttempted: boolean;
  closeResult?: WindowCloseResult;
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<AuthCallbackStatus>({
    state: 'loading',
    message: '이메일 인증을 처리하고 있습니다...',
    canClose: false,
    autoCloseAttempted: false
  })

  // 창 닫기 시도 함수
  const attemptWindowClose = useCallback(async () => {
    setStatus(prev => ({
      ...prev,
      state: 'closing',
      message: '인증이 완료되었습니다. 이 창을 닫는 중...',
      autoCloseAttempted: true
    }));

    // 부모 창에 인증 완료 알림
    notifyParentWindow({
      type: 'EMAIL_VERIFICATION_COMPLETE',
      success: true,
      timestamp: new Date().toISOString()
    });

    // 창 닫기 시도
    const closeResult = await closeWindow({
      delay: 1500, // 성공 메시지를 1.5초간 표시
      maxRetries: 3,
      retryInterval: 500
    });

    setStatus(prev => ({
      ...prev,
      closeResult,
      canClose: !closeResult.success, // 자동 닫기 실패 시에만 수동 닫기 버튼 표시
      message: closeResult.success 
        ? '창이 자동으로 닫힙니다...' 
        : '자동으로 창을 닫을 수 없습니다. 아래 버튼을 클릭하여 수동으로 닫아주세요.'
    }));

    return closeResult;
  }, []);

  // 수동 창 닫기 함수
  const handleManualClose = useCallback(() => {
    cleanupBeforeClose();
    
    // 여러 방법으로 창 닫기 시도
    try {
      window.close();
    } catch (error) {
      console.warn('Manual window.close() failed:', error);
      
      // 대체 방법들
      try {
        if (window.opener) {
          window.opener.focus();
        }
        window.location.href = 'about:blank';
      } catch (fallbackError) {
        console.warn('Fallback close methods failed:', fallbackError);
        
        // 최후의 수단: 사용자에게 직접 안내
        alert('이 창을 수동으로 닫아주세요. (Ctrl+W 또는 탭 닫기 버튼 클릭)');
      }
    }
  }, []);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = await createClient()
        
        // URL 해시에서 인증 토큰 처리
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          const errorInfo = getErrorMessage(error);
          
          setStatus({
            state: 'error',
            message: errorInfo.message,
            canClose: true,
            autoCloseAttempted: false
          })
          
          // 부모 창에 에러 알림
          notifyParentWindow({
            type: 'EMAIL_VERIFICATION_ERROR',
            error: error.message,
            errorType: errorInfo.title,
            timestamp: new Date().toISOString()
          });
          return
        }

        if (data.session?.user) {
          const user = data.session.user
          
          // 이메일 인증이 완료되었는지 확인
          if (user.email_confirmed_at) {
            console.log('이메일 인증 완료 확인됨:', user.email_confirmed_at);
            
            // 사용자 프로필 생성 처리
            try {
              const { data: userData } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single();

              if (userData) {
                console.log('사용자 프로필이 이미 데이터베이스에 존재합니다.');
              } else {
                console.log('사용자 프로필 생성을 위해 RPC 함수 호출...');
                const metadata = user.user_metadata;
                
                if (metadata?.fullName && metadata?.department) {
                  const { error: rpcError } = await supabase.rpc('create_user_profile', {
                    user_auth_id: user.id,
                    user_email: user.email,
                    user_name: metadata.fullName,
                    user_department: metadata.department
                  });

                  if (rpcError) {
                    console.warn('사용자 프로필 생성 실패:', rpcError);
                  } else {
                    console.log('사용자 프로필이 성공적으로 생성되었습니다.');
                  }
                } else {
                  console.warn('사용자 메타데이터가 불완전합니다:', metadata);
                }
              }
            } catch (profileError) {
              console.warn('프로필 처리 중 오류:', profileError);
              // 프로필 생성 실패해도 인증은 완료된 것으로 처리
            }
            
            // 인증 완료 후 세션을 즉시 종료하여 리디렉션 방지
            try {
              await supabase.auth.signOut();
              console.log('인증 세션이 정리되었습니다.');
            } catch (signOutError) {
              console.warn('세션 정리 실패:', signOutError);
              // 세션 정리 실패해도 계속 진행
            }
            
            // 성공 상태로 변경
            setStatus({
              state: 'success',
              message: '이메일 인증이 완료되었습니다! 이제 로그인할 수 있습니다.',
              canClose: false,
              autoCloseAttempted: false
            });
            
            // 자동 창 닫기 시도
            setTimeout(async () => {
              await attemptWindowClose();
            }, 1000); // 1초 후 창 닫기 시도
            
          } else {
            setStatus({
              state: 'error',
              message: '이메일 인증이 아직 완료되지 않았습니다.',
              canClose: true,
              autoCloseAttempted: false
            });
            
            notifyParentWindow({
              type: 'EMAIL_VERIFICATION_INCOMPLETE',
              timestamp: new Date().toISOString()
            });
          }
        } else {
          setStatus({
            state: 'error',
            message: '인증 세션을 찾을 수 없습니다.',
            canClose: true,
            autoCloseAttempted: false
          });
          
          notifyParentWindow({
            type: 'EMAIL_VERIFICATION_NO_SESSION',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Auth callback processing error:', error)
        setStatus({
          state: 'error',
          message: '인증 처리 중 예상치 못한 오류가 발생했습니다.',
          canClose: true,
          autoCloseAttempted: false
        });
        
        notifyParentWindow({
          type: 'EMAIL_VERIFICATION_ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }

    handleAuthCallback()
  }, [attemptWindowClose])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            이메일 인증 처리 중
          </h2>
          
          {status.state === 'loading' && (
            <div className="mt-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-sm text-gray-600">
                {status.message}
              </p>
            </div>
          )}
          
          {status.state === 'success' && (
            <div className="mt-8">
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">
                      {status.message}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      이 창을 닫고 원래 페이지에서 로그인해주세요.
                    </p>
                  </div>
                </div>
              </div>
              
              {status.canClose && (
                <div className="mt-4">
                  <button
                    onClick={handleManualClose}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    창 닫기
                  </button>
                </div>
              )}
            </div>
          )}
          
          {status.state === 'closing' && (
            <div className="mt-8">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-800">
                      {status.message}
                    </p>
                    {status.closeResult && !status.closeResult.success && (
                      <p className="text-xs text-blue-600 mt-1">
                        자동 닫기에 실패했습니다. 수동으로 닫아주세요.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {status.canClose && (
                <div className="mt-4">
                  <button
                    onClick={handleManualClose}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    수동으로 창 닫기
                  </button>
                  
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    {getBrowserSpecificCloseMessage()}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {status.state === 'error' && (
            <div className="mt-8">
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      {status.message}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      이 창을 닫고 다시 시도해주세요.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                {status.canClose && (
                  <button
                    onClick={handleManualClose}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    창 닫기
                  </button>
                )}
                
                <button
                  onClick={() => window.location.reload()}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  다시 시도
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}