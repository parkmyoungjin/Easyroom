'use client';

import { motion } from 'framer-motion';
import { useMantineColorScheme } from '@mantine/core';

/**
 * 인증 로딩 UI - 단순하고 안정적인 스피너 (다크모드 지원)
 * AuthGatekeeper에서 분리된 순수 UI 컴포넌트
 */
export const AuthLoadingUI = () => {
    const { colorScheme } = useMantineColorScheme();
    
    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{
                background: colorScheme === 'dark' 
                    ? 'linear-gradient(135deg, #1a1b23 0%, #2d3748 100%)'
                    : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
            }}
        >
            <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                {/* 회전하는 스피너 */}
                <motion.div
                    className="w-8 h-8 rounded-full mx-auto mb-4"
                    style={{
                        border: '2px solid transparent',
                        borderTopColor: colorScheme === 'dark' ? '#60a5fa' : '#2563eb',
                        borderRightColor: colorScheme === 'dark' ? '#60a5fa' : '#2563eb'
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />

                {/* 인증 확인 중 텍스트 */}
                <motion.p
                    className="text-lg"
                    style={{
                        color: colorScheme === 'dark' ? '#94a3b8' : '#64748b'
                    }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                    인증 확인 중...
                </motion.p>
            </motion.div>
        </div>
    );
};