import React, { useEffect, useRef } from 'react';
import { getSkinPack } from '../data/skinManifests';
import { BgFxMode, SkinParticlePreset, ThemeId } from '../types/game';

interface SkinAtmosphereProps {
  themeId: ThemeId;
  bgFxMode: BgFxMode;
  dimDuringPlay?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vRot: number;
  alpha: number;
  phase: number;
  kind: 'primary' | 'secondary';
}

function initParticles(preset: SkinParticlePreset, w: number, h: number): Particle[] {
  const count = preset === 'sakura' ? 42 : preset === 'snow' ? 68 : preset === 'krampus_ash' ? 64 : 0;
  const list: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const isSecondary = i % 3 === 0;
    if (preset === 'sakura') {
      list.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 18 + Math.random() * 26,
        vy: 22 + Math.random() * 34,
        size: isSecondary ? 9 + Math.random() * 6 : 5 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 2.4,
        alpha: isSecondary ? 0.52 : 0.78,
        phase: Math.random() * Math.PI * 2,
        kind: isSecondary ? 'secondary' : 'primary',
      });
    } else if (preset === 'snow') {
      list.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 14,
        vy: isSecondary ? 16 + Math.random() * 18 : 26 + Math.random() * 30,
        size: isSecondary ? 4.5 + Math.random() * 4.5 : 1.6 + Math.random() * 2.4,
        rot: 0,
        vRot: 0,
        alpha: isSecondary ? 0.28 : 0.75,
        phase: Math.random() * Math.PI * 2,
        kind: isSecondary ? 'secondary' : 'primary',
      });
    } else if (preset === 'krampus_ash') {
      const isEmber = i % 2 === 0;
      list.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 22,
        vy: isEmber ? -(38 + Math.random() * 55) : 18 + Math.random() * 22,
        size: isEmber ? 1.8 + Math.random() * 2.8 : 2.0 + Math.random() * 3.0,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 1.8,
        alpha: isEmber ? 0.85 : 0.45,
        phase: Math.random() * Math.PI * 2,
        kind: isEmber ? 'primary' : 'secondary',
      });
    }
  }
  return list;
}

export const SkinAtmosphere: React.FC<SkinAtmosphereProps> = React.memo(
  ({ themeId, bgFxMode, dimDuringPlay = false }) => {
    const skin = getSkinPack(themeId);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (skin.particlePreset === 'none' || bgFxMode === 'minimal') {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let width = window.innerWidth;
      let height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const resize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      window.addEventListener('resize', resize);

      const particles = initParticles(skin.particlePreset, width, height);
      let lastTime = performance.now();
      let rafId = 0;

      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        const t = now * 0.001;

        ctx.clearRect(0, 0, width, height);
        const masterOpacity = dimDuringPlay ? 0.42 : bgFxMode === 'clean' ? 0.55 : 0.92;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const sway = Math.sin(t * 1.4 + p.phase) * (skin.particlePreset === 'snow' ? 14 : 20);
          p.x += (p.vx + sway) * dt;
          p.y += p.vy * dt;
          p.rot += p.vRot * dt;

          if (p.x > width + 24) p.x = -20;
          if (p.x < -24) p.x = width + 20;
          if (p.vy > 0 && p.y > height + 24) {
            p.y = -20;
            p.x = Math.random() * width;
          } else if (p.vy < 0 && p.y < -24) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }

          ctx.save();
          ctx.globalAlpha = p.alpha * masterOpacity;

          if (skin.particlePreset === 'sakura') {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            const petalW = p.size;
            const petalH = p.size * 0.62;
            const grad = ctx.createLinearGradient(-petalW, 0, petalW, 0);
            grad.addColorStop(0, p.kind === 'secondary' ? '#fff1f2' : '#f472b6');
            grad.addColorStop(1, '#fbcfe8');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(-petalW, 0);
            ctx.quadraticCurveTo(0, -petalH, petalW, 0);
            ctx.quadraticCurveTo(0, petalH, -petalW, 0);
            ctx.fill();
          } else if (skin.particlePreset === 'snow') {
            if (p.kind === 'secondary') {
              const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2);
              g.addColorStop(0, 'rgba(254, 243, 199, 0.85)');
              g.addColorStop(1, 'rgba(254, 243, 199, 0)');
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = '#f0f9ff';
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (skin.particlePreset === 'krampus_ash') {
            if (p.kind === 'primary') {
              // Rising crimson-gold inferno ember
              const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.8);
              g.addColorStop(0, '#fef08a');
              g.addColorStop(0.45, '#ef4444');
              g.addColorStop(1, 'rgba(220, 38, 38, 0)');
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * 2.8, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Falling charred slate ash flake
              ctx.translate(p.x, p.y);
              ctx.rotate(p.rot);
              ctx.fillStyle = 'rgba(203, 213, 225, 0.6)';
              ctx.fillRect(-p.size * 0.6, -p.size * 0.35, p.size * 1.2, p.size * 0.7);
            }
          }

          ctx.restore();
        }

        rafId = window.requestAnimationFrame(tick);
      };

      rafId = window.requestAnimationFrame(tick);
      return () => {
        window.cancelAnimationFrame(rafId);
        window.removeEventListener('resize', resize);
      };
    }, [bgFxMode, dimDuringPlay, skin.particlePreset]);

    const cornerOverlays = skin.overlays.filter(
      (o) =>
        o.slot === 'topLeft' ||
        o.slot === 'topRight' ||
        o.slot === 'bottomLeft' ||
        o.slot === 'bottomRight',
    );

    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[5] overflow-hidden"
      >
        {/* Corner Bespoke Illustrated Ornaments */}
        {skin.isFullTransformation &&
          cornerOverlays.map((ov) => {
            const posClass =
              ov.slot === 'topLeft'
                ? '-left-10 -top-10 sm:-left-8 sm:-top-8'
                : ov.slot === 'topRight'
                ? '-right-10 -top-10 sm:-right-8 sm:-top-8'
                : ov.slot === 'bottomLeft'
                ? '-bottom-10 -left-10 sm:-bottom-8 sm:-left-8'
                : '-bottom-10 -right-10 sm:-bottom-8 sm:-right-8';

            const scaleX = (ov.flipX ? -1 : 1) * (ov.scale ?? 1);
            const scaleY = ov.scale ?? 1;

            return (
              <div
                key={ov.id}
                className={`pointer-events-none absolute ${posClass} h-44 w-44 sm:h-64 sm:w-64 transition-opacity duration-300`}
                style={{
                  opacity: dimDuringPlay ? ov.opacity * 0.32 : ov.opacity,
                  mixBlendMode: ov.blendMode || 'screen',
                  maskImage: 'radial-gradient(circle at center, black 48%, transparent 78%)',
                  WebkitMaskImage: 'radial-gradient(circle at center, black 48%, transparent 78%)',
                }}
              >
                <img
                  src={ov.imageUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain select-none"
                  style={{
                    transform: `rotate(${ov.rotateDeg ?? 0}deg) scale(${scaleX}, ${scaleY})`,
                  }}
                />
              </div>
            );
          })}

        {/* Atmospheric 60fps Particle Canvas */}
        {skin.particlePreset !== 'none' && (
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        )}
      </div>
    );
  },
);

export const SkinBladeTrim: React.FC<{ themeId: ThemeId }> = ({ themeId }) => {
  const skin = getSkinPack(themeId);
  if (skin.trimStyle === 'none') return null;

  if (skin.trimStyle === 'sakura_blossom') {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, rgba(250,204,21,0.75), #f472b6, rgba(251,207,232,0.9), transparent)',
        }}
      />
    );
  }

  if (skin.trimStyle === 'snow_cap') {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-[2px] h-[5px] rounded-b-sm opacity-90"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(224,242,254,0.92) 48%, rgba(254,243,199,0.75) 82%, transparent 100%)',
          boxShadow: '0 2px 6px rgba(186, 230, 253, 0.35)',
        }}
      />
    );
  }

  // krampus_iron
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
      style={{
        background:
          'linear-gradient(90deg, #dc2626 0%, #f59e0b 45%, rgba(226,232,240,0.45) 85%, transparent 100%)',
        boxShadow: '0 0 10px rgba(220, 38, 38, 0.55)',
      }}
    />
  );
};
