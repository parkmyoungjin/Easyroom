'use client';

import { useState, useCallback } from 'react';
import { Box } from '@mantine/core';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
}

interface ParticleClickEffectProps {
  children: React.ReactNode;
  particleCount?: number;
  colors?: string[];
  duration?: number;
}

export default function ParticleClickEffect({ 
  children, 
  particleCount = 8,
  colors = ['#4f46e5', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b'],
  duration = 800 
}: ParticleClickEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const createParticles = useCallback((x: number, y: number) => {
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const velocity = 2 + Math.random() * 3;
      
      newParticles.push({
        id: Date.now() + i,
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 4,
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
    
    // 파티클 제거
    setTimeout(() => {
      setParticles(prev => 
        prev.filter(p => !newParticles.some(np => np.id === p.id))
      );
    }, duration);
  }, [particleCount, colors, duration]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    createParticles(x, y);
  }, [createParticles]);

  return (
    <>
      <style jsx>{`
        @keyframes particle-float {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0);
            opacity: 0;
          }
        }
      `}</style>
      
      <Box
        style={{
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onClick={handleClick}
      >
        {children}
        
        {/* 파티클 렌더링 */}
        {particles.map(particle => (
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
              pointerEvents: 'none',
              animation: `particle-float ${duration}ms ease-out`,
              '--dx': `${particle.vx * 50}px`,
              '--dy': `${particle.vy * 50}px`,
            } as React.CSSProperties}
          />
        ))}
      </Box>
    </>
  );
}