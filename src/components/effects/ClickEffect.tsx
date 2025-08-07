'use client';

import { useState, useCallback } from 'react';
import { Box } from '@mantine/core';

interface ClickEffectProps {
  children: React.ReactNode;
  effect?: 'ripple' | 'glow' | 'bounce' | 'particles';
  color?: string;
  duration?: number;
}

interface RippleState {
  x: number;
  y: number;
  id: number;
}

export default function ClickEffect({ 
  children, 
  effect = 'ripple', 
  color = '#4f46e5',
  duration = 600 
}: ClickEffectProps) {
  const [ripples, setRipples] = useState<RippleState[]>([]);
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (effect === 'ripple') {
      const newRipple: RippleState = {
        x,
        y,
        id: Date.now()
      };
      
      setRipples(prev => [...prev, newRipple]);
      
      // 애니메이션 완료 후 리플 제거
      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
      }, duration);
    }
    
    if (effect === 'bounce') {
      setIsPressed(true);
      setTimeout(() => setIsPressed(false), 150);
    }
  }, [effect, duration]);

  const getRippleStyles = () => ({
    position: 'absolute' as const,
    borderRadius: '50%',
    background: `${color}40`, // 40% opacity
    transform: 'scale(0)',
    animation: `ripple-animation ${duration}ms ease-out`,
    pointerEvents: 'none' as const,
    width: '20px',
    height: '20px',
    marginLeft: '-10px',
    marginTop: '-10px',
  });

  const getContainerStyles = () => {
    const baseStyles = {
      position: 'relative' as const,
      overflow: 'hidden' as const,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    };

    if (effect === 'glow' && isPressed) {
      return {
        ...baseStyles,
        boxShadow: `0 0 20px ${color}60`,
        transform: 'scale(1.02)',
      };
    }

    if (effect === 'bounce' && isPressed) {
      return {
        ...baseStyles,
        transform: 'scale(0.95)',
      };
    }

    return baseStyles;
  };

  return (
    <>
      {/* CSS 애니메이션 정의 */}
      <style jsx>{`
        @keyframes ripple-animation {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }
        
        @keyframes particle-burst {
          0% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: scale(0) rotate(180deg);
            opacity: 0;
          }
        }
      `}</style>
      
      <Box
        style={getContainerStyles()}
        onClick={handleClick}
        onMouseDown={() => effect === 'glow' && setIsPressed(true)}
        onMouseUp={() => effect === 'glow' && setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
      >
        {children}
        
        {/* 리플 효과 렌더링 */}
        {effect === 'ripple' && ripples.map(ripple => (
          <div
            key={ripple.id}
            style={{
              ...getRippleStyles(),
              left: ripple.x,
              top: ripple.y,
            }}
          />
        ))}
      </Box>
    </>
  );
}