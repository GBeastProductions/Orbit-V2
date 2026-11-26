import React, { useEffect, useRef, useState } from 'react';
import { Flag, Pause, Play, RotateCcw, Shield, Trash2, X } from 'lucide-react';
import { CHASSIS_THEMES, NEEDLE_TOLERANCE, WAVE_MODES } from '../data/catalog';
import { formatTimeSec, signedAngleDiff, TAU } from '../engine/beatmap';
import {
  BgFxMode,
  GamePhase,
  HazardMine,
  HitEffect,
  HitErrorTick,
  NextCuePreview,
  PortalPair,
  PracticeCheckpoint,
  ReplayInputEvent,
  ShockwaveRing,
  SongSection,
  SongSectionCue,
  TargetSector,
  ThemeId,
  TutorialLesson,
  WaveModeId,
} from '../types/game';
import { OrbIcon } from './OrbIcon';

export interface CanvasRenderState {
  phase: GamePhase;
  spinnerAngle: number;
  direction: 1 | -1;
  angularSpeed: number;
  waveModeId: WaveModeId;
  targets: TargetSector[];
  hazards: HazardMine[];
  portal: PortalPair | null;
  hitEffects: HitEffect[];
  hitErrorTicks: HitErrorTick[];
  hubStatusText: string;
  hubStatusColor: string | null;
  hubStatusTimer: number;
  shakeX: number;
  missDegrees: string;
  missNearestEdge: number;
  missSignedSpan: number;
  missReasonText?: string;
  dialVisualAlpha: number;
  bassEnergy: number;
  spectrumBins: Float32Array;
  beatPulse: number;
  streak: number;
  songProgressRatio: number;
  songSections: SongSectionCue[];
  songSection: SongSection;
  songTime: number;
  lessonSlowActive: boolean;
  activeLesson: TutorialLesson | null;
  flashlightActive: boolean;
  rxModActive?: boolean;
  waitingForCue: boolean;
  breakRemainingSec: number;
  overdriveCharge: number;
  overdriveActive: boolean;
  overdriveTimeLeft: number;
  nextCuePreview: NextCuePreview | null;
  shockwaves: ShockwaveRing[];
  isPracticeMode: boolean;
  isReplayMode: boolean;
}

interface OrbitStageProps {
  renderStateRef: React.MutableRefObject<CanvasRenderState>;
  phase: GamePhase;
  themeId: ThemeId;
  bgFxMode: BgFxMode;
  allowPointerTap: boolean;
  onTriggerPress: (eventTimeMs?: number) => void;
  onTriggerRelease: (eventTimeMs?: number) => void;
  score: number;
  hp: number;
  streak: number;
  bestScore: number;
  accuracyPct: number;
  unbankedOrbs: number;
  streakMult: number;
  totalMult: number;
  modeName: string;
  modeColor: string;
  shields: number;
  noFailActive: boolean;
  isTutorialRun: boolean;
  tutorialLives: number;
  activeLesson: TutorialLesson | null;
  showTutorialCompleteStripe: boolean;
  promptHint: string;
  trigger1Code: string;
  trigger1Label: string;
  trigger2Code: string;
  trigger2Label: string;
  onSkipTutorial: () => void;
  // Overdrive HUD
  overdriveCharge: number;
  overdriveActive: boolean;
  overdriveTimeLeft: number;
  // Practice Mode
  isPracticeMode: boolean;
  practiceSpeed: number;
  practiceStartSec: number;
  practiceCheckpoints: PracticeCheckpoint[];
  songDurationSec: number;
  songTime: number;
  onDropCheckpoint: () => void;
  onRemoveCheckpoint: () => void;
  onRespawnCheckpoint: () => void;
  onChangePracticeSpeed: (speed: number) => void;
  onPracticeSeek: (sec: number) => void;
  onExitPractice: () => void;
  // Replay Theater
  isReplayMode: boolean;
  replayPaused: boolean;
  replaySpeed: number;
  replayEvents: ReplayInputEvent[];
  replayLabel: string;
  replayLastClickLabel: string;
  onToggleReplayPause: () => void;
  onChangeReplaySpeed: (speed: number) => void;
  onReplaySeek: (sec: number) => void;
  onExitReplay: () => void;
}

function getComboLabel(streak: number): string {
  if (streak >= 100) return 'Apex Overdrive';
  if (streak >= 50) return 'Harmonic Fever';
  if (streak >= 25) return 'Disco Surge';
  return 'Combo';
}

export const OrbitStage: React.FC<OrbitStageProps> = ({
  renderStateRef,
  phase,
  themeId,
  bgFxMode,
  allowPointerTap,
  onTriggerPress,
  onTriggerRelease,
  score,
  hp,
  streak,
  bestScore,
  accuracyPct,
  unbankedOrbs,
  streakMult,
  totalMult,
  modeName,
  modeColor,
  shields,
  noFailActive,
  isTutorialRun,
  tutorialLives,
  activeLesson,
  showTutorialCompleteStripe,
  promptHint,
  trigger1Code,
  trigger1Label,
  trigger2Code,
  trigger2Label,
  onSkipTutorial,
  overdriveCharge,
  overdriveActive,
  overdriveTimeLeft,
  isPracticeMode,
  practiceSpeed,
  practiceStartSec,
  practiceCheckpoints,
  songDurationSec,
  songTime,
  onDropCheckpoint,
  onRemoveCheckpoint,
  onRespawnCheckpoint,
  onChangePracticeSpeed,
  onPracticeSeek,
  onExitPractice,
  isReplayMode,
  replayPaused,
  replaySpeed,
  replayEvents,
  replayLabel,
  replayLastClickLabel,
  onToggleReplayPause,
  onChangeReplaySpeed,
  onReplaySeek,
  onExitReplay,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 520, height: 420 });
  const [pressedKey, setPressedKey] = useState<'k1' | 'k2' | null>(null);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === trigger1Code) setPressedKey('k1');
      else if (e.code === trigger2Code) setPressedKey('k2');
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === trigger1Code || e.code === trigger2Code) setPressedKey(null);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [trigger1Code, trigger2Code]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: rect.width, height: rect.height };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);

    let rafId = 0;
    const drawFrame = () => {
      const st = renderStateRef.current;
      const { width, height } = sizeRef.current;
      const cx = width / 2 + st.shakeX;
      const cy = height / 2;
      const maxR = Math.min(width / 2, height / 2) * 0.9;
      const theme = CHASSIS_THEMES[themeId] || CHASSIS_THEMES.tokyo_pink;

      ctx.clearRect(0, 0, width, height);

      const streakTier = st.streak >= 100 ? 3 : st.streak >= 50 ? 2 : st.streak >= 25 ? 1 : 0;

      // Ambient disco radar rings
      if (bgFxMode === 'dynamic') {
        const energy = st.bassEnergy;
        const isDrop = st.songSection === 'DROP';
        for (let rIdx = 0; rIdx < 2; rIdx++) {
          const baseExpand = maxR * (0.98 + rIdx * 0.14) + energy * (10 + rIdx * 6);
          ctx.beginPath();
          ctx.arc(cx, cy, baseExpand, 0, TAU);
          ctx.strokeStyle = `rgba(${theme.bgAccentRgb}, ${(isDrop ? 0.24 : 0.11) * (1 - rIdx * 0.3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      let isIlluminated = false;
      if (st.phase === 'PLAYING') {
        for (let i = 0; i < st.targets.length; i++) {
          const t = st.targets[i];
          if (t.isFeverSpinner || t.isHolding) {
            isIlluminated = true;
            break;
          }
          if (Math.abs(signedAngleDiff(st.spinnerAngle, t.angle)) <= t.halfWidth + NEEDLE_TOLERANCE) {
            isIlluminated = true;
            break;
          }
        }
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, st.dialVisualAlpha));

      const beatExpand = st.beatPulse * 2.0;
      const bezelOuterR = maxR * 0.78 + beatExpand;
      const trackRadius = maxR * 0.62;
      const trackWidth = Math.max(22, maxR * 0.135);
      const innerRadius = trackRadius - trackWidth / 2;
      const outerRadius = trackRadius + trackWidth / 2;

      // Radial frequency spectrum
      if (bgFxMode === 'dynamic' && st.spectrumBins.length > 0) {
        const binCount = st.spectrumBins.length;
        const specBaseR = bezelOuterR + 17;
        for (let i = 0; i < binCount; i++) {
          const angle = -Math.PI / 2 + (i * TAU) / binCount;
          const mag = st.spectrumBins[i] || 0;
          const barLen = 2 + mag * Math.max(12, maxR * 0.12);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * specBaseR, cy + Math.sin(angle) * specBaseR);
          ctx.lineTo(
            cx + Math.cos(angle) * (specBaseR + barLen),
            cy + Math.sin(angle) * (specBaseR + barLen),
          );
          ctx.strokeStyle =
            mag > 0.65
              ? streakTier >= 2
                ? '#fbbf24'
                : theme.bright
              : `rgba(${theme.bgAccentRgb}, ${(0.28 + mag * 0.5).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Outer Song Progress Ring Arc
      const progR = bezelOuterR + 11;
      ctx.beginPath();
      ctx.arc(cx, cy, progR, 0, TAU);
      ctx.strokeStyle = '#1b2230';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (st.songProgressRatio > 0.002) {
        ctx.beginPath();
        ctx.arc(cx, cy, progR, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, st.songProgressRatio));
        ctx.strokeStyle = streakTier >= 2 ? '#fbbf24' : theme.bright;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      for (let s = 0; s < st.songSections.length; s++) {
        const cueAngle = -Math.PI / 2 + TAU * st.songSections[s].startPct;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(cueAngle) * (progR - 3), cy + Math.sin(cueAngle) * (progR - 3));
        ctx.lineTo(cx + Math.cos(cueAngle) * (progR + 3), cy + Math.sin(cueAngle) * (progR + 3));
        ctx.strokeStyle = '#f3f4f6';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }

      // 60 Perimeter Bezel Ticks
      for (let i = 0; i < 60; i++) {
        const angle = (i * TAU) / 60;
        const isMajor = i % 5 === 0;
        const rStart = bezelOuterR + 1.5;
        const rEnd = bezelOuterR + (isMajor ? 8 : 3.5);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * rStart, cy + Math.sin(angle) * rStart);
        ctx.lineTo(cx + Math.cos(angle) * rEnd, cy + Math.sin(angle) * rEnd);
        ctx.strokeStyle = isMajor
          ? streakTier === 3
            ? '#ffffff'
            : streakTier === 2
            ? '#fbbf24'
            : streakTier === 1
            ? theme.bright
            : '#4b5563'
          : '#1f2430';
        ctx.lineWidth = isMajor ? 1.5 : 1;
        ctx.stroke();
      }

      // Radial Shockwave Rings (Beat 0 / Perfects / Overdrive Ignite)
      if (bgFxMode !== 'minimal' && st.shockwaves.length > 0) {
        for (let i = 0; i < st.shockwaves.length; i++) {
          const sw = st.shockwaves[i];
          const prog = 1 - sw.timer / Math.max(0.05, sw.duration);
          const alpha = Math.max(0, (1 - prog) * 0.55);
          const rRing = bezelOuterR + 4 + prog * maxR * 0.28;
          ctx.save();
          ctx.globalAlpha *= alpha;
          ctx.beginPath();
          ctx.arc(cx, cy, rRing, 0, TAU);
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = 2.2 * (1 - prog * 0.5);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Overdrive Anime Fire Aura around Bezel (10s 2x Orbs Surge!)
      if (st.overdriveActive) {
        const animT = performance.now() * 0.001;
        const layers = [
          { baseR: bezelOuterR + 10, amp: 8.5, freq: 9, speed: 11, col: 'rgba(239, 68, 68, 0.52)', lw: 5 },
          { baseR: bezelOuterR + 6, amp: 6.2, freq: 13, speed: -15, col: 'rgba(249, 115, 22, 0.72)', lw: 3.5 },
          { baseR: bezelOuterR + 3, amp: 3.8, freq: 17, speed: 19, col: 'rgba(253, 224, 71, 0.85)', lw: 2 },
        ];
        ctx.save();
        for (let l = 0; l < layers.length; l++) {
          const lay = layers[l];
          ctx.beginPath();
          const steps = 72;
          for (let s = 0; s <= steps; s++) {
            const ang = (s / steps) * TAU;
            const wave =
              Math.sin(ang * lay.freq + animT * lay.speed) * 0.6 +
              Math.cos(ang * (lay.freq - 4) - animT * (lay.speed * 0.8)) * 0.4;
            const rF = lay.baseR + Math.max(0, wave + 0.5) * lay.amp;
            const px = cx + Math.cos(ang) * rF;
            const py = cy + Math.sin(ang) * rF;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.strokeStyle = lay.col;
          ctx.lineWidth = lay.lw;
          ctx.stroke();
        }

        // Rising Anime Ember Sparks around Bezel
        const emberCount = 14;
        for (let e = 0; e < emberCount; e++) {
          const phaseOffset = (e / emberCount + animT * 0.42) % 1;
          const ang = (e * 2.39996 + animT * 0.55) % TAU;
          const dist = bezelOuterR + 4 + phaseOffset * 24;
          const ex = cx + Math.cos(ang) * dist;
          const ey = cy + Math.sin(ang) * dist;
          const sz = (1 - phaseOffset) * 3.2;
          ctx.globalAlpha = Math.max(0, 1 - phaseOffset);
          ctx.fillStyle = e % 2 === 0 ? '#fde047' : '#fb923c';
          ctx.fillRect(ex - sz / 2, ey - sz / 2, sz, sz);
        }
        ctx.restore();
      }

      // Solid Tactile Bezel Body
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR, 0, TAU);
      ctx.fillStyle = '#0b0e16';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR, 0, TAU);
      ctx.strokeStyle = st.overdriveActive
        ? '#fde047'
        : st.lessonSlowActive
        ? '#fde047'
        : isIlluminated
        ? theme.bright
        : streakTier >= 2
        ? '#fbbf24'
        : '#2e3545';
      ctx.lineWidth = st.overdriveActive ? 2.4 : st.lessonSlowActive ? 2.2 : 1.4;
      ctx.stroke();

      // Track Channel
      ctx.beginPath();
      ctx.arc(cx, cy, trackRadius, 0, TAU);
      ctx.strokeStyle = '#07080d';
      ctx.lineWidth = trackWidth;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, TAU);
      ctx.strokeStyle = st.overdriveActive ? 'rgba(251, 146, 60, 0.48)' : '#1f2430';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, TAU);
      ctx.strokeStyle = st.overdriveActive
        ? 'rgba(253, 224, 71, 0.4)'
        : streakTier >= 2
        ? '#374052'
        : '#1f2430';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Speed Trail behind Needle (Blazing Anime Fire Trail during Overdrive)
      if (st.phase === 'PLAYING' || st.phase === 'TUTORIAL_CINEMATIC') {
        const trailStep = st.waveModeId === 'PURPLE_SURGE' ? 0.095 : 0.068;
        const overdriveTrail = ['#991b1b', '#ea580c', '#f59e0b', '#fde047'];
        for (let t = 4; t >= 1; t--) {
          const aStart = st.spinnerAngle - st.direction * (t * trailStep);
          const aEnd = st.spinnerAngle - st.direction * ((t - 1) * trailStep);
          ctx.beginPath();
          ctx.arc(cx, cy, trackRadius, aStart, aEnd, st.direction === -1);
          ctx.strokeStyle = st.overdriveActive
            ? overdriveTrail[4 - t]
            : st.waveModeId === 'PURPLE_SURGE'
            ? `rgba(168, 85, 247, ${(0.12 * (5 - t)).toFixed(2)})`
            : theme.trailSteps[4 - t];
          ctx.lineWidth = trackWidth - 6;
          ctx.stroke();
        }
      }

      const modeMeta = WAVE_MODES.find((m) => m.id === st.waveModeId) || WAVE_MODES[0];
      // Target colors stay strictly fixed to canonical gameplay colors regardless of cabinet theme
      const baseColor = modeMeta.color;
      const isFailed = st.phase === 'SUMMARY' && st.missReasonText;

      // Portals
      if (st.portal) {
        const p = st.portal;
        [
          { ang: p.entryAngle, label: 'IN', col: '#e879f9' },
          { ang: p.exitAngle, label: 'OUT', col: '#22d3ee' },
        ].forEach((node) => {
          ctx.beginPath();
          ctx.arc(cx, cy, trackRadius, node.ang - p.halfWidth, node.ang + p.halfWidth);
          ctx.strokeStyle = node.col;
          ctx.lineWidth = trackWidth - 4;
          ctx.stroke();

          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.font = '800 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            node.label,
            cx + Math.cos(node.ang) * trackRadius,
            cy + Math.sin(node.ang) * trackRadius,
          );
          ctx.restore();
        });
      }

      // Hazard Mines
      for (let i = 0; i < st.hazards.length; i++) {
        const h = st.hazards[i];
        ctx.beginPath();
        ctx.arc(cx, cy, trackRadius, h.angle - h.halfWidth, h.angle + h.halfWidth);
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = trackWidth - 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(h.angle) * (innerRadius + 3), cy + Math.sin(h.angle) * (innerRadius + 3));
        ctx.lineTo(cx + Math.cos(h.angle) * (outerRadius - 3), cy + Math.sin(h.angle) * (outerRadius - 3));
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Visual Anticipation: Next-Note Ghost Radar & Pre-Flip Polarity Warning Chevron
      if (st.phase === 'PLAYING' && st.nextCuePreview) {
        const cue = st.nextCuePreview;
        const fade = Math.max(0.18, Math.min(0.75, 1 - cue.timeUntilSpawn / 1.35));
        const ghostHW = 0.28;
        ctx.save();
        ctx.globalAlpha *= fade;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, trackRadius, cue.angle - ghostHW, cue.angle + ghostHW);
        ctx.strokeStyle = cue.color;
        ctx.lineWidth = trackWidth * 0.42;
        ctx.stroke();
        ctx.setLineDash([]);

        // Ghost center tick
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(cue.angle) * (innerRadius + 3), cy + Math.sin(cue.angle) * (innerRadius + 3));
        ctx.lineTo(cx + Math.cos(cue.angle) * (outerRadius - 3), cy + Math.sin(cue.angle) * (outerRadius - 3));
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pre-Flip Polarity Warning Chevron outside perimeter if spin reverses next wave
        if (cue.isDirectionFlip) {
          const warnR = outerRadius + 15;
          const wx = cx + Math.cos(cue.angle) * warnR;
          const wy = cy + Math.sin(cue.angle) * warnR;
          const flipColor = cue.nextDir === -1 ? '#f87171' : '#34d399';
          ctx.fillStyle = flipColor;
          ctx.font = '900 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cue.nextDir === -1 ? 'FLIP ↺' : 'FLIP ↻', wx, wy);
        }
        ctx.restore();
      }

      // Target Sectors (including Hold Arc Ribbons & Fever Spinners)
      for (let i = 0; i < st.targets.length; i++) {
        const t = st.targets[i];

        // 1. FEVER_SPINNER special radial charge ring inside track
        if (t.isFeverSpinner) {
          const hits = t.feverHits || 0;
          const maxH = Math.max(1, t.feverMaxHits || 8);
          const pct = Math.min(1, hits / maxH);
          const feverR = trackRadius;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, feverR, 0, TAU);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.16)';
          ctx.lineWidth = trackWidth - 4;
          ctx.stroke();

          if (pct > 0.01) {
            ctx.beginPath();
            ctx.arc(cx, cy, feverR, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
            ctx.strokeStyle = pct >= 1 ? '#ffffff' : '#facc15';
            ctx.lineWidth = trackWidth - 4;
            ctx.stroke();
          }

          ctx.fillStyle = '#fde047';
          ctx.font = '900 12px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`MASH ${hits}/${maxH}`, cx, cy - innerRadius * 0.72);
          ctx.restore();
          continue;
        }

        // 2. HOLD_ARC ribbon tail + diamond release cap
        if (t.isHold && t.holdSpanRad && t.holdEndAngle !== undefined) {
          const dir = t.holdDir || st.direction;
          const ccw = dir === -1;
          const holdAnchor = t.holdStartAngle ?? t.angle;
          const totalHoldSpan = Math.max(0.18, t.holdRemainingRad ?? t.holdSpanRad);
          const holdTravelled = t.holdTravelledRad ?? 0;
          const holdProg = t.isHolding
            ? Math.max(0, Math.min(1, holdTravelled / totalHoldSpan))
            : 0;

          ctx.save();
          ctx.globalAlpha *= Math.max(0.15, t.alpha);

          // Full Hold Tail Ribbon Backdrop (anchored from tap position once holding, or head angle before tap)
          ctx.beginPath();
          ctx.arc(cx, cy, trackRadius, t.isHolding ? holdAnchor : t.angle, t.holdEndAngle, ccw);
          ctx.strokeStyle = t.isHolding ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.24)';
          ctx.lineWidth = trackWidth * 0.56;
          ctx.stroke();

          // Outer glowing rail lines of Hold Ribbon
          ctx.beginPath();
          ctx.arc(cx, cy, outerRadius - 4, t.isHolding ? holdAnchor : t.angle, t.holdEndAngle, ccw);
          ctx.strokeStyle = t.isHolding ? '#ffffff' : '#38bdf8';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, innerRadius + 4, t.isHolding ? holdAnchor : t.angle, t.holdEndAngle, ccw);
          ctx.strokeStyle = t.isHolding ? '#ffffff' : '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Filled active sweep portion while holding — grows directly from your tap point to the needle!
          if (t.isHolding && holdProg > 0.005) {
            const sweptEnd = holdAnchor + dir * Math.min(totalHoldSpan, holdTravelled);
            ctx.beginPath();
            ctx.arc(cx, cy, trackRadius, holdAnchor, sweptEnd, ccw);
            ctx.strokeStyle = holdProg >= 0.78 ? '#fde047' : '#38bdf8';
            ctx.lineWidth = trackWidth * 0.64;
            ctx.stroke();
          }

          // Release End Cap Diamond + Sweet-Spot Halo
          const ex = cx + Math.cos(t.holdEndAngle) * trackRadius;
          const ey = cy + Math.sin(t.holdEndAngle) * trackRadius;
          if (t.isHolding) {
            ctx.beginPath();
            ctx.arc(ex, ey, holdProg >= 0.72 ? 12 : 9, 0, TAU);
            ctx.strokeStyle = holdProg >= 0.72 ? '#fde047' : 'rgba(255,255,255,0.45)';
            ctx.lineWidth = holdProg >= 0.72 ? 2.5 : 1.5;
            ctx.stroke();
          }
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(t.holdEndAngle + Math.PI / 4);
          ctx.fillStyle = holdProg >= 0.72 ? '#fde047' : '#ffffff';
          ctx.strokeStyle = '#07080d';
          ctx.lineWidth = 2;
          ctx.fillRect(-6, -6, 12, 12);
          ctx.strokeRect(-6, -6, 12, 12);
          ctx.restore();

          // Head Sector Cap (only prominently lit before hold starts, with visible Perfect zone!)
          if (!t.isHolding) {
            const a0 = t.angle - t.halfWidth;
            const a1 = t.angle + t.halfWidth;
            const headPerfHW = t.halfWidth * (st.rxModActive ? 0.34 : 0.27);
            const activeThis =
              st.phase === 'PLAYING' &&
              Math.abs(signedAngleDiff(st.spinnerAngle, t.angle)) <= t.halfWidth + NEEDLE_TOLERANCE;
            ctx.beginPath();
            ctx.arc(cx, cy, trackRadius, a0, a1);
            ctx.strokeStyle = activeThis ? '#ffffff' : '#38bdf8';
            ctx.lineWidth = trackWidth - 2;
            ctx.stroke();

            // Visible Perfect Window inside Hold Head
            ctx.beginPath();
            ctx.arc(cx, cy, trackRadius, t.angle - headPerfHW, t.angle + headPerfHW);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.lineWidth = trackWidth - 4;
            ctx.stroke();

            ctx.fillStyle = '#07080d';
            ctx.font = '900 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              'HOLD',
              cx + Math.cos(t.angle) * trackRadius,
              cy + Math.sin(t.angle) * trackRadius,
            );
          }

          ctx.restore();
          continue;
        }

        // 3. Standard & Variant Target Sectors
        const a0 = t.angle - t.halfWidth;
        const a1 = t.angle + t.halfWidth;
        const isMultiTap = t.tapsLeft > 1 || t.lastTapAtMs !== undefined;
        const perfRatio = st.rxModActive
          ? isMultiTap
            ? 0.56
            : 0.34
          : isMultiTap
          ? 0.46
          : 0.27;
        const perfHW = Math.max(0.028, t.halfWidth * perfRatio);
        const p0 = t.angle - perfHW;
        const p1 = t.angle + perfHW;

        const activeThis =
          st.phase === 'PLAYING' &&
          Math.abs(signedAngleDiff(st.spinnerAngle, t.angle)) <= t.halfWidth + NEEDLE_TOLERANCE;
        const inPerfectNow =
          st.phase === 'PLAYING' &&
          Math.abs(signedAngleDiff(st.spinnerAngle, t.angle)) <= perfHW;
        const seqBlocked = st.waveModeId === 'ORDERED_SEQ' && i > 0;
        const sectorAlpha = Math.max(0.06, Math.min(1, t.alpha * (seqBlocked ? 0.55 : 1)));

        ctx.save();
        ctx.globalAlpha *= sectorAlpha;

        // Outer Hit Window (GREAT / GOOD)
        ctx.beginPath();
        ctx.arc(cx, cy, trackRadius, a0, a1);
        ctx.strokeStyle = activeThis ? '#ffffff' : t.isMeteorEcho ? '#fb923c' : baseColor;
        ctx.lineWidth = trackWidth - 2;
        ctx.stroke();

        // Visible Perfect Hit Zone Band inside Sector
        ctx.beginPath();
        ctx.arc(cx, cy, trackRadius, p0, p1);
        ctx.strokeStyle = inPerfectNow
          ? 'rgba(253, 224, 71, 0.92)'
          : activeThis
          ? 'rgba(253, 224, 71, 0.65)'
          : 'rgba(255, 255, 255, 0.36)';
        ctx.lineWidth = trackWidth - 4;
        ctx.stroke();

        // Crisp Boundary Ticks Marking Exact Perfect Zone Edges
        [p0, p1].forEach((edgeA) => {
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(edgeA) * (innerRadius + 3), cy + Math.sin(edgeA) * (innerRadius + 3));
          ctx.lineTo(cx + Math.cos(edgeA) * (outerRadius - 3), cy + Math.sin(edgeA) * (outerRadius - 3));
          ctx.strokeStyle = inPerfectNow ? '#fde047' : 'rgba(255, 255, 255, 0.72)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });

        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius - 2, a0, a1);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = activeThis ? 3 : 1.5;
        ctx.stroke();

        // Approach Timing Halo (contracts smoothly onto outer rim at targetHitTime!)
        if (st.phase === 'PLAYING' && t.targetHitTime && st.songTime <= t.targetHitTime && !seqBlocked) {
          const timeToHit = t.targetHitTime - st.songTime;
          if (timeToHit > 0.01 && timeToHit <= 1.05) {
            const ratio = Math.min(1, timeToHit / 1.05);
            const approachR = outerRadius + ratio * 22;
            ctx.beginPath();
            ctx.arc(cx, cy, approachR, a0, a1);
            ctx.strokeStyle = timeToHit <= 0.14 ? '#fde047' : baseColor;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        // Center Bullseye Line
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(t.angle) * (innerRadius + 2), cy + Math.sin(t.angle) * (innerRadius + 2));
        ctx.lineTo(cx + Math.cos(t.angle) * (outerRadius - 2), cy + Math.sin(t.angle) * (outerRadius - 2));
        ctx.strokeStyle = inPerfectNow ? '#fde047' : activeThis ? '#ffffff' : '#ffffff';
        ctx.lineWidth = inPerfectNow ? 2.6 : 2;
        ctx.stroke();

        // Directional Arrowhead Tip indicating CW vs CCW sweep polarity
        if (st.phase === 'PLAYING' && (i === 0 || st.waveModeId !== 'ORDERED_SEQ')) {
          const tipAngle = t.angle + st.direction * (t.halfWidth + 0.055);
          const arrowR = trackRadius;
          const tanAngle = tipAngle + st.direction * (Math.PI / 2);
          const ax = cx + Math.cos(tipAngle) * arrowR;
          const ay = cy + Math.sin(tipAngle) * arrowR;
          ctx.beginPath();
          ctx.moveTo(ax + Math.cos(tanAngle) * 5.5, ay + Math.sin(tanAngle) * 5.5);
          ctx.lineTo(
            ax - Math.cos(tanAngle) * 3.5 + Math.cos(tipAngle) * 4.5,
            ay - Math.sin(tanAngle) * 3.5 + Math.sin(tipAngle) * 4.5,
          );
          ctx.lineTo(
            ax - Math.cos(tanAngle) * 3.5 - Math.cos(tipAngle) * 4.5,
            ay - Math.sin(tanAngle) * 3.5 - Math.sin(tipAngle) * 4.5,
          );
          ctx.closePath();
          ctx.fillStyle = st.direction === 1 ? '#34d399' : '#f87171';
          ctx.fill();
        }

        if (t.tapsLeft > 1 || t.seqNum > 0 || t.isMeteorEcho) {
          ctx.fillStyle = '#07080d';
          ctx.font = '900 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const badge = t.seqNum > 0 ? String(t.seqNum) : t.isMeteorEcho ? '⚡' : `×${t.tapsLeft}`;
          ctx.fillText(
            badge,
            cx + Math.cos(t.angle) * trackRadius,
            cy + Math.sin(t.angle) * trackRadius,
          );
        }

        ctx.restore();
      }

      // Miss Indicator Arc
      if (isFailed && Math.abs(st.missSignedSpan) > 0.004) {
        const endA = st.missNearestEdge + st.missSignedSpan;
        ctx.beginPath();
        ctx.arc(cx, cy, trackRadius, st.missNearestEdge, endA, st.missSignedSpan < 0);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
        ctx.lineWidth = trackWidth * 0.45;
        ctx.stroke();
      }

      // Hit Effects
      for (let i = 0; i < st.hitEffects.length; i++) {
        const fx = st.hitEffects[i];
        const p = 1 - fx.timer / fx.duration;
        const alpha = Math.max(0, 1 - p);
        const burstR = outerRadius + 8 + p * 22;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(cx, cy, burstR, fx.angle - 0.14, fx.angle + 0.14);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = fx.isPerfect ? 4 : 2.5;
        ctx.stroke();

        const tx = cx + Math.cos(fx.angle) * (outerRadius + 24 + p * 12);
        const ty = cy + Math.sin(fx.angle) * (outerRadius + 24 + p * 12);
        ctx.fillStyle = fx.color;
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fx.label, tx, ty);
        ctx.restore();
      }

      // Curved Hit-Error Timing Gauge + Perfect Zone Brackets
      const gaugeR = innerRadius * 0.78;
      const gaugeCenter = Math.PI / 2;
      const gaugeHalfSpan = 0.72;
      const perfBracketHalf = gaugeHalfSpan * 0.27;
      ctx.beginPath();
      ctx.arc(cx, cy, gaugeR, gaugeCenter - gaugeHalfSpan, gaugeCenter + gaugeHalfSpan);
      ctx.strokeStyle = '#222733';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Highlighted Perfect window band inside gauge
      ctx.beginPath();
      ctx.arc(cx, cy, gaugeR, gaugeCenter - perfBracketHalf, gaugeCenter + perfBracketHalf);
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
      ctx.lineWidth = 4;
      ctx.stroke();

      [gaugeCenter - perfBracketHalf, gaugeCenter + perfBracketHalf].forEach((bA) => {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(bA) * (gaugeR - 4), cy + Math.sin(bA) * (gaugeR - 4));
        ctx.lineTo(cx + Math.cos(bA) * (gaugeR + 4), cy + Math.sin(bA) * (gaugeR + 4));
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      });

      ctx.beginPath();
      ctx.moveTo(cx, cy + gaugeR - 5);
      ctx.lineTo(cx, cy + gaugeR + 5);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      for (let i = 0; i < st.hitErrorTicks.length; i++) {
        const tick = st.hitErrorTicks[i];
        const alpha = Math.max(0, 1 - tick.age / 1.8);
        if (alpha <= 0) continue;
        const tickAngle = gaugeCenter - tick.offsetSigned * (gaugeHalfSpan * 0.92);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(tickAngle) * (gaugeR - 4), cy + Math.sin(tickAngle) * (gaugeR - 4));
        ctx.lineTo(cx + Math.cos(tickAngle) * (gaugeR + 4), cy + Math.sin(tickAngle) * (gaugeR + 4));
        ctx.strokeStyle = tick.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Center Peripheral Hub
      const hubRadius = innerRadius * 0.54;
      const hubActive = isIlluminated || st.hubStatusTimer > 0;
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, TAU);
      ctx.fillStyle = isFailed ? '#1f0b0e' : hubActive ? theme.hubActiveFill : '#090b12';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, TAU);
      ctx.strokeStyle = isFailed
        ? '#ef4444'
        : hubActive
        ? theme.bright
        : streakTier >= 2
        ? '#fbbf24'
        : '#273044';
      ctx.lineWidth = hubActive ? 1.6 : 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isFailed) {
        ctx.fillStyle = '#ef4444';
        ctx.font = '800 12px "JetBrains Mono", monospace';
        ctx.fillText('MISS', cx, cy - 8);
        ctx.fillStyle = '#fca5a5';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText(`${st.missDegrees}°`, cx, cy + 8);
      } else if (st.phase === 'PLAYING') {
        if (st.waitingForCue && st.breakRemainingSec > 1.35) {
          const isSoon = st.breakRemainingSec <= 2.4;
          const arcFrac = Math.max(0.05, Math.min(1, st.breakRemainingSec / 14));
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            hubRadius - 4,
            -Math.PI / 2,
            -Math.PI / 2 + TAU * arcFrac,
          );
          ctx.strokeStyle = isSoon ? '#fde047' : '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.fillStyle = isSoon ? '#fde047' : '#38bdf8';
          ctx.font = '800 10px "JetBrains Mono", monospace';
          ctx.fillText(isSoon ? 'GET READY' : 'BREAK', cx, cy - 9);
          ctx.fillStyle = '#f3f4f6';
          ctx.font = '900 16px "JetBrains Mono", monospace';
          ctx.fillText(`${st.breakRemainingSec.toFixed(1)}s`, cx, cy + 9);
        } else if (st.hubStatusTimer > 0) {
          ctx.fillStyle = st.hubStatusColor || '#34d399';
          ctx.font = '900 11px "JetBrains Mono", monospace';
          ctx.fillText(st.hubStatusText, cx, cy - 10);
          ctx.fillStyle = streakTier >= 2 ? '#fbbf24' : '#f3f4f6';
          ctx.font = '900 18px "JetBrains Mono", monospace';
          ctx.fillText(`${st.streak}x`, cx, cy + 8);
        } else {
          ctx.fillStyle = st.activeLesson
            ? '#fde047'
            : st.direction === 1
            ? '#34d399'
            : '#f87171';
          ctx.font = '800 10px "JetBrains Mono", monospace';
          const dirLabel = st.activeLesson ? 'GUIDE ACTIVE' : st.direction === 1 ? 'CW ↻' : 'CCW ↺';
          ctx.fillText(dirLabel, cx, cy - 10);
          ctx.fillStyle = streakTier >= 2 ? '#fbbf24' : '#f3f4f6';
          ctx.font = '900 18px "JetBrains Mono", monospace';
          ctx.fillText(`${st.streak}x`, cx, cy + 8);
        }
      } else {
        ctx.fillStyle = '#a1abbe';
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillText(st.phase === 'PAUSED' ? 'PAUSED' : 'READY', cx, cy);
      }

      // Needle Arm & Pointer
      const sa = st.spinnerAngle;
      const cosA = Math.cos(sa);
      const sinA = Math.sin(sa);
      ctx.beginPath();
      ctx.moveTo(cx + cosA * hubRadius, cy + sinA * hubRadius);
      ctx.lineTo(cx + cosA * (innerRadius - 1), cy + sinA * (innerRadius - 1));
      ctx.strokeStyle = isFailed ? '#ef4444' : '#374052';
      ctx.lineWidth = 2;
      ctx.stroke();

      const needleColor = isFailed ? '#ef4444' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx + cosA * (innerRadius - 5), cy + sinA * (innerRadius - 5));
      ctx.lineTo(cx + cosA * (outerRadius + 5), cy + sinA * (outerRadius + 5));
      ctx.strokeStyle = needleColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      const tipBaseR = outerRadius + 8;
      const tipPeakR = outerRadius + 14;
      const perpX = -sinA * 4;
      const perpY = cosA * 4;
      ctx.beginPath();
      ctx.moveTo(cx + cosA * tipPeakR, cy + sinA * tipPeakR);
      ctx.lineTo(cx + cosA * tipBaseR + perpX, cy + sinA * tipBaseR + perpY);
      ctx.lineTo(cx + cosA * tipBaseR - perpX, cy + sinA * tipBaseR - perpY);
      ctx.closePath();
      ctx.fillStyle = needleColor;
      ctx.fill();

      // Flashlight (FL) Mod Vignette Beam following the needle pointer
      if (st.flashlightActive && st.phase === 'PLAYING') {
        const beamX = cx + cosA * trackRadius;
        const beamY = cy + sinA * trackRadius;
        const grad = ctx.createRadialGradient(
          beamX,
          beamY,
          Math.max(36, maxR * 0.16),
          beamX,
          beamY,
          Math.max(130, maxR * 0.56),
        );
        grad.addColorStop(0, 'rgba(7, 8, 13, 0)');
        grad.addColorStop(0.65, 'rgba(7, 8, 13, 0.72)');
        grad.addColorStop(1, 'rgba(7, 8, 13, 0.96)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.restore();
      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [bgFxMode, renderStateRef, themeId]);

  const hpClamped = Math.max(0, Math.min(100, hp));
  const hpColor = hpClamped > 55 ? '#34d399' : hpClamped > 25 ? '#fbbf24' : '#ef4444';

  return (
    <div className="relative z-10 flex flex-1 w-full flex-col overflow-hidden px-4 py-3 sm:px-7 sm:py-4">
      {/* Unobtrusive Corner HUD — Top Row */}
      <div className="pointer-events-none relative z-20 flex w-full items-start justify-between gap-4">
        {/* Top-Left: Score + HP Integrity Bar */}
        <div className="flex flex-col">
          <span className="tabular-nums text-3xl sm:text-4xl font-black tracking-tight text-white leading-none">
            {score.toLocaleString()}
          </span>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[#b6bfd1] tabular-nums whitespace-nowrap">
            <span className="font-bold text-[#22d3ee]">{accuracyPct.toFixed(1)}%</span>
            <span aria-hidden="true">·</span>
            <span>{totalMult.toFixed(2)}x</span>
            <span aria-hidden="true">·</span>
            <span>Best {bestScore.toLocaleString()}</span>
          </div>
          {/* Compact Integrity Bar + Overdrive Surge Meter */}
          {!isTutorialRun && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-32 sm:w-40 overflow-hidden bg-white/10">
                  <div
                    className="h-full transition-all duration-150"
                    style={{ width: `${hpClamped}%`, backgroundColor: hpColor }}
                  />
                </div>
                <span className="tabular-nums text-[10px] font-bold text-[#b6bfd1]">
                  {isPracticeMode ? 'PRAC' : noFailActive ? 'NF' : `${Math.round(hpClamped)}%`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`h-1.5 w-32 sm:w-40 overflow-hidden ${
                    overdriveActive ? 'bg-[#fb923c]/25 ring-1 ring-[#fde047]/60' : 'bg-white/10'
                  }`}
                >
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${Math.max(0, Math.min(100, overdriveCharge))}%`,
                      background: overdriveActive
                        ? 'linear-gradient(90deg, #ef4444, #f97316, #fde047)'
                        : 'linear-gradient(90deg, #f97316, #fbbf24)',
                    }}
                  />
                </div>
                <span
                  className={`tabular-nums text-[10px] font-extrabold whitespace-nowrap ${
                    overdriveActive ? 'text-[#fde047]' : 'text-[#fb923c]'
                  }`}
                >
                  {overdriveActive
                    ? `OVERDRIVE 2× ORBS · ${overdriveTimeLeft.toFixed(1)}s`
                    : `OD ${Math.round(overdriveCharge)}%`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Practice / Replay Tag, Tutorial Lives, or Shields */}
        <div className="pointer-events-auto flex items-center gap-3 shrink-0">
          {isPracticeMode && (
            <div className="flex items-center gap-2 border border-[#38bdf8]/45 bg-[#0a1624]/95 px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-[#38bdf8] whitespace-nowrap tabular-nums">
              <span>PRACTICE · UNRANKED · {practiceSpeed}×</span>
              <button
                type="button"
                onClick={onExitPractice}
                className="text-white/80 hover:text-white underline cursor-pointer"
              >
                Exit
              </button>
            </div>
          )}
          {isReplayMode && (
            <div className="flex items-center gap-2 border border-[#c084fc]/45 bg-[#191026]/95 px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-[#e9d5ff] whitespace-nowrap tabular-nums">
              <span>REPLAY · {replayLabel}</span>
              <button
                type="button"
                onClick={onExitReplay}
                className="text-white/80 hover:text-white underline cursor-pointer"
              >
                Exit
              </button>
            </div>
          )}
          {isTutorialRun && (
            <div className="flex items-center gap-2.5 border border-white/15 bg-[#101420]/90 px-3 py-1.5 text-xs font-bold text-[#fbbf24] whitespace-nowrap">
              <span className="tabular-nums">Lives {tutorialLives}/3</span>
              <button
                type="button"
                onClick={onSkipTutorial}
                className="text-[#b6bfd1] hover:text-white underline cursor-pointer"
              >
                Skip
              </button>
            </div>
          )}
          {shields > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#34d399] tabular-nums whitespace-nowrap">
              <Shield className="h-4 w-4" />
              <span>{shields} Shield</span>
            </div>
          )}
        </div>
      </div>

      {/* Tutorial Lesson Banner (Only shown when active and not paused) */}
      {activeLesson && phase === 'PLAYING' && (
        <div className="pointer-events-none mx-auto mt-2 max-w-lg border border-[#fde047]/45 bg-[#0d111a]/95 px-5 py-2.5 text-center shadow-lg">
          <p className="text-xs font-extrabold tracking-wider text-[#fde047] uppercase">
            {activeLesson.title}
          </p>
          <p className="mt-0.5 text-xs text-[#e5e7eb]">{activeLesson.instruction}</p>
        </div>
      )}

      {showTutorialCompleteStripe && (
        <div className="pointer-events-none mx-auto mt-2 border border-[#34d399]/50 bg-[#08261c]/95 px-6 py-2 text-center text-xs font-extrabold tracking-wider text-[#34d399]">
          Calibration Complete — All Tracks Unlocked
        </div>
      )}

      {/* Center Preserved Orbit Playfield Circle */}
      <div
        ref={wrapRef}
        onPointerDown={(e) => {
          if (!allowPointerTap) return;
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          onTriggerPress(e.timeStamp);
        }}
        onPointerUp={(e) => {
          if (!allowPointerTap) return;
          onTriggerRelease(e.timeStamp);
        }}
        onPointerCancel={(e) => {
          if (!allowPointerTap) return;
          onTriggerRelease(e.timeStamp);
        }}
        className="relative flex-1 w-full cursor-pointer select-none min-h-0"
      >
        <canvas ref={canvasRef} className="block h-full w-full" />

        {phase === 'IDLE' && !isReplayMode && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="lazer-slant-sm border border-white/15 bg-[#0e111a]/92 px-6 py-2 text-xs font-bold text-white">
              <span className="lazer-unslant-sm block">{promptHint}</span>
            </div>
          </div>
        )}
      </div>

      {/* GD-Style Practice Dock (Start Pos Scrubber + Checkpoints + Speed) */}
      {isPracticeMode && !isReplayMode && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative z-20 mx-auto mb-2 flex w-full max-w-3xl flex-wrap items-center justify-between gap-2.5 border border-[#38bdf8]/35 bg-[#0b101b]/95 px-3.5 py-2 text-xs"
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDropCheckpoint}
              className="tactile-btn flex items-center gap-1 border border-[#34d399]/50 bg-[#0d241c] px-2.5 py-1 font-bold text-[#34d399] hover:border-[#34d399] cursor-pointer whitespace-nowrap"
              title="Drop Checkpoint (Z)"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Drop (Z)</span>
            </button>
            <button
              type="button"
              onClick={onRemoveCheckpoint}
              disabled={practiceCheckpoints.length === 0}
              className="tactile-btn flex items-center gap-1 border border-white/15 bg-[#121726] px-2.5 py-1 font-bold text-[#d1d5db] hover:border-white/35 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              title="Remove Last Checkpoint (X)"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Del (X)</span>
            </button>
            <button
              type="button"
              onClick={onRespawnCheckpoint}
              className="tactile-btn flex items-center gap-1 border border-[#38bdf8]/45 bg-[#102033] px-2.5 py-1 font-bold text-[#38bdf8] hover:border-[#38bdf8] cursor-pointer whitespace-nowrap"
              title="Respawn at Checkpoint / Start Pos (C)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Respawn ({practiceCheckpoints.length})</span>
            </button>
          </div>

          {/* Start Pos Timeline Scrubber with Diamond Checkpoint Pins */}
          <div className="relative flex min-w-[160px] flex-1 items-center gap-2">
            <span className="tabular-nums text-[10px] font-bold text-[#a1abbe] whitespace-nowrap">
              {formatTimeSec(songTime)}
            </span>
            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(songDurationSec - 2))}
                step={0.5}
                value={Math.min(songTime, Math.max(1, songDurationSec - 2))}
                onChange={(e) => onPracticeSeek(Number(e.target.value))}
                aria-label="Practice Start Position"
                className="w-full accent-[#38bdf8] cursor-pointer"
              />
              {practiceCheckpoints.map((cp) => {
                const pct = (cp.songTime / Math.max(1, songDurationSec)) * 100;
                return (
                  <span
                    key={cp.id}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rotate-45 border border-[#07080d] bg-[#34d399]"
                    style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}
                  />
                );
              })}
              {practiceStartSec > 0 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-1/2 bg-[#fde047]"
                  style={{
                    left: `${Math.max(0, Math.min(100, (practiceStartSec / Math.max(1, songDurationSec)) * 100))}%`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 tabular-nums">
            {[0.5, 0.75, 0.85, 1.0].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onChangePracticeSpeed(spd)}
                className={`tactile-btn border px-2 py-1 text-[11px] font-extrabold cursor-pointer ${
                  practiceSpeed === spd
                    ? 'border-[#38bdf8] bg-[#38bdf8] text-[#04121d]'
                    : 'border-white/12 bg-[#121726] text-[#a1abbe] hover:text-white'
                }`}
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Deterministic Replay Theater Dock */}
      {isReplayMode && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative z-20 mx-auto mb-2 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 border border-[#c084fc]/40 bg-[#0d0b16]/95 px-3.5 py-2 text-xs"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleReplayPause}
              className="tactile-btn flex items-center gap-1.5 border border-[#c084fc]/55 bg-[#201233] px-3 py-1 font-bold text-white hover:border-[#c084fc] cursor-pointer"
            >
              {replayPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{replayPaused ? 'Play' : 'Pause'}</span>
            </button>
            <div className="flex items-center gap-1 tabular-nums">
              {[0.5, 1.0, 2.0].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onChangeReplaySpeed(spd)}
                  className={`tactile-btn border px-2 py-1 text-[11px] font-extrabold cursor-pointer ${
                    replaySpeed === spd
                      ? 'border-[#c084fc] bg-[#c084fc] text-[#140724]'
                      : 'border-white/12 bg-[#141122] text-[#a1abbe] hover:text-white'
                  }`}
                >
                  {spd}×
                </button>
              ))}
            </div>
          </div>

          {/* Replay Timeline Scrubber with Color-Coded Input Ticks */}
          <div className="relative flex min-w-[180px] flex-1 items-center gap-2">
            <span className="tabular-nums text-[10px] font-bold text-[#e9d5ff] whitespace-nowrap">
              {formatTimeSec(songTime)} / {formatTimeSec(songDurationSec)}
            </span>
            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(songDurationSec))}
                step={0.5}
                value={Math.min(songTime, Math.max(1, songDurationSec))}
                onChange={(e) => onReplaySeek(Number(e.target.value))}
                aria-label="Replay Timeline"
                className="w-full accent-[#c084fc] cursor-pointer"
              />
              {replayEvents
                .filter((ev) => ev.action === 'PRESS')
                .map((ev, idx) => {
                  const pct = (ev.songTime / Math.max(1, songDurationSec)) * 100;
                  const col =
                    ev.tier === 'PERFECT'
                      ? '#fde047'
                      : ev.tier === 'GREAT'
                      ? '#34d399'
                      : ev.tier === 'GOOD'
                      ? '#22d3ee'
                      : '#ef4444';
                  return (
                    <span
                      key={`${ev.songTime}-${idx}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 h-2 w-[2px] -translate-y-1/2"
                      style={{ left: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: col }}
                    />
                  );
                })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline tabular-nums text-[11px] font-semibold text-[#d8b4fe] whitespace-nowrap">
              {replayLastClickLabel || 'CBS Inspector Ready'}
            </span>
            <button
              type="button"
              onClick={onExitReplay}
              className="tactile-btn flex items-center gap-1 border border-white/15 bg-[#151824] px-2.5 py-1 font-bold text-[#d1d5db] hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      )}

      {/* Unobtrusive Corner HUD — Bottom Row */}
      <div className="pointer-events-none relative z-20 flex w-full items-end justify-between gap-4">
        {/* Bottom-Left: Combo + Unbanked Orbs */}
        <div className="flex items-baseline gap-4">
          <div>
            <span className="block text-[11px] font-semibold text-[#b6bfd1] whitespace-nowrap">
              {getComboLabel(streak)} ({streakMult.toFixed(2)}x)
            </span>
            <span
              className={`tabular-nums text-2xl sm:text-3xl font-black leading-none ${
                overdriveActive ? 'text-[#fde047]' : 'text-white'
              }`}
            >
              {streak}x
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#fbbf24] tabular-nums whitespace-nowrap">
            <OrbIcon className="h-4 w-4" />
            <span>
              {isPracticeMode
                ? 'Unranked'
                : `+${unbankedOrbs} Orbs${overdriveActive ? ' (2×)' : ''}`}
            </span>
          </div>
        </div>

        {/* Bottom-Right: Active Wave Cue + Mechanical Keycaps */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold whitespace-nowrap">
            <span className="text-[#a1abbe]">Pattern</span>
            <span style={{ color: modeColor }}>{modeName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              data-pressed={pressedKey === 'k1'}
              className={`tactile-btn border px-2.5 py-1 font-mono text-[11px] font-bold ${
                pressedKey === 'k1'
                  ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-white'
                  : 'border-white/15 bg-[#101420]/90 text-[#d1d5db]'
              }`}
            >
              {trigger1Label}
            </span>
            <span
              data-pressed={pressedKey === 'k2'}
              className={`tactile-btn border px-2.5 py-1 font-mono text-[11px] font-bold ${
                pressedKey === 'k2'
                  ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-white'
                  : 'border-white/15 bg-[#101420]/90 text-[#d1d5db]'
              }`}
            >
              {trigger2Label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
