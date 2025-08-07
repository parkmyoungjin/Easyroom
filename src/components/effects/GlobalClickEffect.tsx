'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ClickPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

interface GlobalClickEffectProps {
  effect?: 'ripple' | 'particles' | 'both';
  colors?: string[];
  particleCount?: number;
  duration?: number;
  enabled?: boolean;
}

export default function GlobalClickEffect({
  effect = 'both',
  colors = ['#4f46e5', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
  particleCount = 6,
  duration = 800,
  enabled = true
}: GlobalClickEffectProps) {
  const [clickPoints, setClickPoints] = useState<ClickPoint[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const createParticles = useCallback((x: number, y: number) => {
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const velocity = 1.5 + Math.random() * 2;
      
      newParticles.push({
        id: Date.now() + i + Math.random(),
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
        life: 1,
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  }, [particleCount, colors]);

  const handleGlobalClick = useCallback((event: MouseEvent | TouchEvent) => {
    if (!enabled) return;

    let clientX: number, clientY: number;
    
    if (event instanceof TouchEvent) {
      if (event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if (event.changedTouches.length > 0) {
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
      } else {
        return;
      }
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const newClick: ClickPoint = {
      id: Date.now(),
      x: clientX,
      y: clientY,
      timestamp: Date.now()
    };

    // 리플 효과
    if (effect === 'ripple' || effect === 'both') {
      setClickPoints(prev => [...prev, newClick]);
      
      setTimeout(() => {
        setClickPoints(prev => prev.filter(click => click.id !== newClick.id));
      }, duration);
    }

    // 파티클 효과
    if (effect === 'particles' || effect === 'both') {
      createParticles(clientX, clientY);
    }
  }, [enabled, effect, duration, createParticles]);

  // 파티클 애니메이션 업데이트
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev => 
        prev.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.1, // 중력 효과
          life: particle.life - 0.02,
        })).filter(particle => particle.life > 0)
      );
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [particles.length]);

  // 전역 이벤트 리스너 등록
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('touchend', handleGlobalClick);

    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('touchend', handleGlobalClick);
    };
  }, [handleGlobalClick, enabled]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* CSS 애니메이션 정의 */}
      <style jsx global>{`
        @keyframes global-ripple {
          0% {
            transform: scale(0);
            opacity: 0.8;
          }
          50% {
            opacity: 0.4;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }
      `}</style>

      {/* 전역 효과 컨테이너 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 9999,
          overflow: 'hidden',
        }}
      >
        {/* 리플 효과 */}
        {(effect === 'ripple' || effect === 'both') && clickPoints.map(click => (
          <div
            key={click.id}
            style={{
              position: 'absolute',
              left: click.x - 10,
              top: click.y - 10,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${colors[0]}40, transparent)`,
              border: `2px solid ${colors[0]}60`,
              animation: `global-ripple ${duration}ms ease-out`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* 파티클 효과 */}
        {(effect === 'particles' || effect === 'both') && particles.map(particle => (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              left: particle.x - particle.size / 2,
              top: particle.y - particle.size / 2,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: '50%',
              opacity: particle.life,
              pointerEvents: 'none',
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}40`,
            }}
          />
        ))}
      </div>
    </>,
    document.body
  );
}