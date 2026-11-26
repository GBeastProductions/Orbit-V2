import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { CHASSIS_THEMES, NEEDLE_TOLERANCE, WAVE_MODES } from '../data/catalog';
import { formatTimeSec, signedAngleDiff, TAU } from '../engine/beatmap';
import {
  BgFxMode,
  GamePhase,
  HazardMine,
  HitEffect,
  HitErrorTick,
  NextCuePreview,
  OverdriveVfxMode,
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
  overdrivePerfectsEarned: number;
  overdriveTargetPerfects: number;
  overdriveUsedThisRun: boolean;
  overdriveVfxMode?: OverdriveVfxMode;
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
  overdriveVfxMode: OverdriveVfxMode;
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
  // Overdrive HUD (Once per run at 45% of perfects)
  overdriveCharge: number;
  overdriveActive: boolean;
  overdriveTimeLeft: number;
  overdrivePerfectsEarned: number;
  overdriveTargetPerfects: number;
  overdriveUsed: boolean;
  // Practice Mode
  isPracticeMode: boolean;
  practicePaused: boolean;
  practiceSpeed: number;
  practiceStartSec: number;
  practiceCheckpoints: PracticeCheckpoint[];
  songDurationSec: number;
  songTime: number;
  onTogglePracticePause: () => void;
  onDropCheckpoint: () => void;
  onRemoveCheckpoint: () => void;
  onRespawnCheckpoint: () => void;
  onChangePracticeSpeed: (speed: number) => void;
  onPracticeSeek: (sec: number, skipAudioStart?: boolean) => void;
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
  onReplaySeek: (sec: number, skipAudioStart?: boolean) => void;
  onExitReplay: () => void;
}

function getComboLabel(streak: number): string {
  if (streak >= 100) return 'Apex Overdrive';
  if (streak >= 50) return 'Harmonic Fever';
  if (streak >= 25) return 'Disco Surge';
  return 'Combo';
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  rot: number = 0,
) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = rot + (i * Math.PI) / 4;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawAnamorphicBeam(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  length: number,
  halfThickness: number,
  primaryCol: string,
  secondaryCol: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Outer theme halo flare
  const grad = ctx.createLinearGradient(-length, 0, length, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.28, primaryCol);
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(0.72, secondaryCol);
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.beginPath();
  ctx.moveTo(-length, 0);
  ctx.quadraticCurveTo(0, -halfThickness * 2.4, length, 0);
  ctx.quadraticCurveTo(0, halfThickness * 2.4, -length, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Razor-sharp white-hot core needle
  ctx.beginPath();
  ctx.moveTo(-length * 0.88, 0);
  ctx.quadraticCurveTo(0, -halfThickness * 0.65, length * 0.88, 0);
  ctx.quadraticCurveTo(0, halfThickness * 0.65, -length * 0.88, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();

  ctx.restore();
}

interface OverdriveSpriteCache {
  flame: HTMLCanvasElement;
  voidCloud: HTMLCanvasElement;
  star: HTMLCanvasElement;
}

function buildOverdriveSprites(theme: (typeof CHASSIS_THEMES)[ThemeId]): OverdriveSpriteCache {
  // 1. Volumetric Plasma Flame Cloud Sprite (multi-stop thermal bloom in theme colors)
  const flame = document.createElement('canvas');
  flame.width = 192;
  flame.height = 192;
  const fCtx = flame.getContext('2d');
  if (fCtx) {
    const g = fCtx.createRadialGradient(96, 96, 4, 96, 96, 94);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
    g.addColorStop(0.16, theme.edgeTick);
    g.addColorStop(0.36, theme.bright);
    g.addColorStop(0.62, theme.primary);
    g.addColorStop(0.84, `rgba(${theme.bgAccentRgb}, 0.16)`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    fCtx.fillStyle = g;
    fCtx.fillRect(0, 0, 192, 192);
  }

  // 2. Dark Void / Charcoal Ember Contrast Cloud (creates dramatic anime fire cutouts!)
  const voidCloud = document.createElement('canvas');
  voidCloud.width = 160;
  voidCloud.height = 160;
  const vCtx = voidCloud.getContext('2d');
  if (vCtx) {
    const g = vCtx.createRadialGradient(80, 80, 10, 80, 80, 78);
    g.addColorStop(0, 'rgba(9, 4, 14, 0.88)');
    g.addColorStop(0.45, 'rgba(16, 6, 20, 0.68)');
    g.addColorStop(0.78, 'rgba(10, 5, 14, 0.25)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    vCtx.fillStyle = g;
    vCtx.fillRect(0, 0, 160, 160);
  }

  // 3. Soft Glowing 4-Point Flare Star Sprite
  const star = document.createElement('canvas');
  star.width = 96;
  star.height = 96;
  const sCtx = star.getContext('2d');
  if (sCtx) {
    const halo = sCtx.createRadialGradient(48, 48, 2, 48, 48, 44);
    halo.addColorStop(0, 'rgba(255,255,255,0.95)');
    halo.addColorStop(0.28, theme.edgeTick);
    halo.addColorStop(0.65, `rgba(${theme.bgAccentRgb}, 0.22)`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = halo;
    sCtx.fillRect(0, 0, 96, 96);

    drawFourPointStar(sCtx, 48, 48, 36, 5.5, 0);
    sCtx.fillStyle = '#ffffff';
    sCtx.fill();
  }

  return { flame, voidCloud, star };
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, 'f').slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [1, 0.23, 0.51];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const OVERDRIVE_VERT_SRC = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const OVERDRIVE_FRAG_SRC = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_bezelR;
uniform float u_charge;
uniform float u_active;
uniform float u_vfxScale;
uniform float u_beatPulse;
uniform float u_bass;
uniform float u_dir;
uniform vec3 u_primary;
uniform vec3 u_bright;
uniform vec3 u_secondary;
uniform vec3 u_edgeTick;

out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.04 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  if (u_vfxScale <= 0.01) {
    outColor = vec4(0.0);
    return;
  }

  vec2 p = gl_FragCoord.xy - u_center;
  float r = length(p);
  float bezel = max(24.0, u_bezelR);

  // Keep central Orbit dial crystal dark and 100% readable
  float innerCut = smoothstep(bezel * 0.93, bezel * 1.03, r);
  if (innerCut <= 0.001) {
    outColor = vec4(0.0);
    return;
  }

  float ang = atan(p.y, p.x);
  float normDist = max(0.0, (r - bezel) / bezel);

  // Progressive reach: smoothly climbs 0% -> 99% while charging, erupts 100%+ on Overdrive
  float chargeCurve = pow(clamp(u_charge, 0.0, 1.0), 1.08);
  float chargeReach = mix(0.14, 0.68, chargeCurve);
  float activeReach = 1.65 + u_beatPulse * 0.25 + u_bass * 0.22;
  float maxReach = mix(chargeReach, activeReach, u_active) * mix(0.42, 1.0, u_vfxScale);

  // Polar swirling domain-warped coordinates
  float swirlAng = ang - u_dir * (normDist * 1.35 - u_time * (0.65 + 0.95 * u_active));
  vec2 flow = vec2(cos(swirlAng), sin(swirlAng)) * (2.6 + normDist * 2.2);
  vec2 drift = vec2(normDist * 3.4 - u_time * (1.2 + 1.6 * u_active), swirlAng * 1.4);

  float nBase = fbm(flow + drift * 0.72);
  float nWarp = fbm(flow * 1.65 - drift * 0.95 + vec2(nBase * 1.7, -nBase * 1.3));
  float ridged = 1.0 - abs(nWarp * 2.0 - 1.0);
  ridged = pow(clamp(ridged, 0.0, 1.0), 1.45);

  float radMask = 1.0 - smoothstep(0.0, max(0.08, maxReach), normDist);
  float crown = exp(-normDist * mix(5.8, 1.75, u_active)) * mix(0.45 + 0.55 * chargeCurve, 1.28, u_active);

  // Deep charred ember soot pockets carved between hot flame tongues
  float sootPocket = smoothstep(0.32, 0.68, nBase);
  float flameField = clamp((ridged * 0.92 + nWarp * 0.45) * radMask + crown * (0.65 + 0.35 * ridged), 0.0, 1.8);
  float carvedFlame = max(0.0, flameField - sootPocket * 0.34 * smoothstep(0.04, 0.35, normDist));

  // Anamorphic cardinal cross-glare beams in shader
  float crossIntensity = u_active * u_vfxScale;
  float hBeam = exp(-abs(p.y) / (bezel * 0.055)) * exp(-abs(p.x) / (bezel * 2.55));
  float vBeam = exp(-abs(p.x) / (bezel * 0.055)) * exp(-abs(p.y) / (bezel * 2.35));
  float crossFlare = (hBeam + vBeam) * crossIntensity * 0.72;

  // Multi-stop anime thermal palette tinted by active theme
  vec3 sootCol = mix(vec3(0.05, 0.01, 0.06), u_primary * 0.16, 0.55);
  vec3 midCol = mix(u_primary, u_bright, smoothstep(0.22, 0.62, carvedFlame));
  vec3 hotCol = mix(midCol, u_edgeTick, smoothstep(0.55, 0.92, carvedFlame));
  vec3 coreCol = mix(hotCol, vec3(1.0, 0.98, 0.96), smoothstep(0.9, 1.38, carvedFlame + crossFlare * 0.7));

  vec3 finalCol = mix(sootCol, coreCol, smoothstep(0.08, 0.45, carvedFlame + crossFlare));
  finalCol += mix(u_secondary, vec3(1.0), 0.55) * crossFlare;

  float sootAlpha = sootPocket * radMask * (0.28 + 0.38 * u_active) * innerCut;
  float plasmaAlpha = clamp(carvedFlame * (0.48 + 0.52 * max(chargeCurve, u_active)) + crossFlare * 0.85, 0.0, 0.95) * innerCut;
  float alpha = clamp(max(sootAlpha, plasmaAlpha) * u_vfxScale, 0.0, 0.96);

  outColor = vec4(finalCol * alpha, alpha);
}`;

interface OverdriveGlResources {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  uTime: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uCenter: WebGLUniformLocation | null;
  uBezelR: WebGLUniformLocation | null;
  uCharge: WebGLUniformLocation | null;
  uActive: WebGLUniformLocation | null;
  uVfxScale: WebGLUniformLocation | null;
  uBeatPulse: WebGLUniformLocation | null;
  uBass: WebGLUniformLocation | null;
  uDir: WebGLUniformLocation | null;
  uPrimary: WebGLUniformLocation | null;
  uBright: WebGLUniformLocation | null;
  uSecondary: WebGLUniformLocation | null;
  uEdgeTick: WebGLUniformLocation | null;
}

function initOverdriveWebGL(canvas: HTMLCanvasElement): OverdriveGlResources | null {
  try {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return null;

    const compileShader = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compileShader(gl.VERTEX_SHADER, OVERDRIVE_VERT_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, OVERDRIVE_FRAG_SRC);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    const vao = gl.createVertexArray();
    if (!vao) return null;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    return {
      gl,
      program,
      vao,
      uTime: gl.getUniformLocation(program, 'u_time'),
      uResolution: gl.getUniformLocation(program, 'u_resolution'),
      uCenter: gl.getUniformLocation(program, 'u_center'),
      uBezelR: gl.getUniformLocation(program, 'u_bezelR'),
      uCharge: gl.getUniformLocation(program, 'u_charge'),
      uActive: gl.getUniformLocation(program, 'u_active'),
      uVfxScale: gl.getUniformLocation(program, 'u_vfxScale'),
      uBeatPulse: gl.getUniformLocation(program, 'u_beatPulse'),
      uBass: gl.getUniformLocation(program, 'u_bass'),
      uDir: gl.getUniformLocation(program, 'u_dir'),
      uPrimary: gl.getUniformLocation(program, 'u_primary'),
      uBright: gl.getUniformLocation(program, 'u_bright'),
      uSecondary: gl.getUniformLocation(program, 'u_secondary'),
      uEdgeTick: gl.getUniformLocation(program, 'u_edgeTick'),
    };
  } catch {
    return null;
  }
}

export const OrbitStage: React.FC<OrbitStageProps> = ({
  renderStateRef,
  phase,
  themeId,
  bgFxMode,
  overdriveVfxMode,
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
  overdrivePerfectsEarned,
  overdriveTargetPerfects,
  overdriveUsed,
  isPracticeMode,
  practicePaused,
  practiceSpeed,
  practiceStartSec,
  practiceCheckpoints,
  songDurationSec,
  songTime,
  onTogglePracticePause,
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
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const glResRef = useRef<OverdriveGlResources | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ width: 520, height: 420, dpr: 1 });
  const [pressedKey, setPressedKey] = useState<'k1' | 'k2' | null>(null);
  const [scrubHover, setScrubHover] = useState<{ pct: number; sec: number } | null>(null);
  const [dragSec, setDragSec] = useState<number | null>(null);
  const isScrubbingRef = useRef(false);
  const lastDragSecRef = useRef<number | null>(null);
  const pointerDownInsideRef = useRef(false);

  const activeTheme = CHASSIS_THEMES[themeId] || CHASSIS_THEMES.tokyo_pink;

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

  const computeScrubTime = useCallback(
    (clientX: number) => {
      const el = scrubberRef.current;
      if (!el) return { pct: 0, sec: 0 };
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const maxSeek = isPracticeMode
        ? Math.max(1, songDurationSec - 1.5)
        : Math.max(1, songDurationSec - 0.5);
      return { pct: pct * 100, sec: Math.min(maxSeek, pct * songDurationSec) };
    },
    [isPracticeMode, songDurationSec],
  );

  const applyScrubAt = useCallback(
    (clientX: number, skipAudioStart: boolean) => {
      const { sec } = computeScrubTime(clientX);
      lastDragSecRef.current = sec;
      if (skipAudioStart) {
        setDragSec(sec);
      } else {
        setDragSec(null);
      }
      if (isReplayMode) {
        onReplaySeek(sec, skipAudioStart);
      } else if (isPracticeMode) {
        onPracticeSeek(sec, skipAudioStart);
      }
    },
    [computeScrubTime, isPracticeMode, isReplayMode, onPracticeSeek, onReplaySeek],
  );

  useEffect(() => {
    const onWinMove = (e: PointerEvent) => {
      if (!isScrubbingRef.current) return;
      const info = computeScrubTime(e.clientX);
      setScrubHover(info);
      applyScrubAt(e.clientX, true);
    };
    const onWinUp = () => {
      if (!isScrubbingRef.current) return;
      isScrubbingRef.current = false;
      const finalSec = lastDragSecRef.current;
      lastDragSecRef.current = null;
      setDragSec(null);
      if (finalSec !== null) {
        if (isReplayMode) onReplaySeek(finalSec, false);
        else if (isPracticeMode) onPracticeSeek(finalSec, false);
      }
    };
    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
    window.addEventListener('pointercancel', onWinUp);
    return () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);
    };
  }, [applyScrubAt, computeScrubTime, isPracticeMode, isReplayMode, onPracticeSeek, onReplaySeek]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const glCanvas = glCanvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (glCanvas && !glResRef.current) {
      glResRef.current = initOverdriveWebGL(glCanvas);
    }

    const themeForSprites = CHASSIS_THEMES[themeId] || CHASSIS_THEMES.tokyo_pink;
    const sprites = buildOverdriveSprites(themeForSprites);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      const cw = Math.max(1, Math.floor(rect.width * dpr));
      const ch = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = cw;
      canvas.height = ch;
      if (glCanvas) {
        glCanvas.width = cw;
        glCanvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: rect.width, height: rect.height, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);

    let rafId = 0;
    const drawFrame = () => {
      const st = renderStateRef.current;
      const { width, height, dpr } = sizeRef.current;
      const cx = width / 2 + st.shakeX;
      const cy = height / 2;
      const maxR = Math.min(width / 2, height / 2) * 0.9;
      const theme = CHASSIS_THEMES[themeId] || CHASSIS_THEMES.tokyo_pink;
      const effVfxMode: OverdriveVfxMode = st.overdriveVfxMode ?? overdriveVfxMode;
      const vfxScale = effVfxMode === 'off' ? 0 : effVfxMode === 'subtle' ? 0.38 : 1.0;

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

      const chargeNorm = st.overdriveUsedThisRun && !st.overdriveActive
        ? 0
        : Math.max(0, Math.min(1, st.overdriveCharge / 100));

      // WebGL2 GLSL #version 300 es Swirling Anime Plasma Layer (progressive 0%->99%->100%)
      const glRes = glResRef.current;
      if (glRes && glCanvas) {
        const { gl } = glRes;
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (vfxScale > 0.01 && (st.overdriveActive || chargeNorm >= 0.03)) {
          const fadeOut = st.overdriveActive && st.overdriveTimeLeft < 0.9
            ? Math.max(0.12, st.overdriveTimeLeft / 0.9)
            : 1.0;
          const pRgb = hexToRgb01(theme.primary);
          const bRgb = hexToRgb01(theme.bright);
          const sRgb = hexToRgb01(theme.secondary);
          const eRgb = hexToRgb01(theme.edgeTick);

          gl.useProgram(glRes.program);
          gl.bindVertexArray(glRes.vao);
          gl.uniform1f(glRes.uTime, performance.now() * 0.001);
          gl.uniform2f(glRes.uResolution, glCanvas.width, glCanvas.height);
          gl.uniform2f(glRes.uCenter, cx * dpr, glCanvas.height - cy * dpr);
          gl.uniform1f(glRes.uBezelR, bezelOuterR * dpr);
          gl.uniform1f(glRes.uCharge, chargeNorm);
          gl.uniform1f(glRes.uActive, st.overdriveActive ? 1.0 : 0.0);
          gl.uniform1f(glRes.uVfxScale, vfxScale * fadeOut);
          gl.uniform1f(glRes.uBeatPulse, st.beatPulse);
          gl.uniform1f(glRes.uBass, st.bassEnergy);
          gl.uniform1f(glRes.uDir, st.direction);
          gl.uniform3f(glRes.uPrimary, pRgb[0], pRgb[1], pRgb[2]);
          gl.uniform3f(glRes.uBright, bRgb[0], bRgb[1], bRgb[2]);
          gl.uniform3f(glRes.uSecondary, sRgb[0], sRgb[1], sRgb[2]);
          gl.uniform3f(glRes.uEdgeTick, eRgb[0], eRgb[1], eRgb[2]);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.bindVertexArray(null);
        }
      }

      // =========================================================================
      // PROGRESSIVE CHARGING FLAME CORONA (5% -> 99% buildup before God Mode)
      // =========================================================================
      if (!st.overdriveActive && chargeNorm >= 0.04 && vfxScale > 0) {
        const animT = performance.now() * 0.001;
        const powCharge = Math.pow(chargeNorm, 1.15);
        const lickCount = Math.max(8, Math.round(8 + powCharge * 24));
        const chargeReach = maxR * (0.08 + powCharge * 0.56) * vfxScale;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Progressive warm back-halo around bezel
        const haloR = bezelOuterR + chargeReach * 1.45;
        const chargeHalo = ctx.createRadialGradient(cx, cy, bezelOuterR * 0.85, cx, cy, haloR);
        chargeHalo.addColorStop(0, `rgba(${theme.bgAccentRgb}, ${(0.12 + 0.32 * powCharge * vfxScale).toFixed(2)})`);
        chargeHalo.addColorStop(0.55, `rgba(${theme.bgAccentRgb}, ${(0.06 + 0.16 * powCharge * vfxScale).toFixed(2)})`);
        chargeHalo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = chargeHalo;
        ctx.fillRect(0, 0, width, height);

        // Swirling licking flames climbing outward as % rises
        for (let p = 0; p < lickCount; p++) {
          const cycle = (p / lickCount + animT * (0.3 + powCharge * 0.35 + (p % 3) * 0.05)) % 1;
          const ang = p * 2.21 + animT * (0.65 + powCharge * 0.9) * st.direction + cycle * 0.55 * st.direction;
          const dist = bezelOuterR * 0.97 + cycle * chargeReach * (0.75 + (p % 3) * 0.22);
          const px = cx + Math.cos(ang) * dist;
          const py = cy + Math.sin(ang) * dist;
          const pSize = (34 + powCharge * 66 + (p % 4) * 14) * (1 - cycle * 0.45) * (maxR / 210);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang + st.direction * 0.65);
          ctx.scale(1.4, 0.62);
          ctx.globalAlpha *= Math.sin(cycle * Math.PI) * (0.18 + powCharge * 0.38) * vfxScale;
          ctx.drawImage(sprites.flame, -pSize * 0.5, -pSize * 0.5, pSize, pSize);
          ctx.restore();
        }

        // Emerging spark glints when >= 45%
        if (chargeNorm >= 0.42) {
          const sparkN = Math.round(6 + powCharge * 12);
          for (let s = 0; s < sparkN; s++) {
            const cycle = (s / sparkN + animT * 0.48) % 1;
            const ang = s * 2.39996 + animT * 0.7 * st.direction;
            const dist = bezelOuterR + 6 + cycle * chargeReach * 1.1;
            const sx = cx + Math.cos(ang) * dist;
            const sy = cy + Math.sin(ang) * dist;
            const sz = (10 + powCharge * 14) * (1 - cycle * 0.4);
            ctx.save();
            ctx.globalAlpha *= Math.sin(cycle * Math.PI) * powCharge * 0.75 * vfxScale;
            ctx.drawImage(sprites.star, sx - sz * 0.5, sy - sz * 0.5, sz, sz);
            ctx.restore();
          }
        }

        // Progressive bezel charge ring indicator
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha *= (0.45 + 0.45 * powCharge) * vfxScale;
        ctx.beginPath();
        ctx.arc(cx, cy, bezelOuterR + 4, -Math.PI / 2, -Math.PI / 2 + TAU * chargeNorm);
        ctx.strokeStyle = chargeNorm > 0.8 ? '#ffffff' : theme.edgeTick;
        ctx.lineWidth = 2.2 + powCharge * 2.2;
        ctx.stroke();

        ctx.restore();
      }

      // =========================================================================
      // GOD-MODE ANIME OVERDRIVE AURORA & VOLUMETRIC PLASMA ERUPTION
      // =========================================================================
      if (st.overdriveActive && vfxScale > 0) {
        const animT = performance.now() * 0.001;
        const lifeFrac = Math.min(1, st.overdriveTimeLeft / 10.0);
        const igniteBoost = st.overdriveTimeLeft > 9.25 ? 1 + (st.overdriveTimeLeft - 9.25) * 1.35 : 1;
        const fadeOut = st.overdriveTimeLeft < 0.9 ? Math.max(0.12, st.overdriveTimeLeft / 0.9) : 1;
        const odEnergy = (0.86 + st.beatPulse * 0.28 + st.bassEnergy * 0.24) * igniteBoost * fadeOut * (0.55 + 0.45 * vfxScale);

        ctx.save();

        // 1. Atmospheric Outer Edge Plasma Vignette (makes edges burn without washing out center)
        if (effVfxMode === 'full') {
          const stageMax = Math.hypot(width, height) * 0.56;
          const outerVignette = ctx.createRadialGradient(cx, cy, bezelOuterR * 1.15, cx, cy, stageMax);
          outerVignette.addColorStop(0, 'rgba(0,0,0,0)');
          outerVignette.addColorStop(0.55, `rgba(${theme.bgAccentRgb}, ${(0.18 * fadeOut).toFixed(2)})`);
          outerVignette.addColorStop(1, `rgba(${theme.bgAccentRgb}, ${(0.42 * fadeOut).toFixed(2)})`);
          ctx.fillStyle = outerVignette;
          ctx.fillRect(0, 0, width, height);
        }

        // 2. Volumetric Additive Back-Bloom Halo
        ctx.globalCompositeOperation = 'lighter';
        const auraReach = Math.max(bezelOuterR * 2.5, Math.min(width, height) * 0.85) * Math.min(1.22, odEnergy);
        const arenaGlow = ctx.createRadialGradient(cx, cy, bezelOuterR * 0.72, cx, cy, auraReach);
        arenaGlow.addColorStop(0, `rgba(${theme.bgAccentRgb}, ${(0.52 * fadeOut).toFixed(2)})`);
        arenaGlow.addColorStop(0.32, `rgba(${theme.bgAccentRgb}, ${(0.32 * fadeOut).toFixed(2)})`);
        arenaGlow.addColorStop(0.68, `${theme.secondary}28`);
        arenaGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = arenaGlow;
        ctx.fillRect(0, 0, width, height);

        // 3. Swirling Volumetric Flame Sprites (outer wide layer)
        const plumeCount = 40;
        for (let p = 0; p < plumeCount; p++) {
          const cycle = (p / plumeCount + animT * (0.28 + (p % 4) * 0.06)) % 1;
          const swirlAngle = (p * 1.71 + animT * (0.95 + (p % 3) * 0.25) * st.direction) + cycle * 0.85 * st.direction;
          const dist = bezelOuterR * 0.96 + Math.pow(cycle, 0.82) * maxR * (0.98 + (p % 3) * 0.28) * odEnergy;
          const px = cx + Math.cos(swirlAngle) * dist;
          const py = cy + Math.sin(swirlAngle) * dist;
          const pSize = (110 + (p % 5) * 34) * (1.05 - cycle * 0.45) * (maxR / 210);
          const alpha = Math.sin(cycle * Math.PI) * (0.42 + (p % 2) * 0.16) * fadeOut;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(swirlAngle + st.direction * 0.6);
          ctx.scale(1.45, 0.72);
          ctx.globalAlpha *= Math.max(0, alpha);
          ctx.drawImage(sprites.flame, -pSize * 0.5, -pSize * 0.5, pSize, pSize);
          ctx.restore();
        }

        // 4. Dark Ember Contrast Smoke Cutouts (gives fiery anime silhouette depth)
        ctx.globalCompositeOperation = 'source-over';
        const voidCount = 26;
        for (let v = 0; v < voidCount; v++) {
          const cycle = (v / voidCount + animT * (0.24 + (v % 3) * 0.07)) % 1;
          const ang = v * 2.13 + animT * (0.78 + (v % 2) * 0.22) * st.direction + cycle * 0.65 * st.direction;
          const dist = bezelOuterR * 1.04 + cycle * maxR * (0.85 + (v % 3) * 0.22);
          const vx = cx + Math.cos(ang) * dist;
          const vy = cy + Math.sin(ang) * dist;
          const vSize = (92 + (v % 4) * 28) * (1 - cycle * 0.35) * (maxR / 210);
          const vAlpha = Math.sin(cycle * Math.PI) * 0.62 * fadeOut;

          ctx.save();
          ctx.translate(vx, vy);
          ctx.rotate(ang + 0.4);
          ctx.scale(1.3, 0.78);
          ctx.globalAlpha *= Math.max(0, vAlpha);
          ctx.drawImage(sprites.voidCloud, -vSize * 0.5, -vSize * 0.5, vSize, vSize);
          ctx.restore();
        }

        // 5. Blazing Inner Flame Plumes & Razor Scythe Ribbons (over cutouts)
        ctx.globalCompositeOperation = 'lighter';
        const innerPlumeCount = 28;
        for (let p = 0; p < innerPlumeCount; p++) {
          const cycle = (p / innerPlumeCount + animT * (0.42 + (p % 3) * 0.1)) % 1;
          const ang = p * 2.39 + animT * 1.35 * st.direction + cycle * 0.72 * st.direction;
          const dist = bezelOuterR * 0.98 + cycle * maxR * (0.64 + (p % 3) * 0.18) * odEnergy;
          const px = cx + Math.cos(ang) * dist;
          const py = cy + Math.sin(ang) * dist;
          const pSize = (78 + (p % 4) * 24) * (1 - cycle * 0.5) * (maxR / 210);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang + st.direction * 0.85);
          ctx.scale(1.65, 0.58);
          ctx.globalAlpha *= Math.sin(cycle * Math.PI) * 0.54 * fadeOut;
          ctx.drawImage(sprites.flame, -pSize * 0.5, -pSize * 0.5, pSize, pSize);
          ctx.restore();
        }

        const scytheCount = 10;
        for (let k = 0; k < scytheCount; k++) {
          const baseAng = (k / scytheCount) * TAU + animT * (1.7 + (k % 2) * 0.45) * st.direction;
          const swirlSpan = 1.12 + Math.sin(animT * 3.4 + k) * 0.22;
          const rInner = bezelOuterR + 2 + (k % 3) * 4;
          const rMid = bezelOuterR + maxR * (0.38 + (k % 3) * 0.14) * odEnergy;
          const rTip = bezelOuterR + maxR * (0.72 + (k % 2) * 0.28) * odEnergy;
          const dirSign = st.direction;

          const p0x = cx + Math.cos(baseAng) * rInner;
          const p0y = cy + Math.sin(baseAng) * rInner;
          const p1x = cx + Math.cos(baseAng + dirSign * swirlSpan * 0.52) * rMid;
          const p1y = cy + Math.sin(baseAng + dirSign * swirlSpan * 0.52) * rMid;
          const tipAng = baseAng + dirSign * swirlSpan;
          const pTipX = cx + Math.cos(tipAng) * rTip;
          const pTipY = cy + Math.sin(tipAng) * rTip;
          const pInnerCtrlX = cx + Math.cos(baseAng + dirSign * swirlSpan * 0.46) * (rMid * 0.86);
          const pInnerCtrlY = cy + Math.sin(baseAng + dirSign * swirlSpan * 0.46) * (rMid * 0.86);

          const scGrad = ctx.createLinearGradient(p0x, p0y, pTipX, pTipY);
          scGrad.addColorStop(0, '#ffffff');
          scGrad.addColorStop(0.35, k % 2 === 0 ? theme.edgeTick : theme.bright);
          scGrad.addColorStop(0.8, theme.primary);
          scGrad.addColorStop(1, 'rgba(0,0,0,0)');

          ctx.save();
          ctx.globalAlpha *= (0.45 + (k % 2) * 0.18) * fadeOut;
          ctx.beginPath();
          ctx.moveTo(p0x, p0y);
          ctx.quadraticCurveTo(p1x, p1y, pTipX, pTipY);
          ctx.quadraticCurveTo(pInnerCtrlX, pInnerCtrlY, p0x, p0y);
          ctx.closePath();
          ctx.fillStyle = scGrad;
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(p0x, p0y);
          ctx.quadraticCurveTo(p1x, p1y, pTipX, pTipY);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.restore();
        }

        // 6. Crackling Electric Plasma Filaments
        for (let arcIdx = 0; arcIdx < 6; arcIdx++) {
          const arcStart = (arcIdx / 6) * TAU - animT * 2.6 * st.direction + Math.sin(animT * 7 + arcIdx) * 0.3;
          const arcLen = 0.58 + (arcIdx % 2) * 0.35;
          const arcR = bezelOuterR + 12 + (arcIdx % 3) * 14 + st.beatPulse * 6;
          ctx.save();
          ctx.globalAlpha *= 0.72 * fadeOut;
          ctx.beginPath();
          const segs = 12;
          for (let j = 0; j <= segs; j++) {
            const f = j / segs;
            const a = arcStart + f * arcLen;
            const jitter = Math.sin(animT * 42 + j * 4.7 + arcIdx * 2.1) * (4 + st.beatPulse * 3);
            const px = cx + Math.cos(a) * (arcR + jitter);
            const py = cy + Math.sin(a) * (arcR + jitter);
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = arcIdx % 2 === 0 ? '#ffffff' : theme.edgeTick;
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.restore();
        }

        // 7. Blinding Double Corona Ring around Bezel
        ctx.save();
        ctx.globalAlpha *= 0.9 * fadeOut;
        ctx.beginPath();
        ctx.arc(cx, cy, bezelOuterR + 4, 0, TAU);
        ctx.strokeStyle = theme.bright;
        ctx.lineWidth = 9;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, bezelOuterR + 2, 0, TAU);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.restore();

        // 8. Full-Span Anamorphic Optical Cross-Flare Beams + Cardinal Flare Star Sprites
        const beamH = Math.max(width * 0.52, maxR * 1.9) * (0.96 + st.beatPulse * 0.1) * vfxScale;
        const beamV = Math.max(height * 0.5, maxR * 1.45) * (0.96 + st.beatPulse * 0.1) * vfxScale;
        ctx.save();
        ctx.globalAlpha *= 0.92 * fadeOut * vfxScale;
        drawAnamorphicBeam(ctx, cx, cy, 0, beamH, 3.6, theme.bright, theme.secondary);
        drawAnamorphicBeam(ctx, cx, cy, Math.PI / 2, beamV, 4.2, theme.primary, theme.edgeTick);

        const flareNodes = [
          { ang: 0, dist: bezelOuterR + 18, sz: 42 },
          { ang: Math.PI, dist: bezelOuterR + 18, sz: 42 },
          { ang: -Math.PI / 2, dist: bezelOuterR + 20, sz: 54 },
          { ang: Math.PI / 2, dist: bezelOuterR + 20, sz: 54 },
        ];
        flareNodes.forEach((fn) => {
          const fx = cx + Math.cos(fn.ang) * fn.dist;
          const fy = cy + Math.sin(fn.ang) * fn.dist;
          const s = fn.sz * (1 + st.beatPulse * 0.22) * (0.65 + 0.35 * vfxScale);
          ctx.drawImage(sprites.star, fx - s * 0.5, fy - s * 0.5, s, s);
        });
        ctx.restore();

        // 9. Orbiting Glowing Star Sprites & Rising Ember Dust
        const sparkCount = effVfxMode === 'subtle' ? 18 : 44;
        for (let e = 0; e < sparkCount; e++) {
          const cycle = (e / sparkCount + animT * (0.42 + (e % 4) * 0.14)) % 1;
          const ang = (e * 2.39996 + animT * 0.85 * st.direction) % TAU;
          const radialDist = bezelOuterR + 10 + cycle * maxR * (0.88 + (e % 4) * 0.22) * (0.55 + 0.45 * vfxScale);
          const sx = cx + Math.cos(ang) * radialDist;
          const sy = cy + Math.sin(ang) * radialDist;
          const alpha = Math.sin(cycle * Math.PI) * fadeOut * (0.5 + 0.5 * vfxScale);
          ctx.save();
          ctx.globalAlpha *= Math.max(0, alpha);
          if (e % 4 === 0) {
            const starSize = (1 - cycle * 0.35) * (e % 8 === 0 ? 34 : 22) * (0.65 + 0.35 * vfxScale);
            ctx.translate(sx, sy);
            ctx.rotate(animT * 1.4 + e);
            ctx.drawImage(sprites.star, -starSize * 0.5, -starSize * 0.5, starSize, starSize);
          } else {
            ctx.beginPath();
            ctx.arc(sx, sy, (1 - cycle * 0.4) * (e % 2 === 0 ? 3.2 : 1.9), 0, TAU);
            ctx.fillStyle = e % 3 === 0 ? '#ffffff' : theme.edgeTick;
            ctx.fill();
          }
          ctx.restore();
        }

        // Countdown halo arc around outer bezel perimeter
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha *= 0.92 * fadeOut;
        ctx.beginPath();
        ctx.arc(cx, cy, bezelOuterR + 17, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.02, lifeFrac));
        ctx.strokeStyle = theme.edgeTick;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
      }

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
          ctx.strokeStyle = st.overdriveActive
            ? mag > 0.45
              ? '#ffffff'
              : theme.bright
            : mag > 0.65
            ? streakTier >= 2
              ? '#fbbf24'
              : theme.bright
            : `rgba(${theme.bgAccentRgb}, ${(0.28 + mag * 0.5).toFixed(2)})`;
          ctx.lineWidth = st.overdriveActive ? 2.4 : 2;
          ctx.stroke();
        }
      }

      // Outer Song Progress Ring Arc
      const progR = bezelOuterR + 11;
      ctx.beginPath();
      ctx.arc(cx, cy, progR, 0, TAU);
      ctx.strokeStyle = st.overdriveActive ? `rgba(${theme.bgAccentRgb}, 0.4)` : '#1b2230';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (st.songProgressRatio > 0.002) {
        ctx.beginPath();
        ctx.arc(cx, cy, progR, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, st.songProgressRatio));
        ctx.strokeStyle = st.overdriveActive ? '#ffffff' : streakTier >= 2 ? '#fbbf24' : theme.bright;
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
        ctx.strokeStyle = st.overdriveActive
          ? isMajor
            ? '#ffffff'
            : theme.edgeTick
          : isMajor
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
          const rRing = bezelOuterR + 4 + prog * maxR * 0.34;
          ctx.save();
          ctx.globalAlpha *= alpha;
          ctx.beginPath();
          ctx.arc(cx, cy, rRing, 0, TAU);
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = 2.6 * (1 - prog * 0.5);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Solid Tactile Bezel Body (deep #07080d core keeps track razor sharp inside Overdrive flames)
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR, 0, TAU);
      ctx.fillStyle = '#07080d';
      ctx.fill();
      if (st.overdriveActive) {
        const innerTint = ctx.createRadialGradient(cx, cy, bezelOuterR * 0.2, cx, cy, bezelOuterR);
        innerTint.addColorStop(0, 'rgba(7, 8, 13, 0.96)');
        innerTint.addColorStop(0.76, `rgba(${theme.bgAccentRgb}, 0.14)`);
        innerTint.addColorStop(1, `rgba(${theme.bgAccentRgb}, 0.26)`);
        ctx.beginPath();
        ctx.arc(cx, cy, bezelOuterR, 0, TAU);
        ctx.fillStyle = innerTint;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR, 0, TAU);
      ctx.strokeStyle = st.overdriveActive
        ? '#ffffff'
        : st.lessonSlowActive
        ? '#fde047'
        : isIlluminated
        ? theme.bright
        : streakTier >= 2
        ? '#fbbf24'
        : '#2e3545';
      ctx.lineWidth = st.overdriveActive ? 2.8 : st.lessonSlowActive ? 2.2 : 1.4;
      ctx.stroke();

      // Track Channel
      ctx.beginPath();
      ctx.arc(cx, cy, trackRadius, 0, TAU);
      ctx.strokeStyle = '#07080d';
      ctx.lineWidth = trackWidth;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, TAU);
      ctx.strokeStyle = st.overdriveActive ? theme.bright : '#1f2430';
      ctx.lineWidth = st.overdriveActive ? 1.6 : 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, TAU);
      ctx.strokeStyle = st.overdriveActive
        ? theme.edgeTick
        : streakTier >= 2
        ? '#374052'
        : '#1f2430';
      ctx.lineWidth = st.overdriveActive ? 1.4 : 1;
      ctx.stroke();

      // Speed Trail behind Needle (Blazing Theme-Colored Plasma Fire Trail during Overdrive)
      if (st.phase === 'PLAYING' || st.phase === 'TUTORIAL_CINEMATIC') {
        const trailCount = st.overdriveActive ? 7 : 4;
        const trailStep = st.overdriveActive ? 0.088 : st.waveModeId === 'PURPLE_SURGE' ? 0.095 : 0.068;
        const odPalette = [
          theme.dim,
          theme.trailSteps[1],
          theme.trailSteps[2],
          theme.primary,
          theme.bright,
          theme.secondary,
          '#ffffff',
        ];
        for (let t = trailCount; t >= 1; t--) {
          const aStart = st.spinnerAngle - st.direction * (t * trailStep);
          const aEnd = st.spinnerAngle - st.direction * ((t - 1) * trailStep);
          ctx.beginPath();
          ctx.arc(cx, cy, trackRadius, aStart, aEnd, st.direction === -1);
          ctx.strokeStyle = st.overdriveActive
            ? odPalette[trailCount - t]
            : st.waveModeId === 'PURPLE_SURGE'
            ? `rgba(168, 85, 247, ${(0.12 * (5 - t)).toFixed(2)})`
            : theme.trailSteps[4 - t];
          ctx.lineWidth = trackWidth - (st.overdriveActive ? 4 : 6);
          ctx.stroke();
        }
      }

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

      // Target Sectors (Per-target mode color for stacked gametypes, Hold Arc Ribbons, & Fever Spinners)
      const firstOrderedIdx = st.targets.findIndex(
        (x) => (x.modeId || st.waveModeId) === 'ORDERED_SEQ',
      );
      for (let i = 0; i < st.targets.length; i++) {
        const t = st.targets[i];
        const targetModeId = t.modeId || st.waveModeId;
        const targetModeMeta = WAVE_MODES.find((m) => m.id === targetModeId) || WAVE_MODES[0];
        const targetColor = targetModeMeta.color;

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

          // Full Hold Tail Ribbon Backdrop
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

          // Filled active sweep portion while holding
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

          // Head Sector Cap
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

        // 3. Standard & Variant Target Sectors (each stacked target uses its own targetModeMeta color!)
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
        const seqBlocked =
          targetModeId === 'ORDERED_SEQ' && firstOrderedIdx !== -1 && i > firstOrderedIdx;
        const sectorAlpha = Math.max(0.06, Math.min(1, t.alpha * (seqBlocked ? 0.55 : 1)));

        ctx.save();
        ctx.globalAlpha *= sectorAlpha;

        // Outer Hit Window
        ctx.beginPath();
        ctx.arc(cx, cy, trackRadius, a0, a1);
        ctx.strokeStyle = activeThis ? '#ffffff' : t.isMeteorEcho ? '#fb923c' : targetColor;
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

        // Approach Timing Halo
        if (st.phase === 'PLAYING' && t.targetHitTime && st.songTime <= t.targetHitTime && !seqBlocked) {
          const timeToHit = t.targetHitTime - st.songTime;
          if (timeToHit > 0.01 && timeToHit <= 1.05) {
            const ratio = Math.min(1, timeToHit / 1.05);
            const approachR = outerRadius + ratio * 22;
            ctx.beginPath();
            ctx.arc(cx, cy, approachR, a0, a1);
            ctx.strokeStyle = timeToHit <= 0.14 ? '#fde047' : targetColor;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        // Center Bullseye Line
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(t.angle) * (innerRadius + 2), cy + Math.sin(t.angle) * (innerRadius + 2));
        ctx.lineTo(cx + Math.cos(t.angle) * (outerRadius - 2), cy + Math.sin(t.angle) * (outerRadius - 2));
        ctx.strokeStyle = inPerfectNow ? '#fde047' : '#ffffff';
        ctx.lineWidth = inPerfectNow ? 2.6 : 2;
        ctx.stroke();

        // Directional Arrowhead Tip indicating CW vs CCW sweep polarity
        if (st.phase === 'PLAYING' && !seqBlocked) {
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

      ctx.beginPath();
      ctx.arc(cx, cy, gaugeR, gaugeCenter - perfBracketHalf, gaugeCenter + perfBracketHalf);
      ctx.strokeStyle = st.overdriveActive ? `${theme.bright}88` : 'rgba(253, 224, 71, 0.45)';
      ctx.lineWidth = 4;
      ctx.stroke();

      [gaugeCenter - perfBracketHalf, gaugeCenter + perfBracketHalf].forEach((bA) => {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(bA) * (gaugeR - 4), cy + Math.sin(bA) * (gaugeR - 4));
        ctx.lineTo(cx + Math.cos(bA) * (gaugeR + 4), cy + Math.sin(bA) * (gaugeR + 4));
        ctx.strokeStyle = st.overdriveActive ? '#ffffff' : '#fde047';
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
      const hubActive = isIlluminated || st.hubStatusTimer > 0 || st.overdriveActive;
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, TAU);
      ctx.fillStyle = isFailed ? '#1f0b0e' : hubActive ? theme.hubActiveFill : '#090b12';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, TAU);
      ctx.strokeStyle = isFailed
        ? '#ef4444'
        : st.overdriveActive
        ? '#ffffff'
        : hubActive
        ? theme.bright
        : streakTier >= 2
        ? '#fbbf24'
        : '#273044';
      ctx.lineWidth = st.overdriveActive ? 2.2 : hubActive ? 1.6 : 1;
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
          ctx.fillStyle = st.overdriveActive ? theme.edgeTick : streakTier >= 2 ? '#fbbf24' : '#f3f4f6';
          ctx.font = '900 18px "JetBrains Mono", monospace';
          ctx.fillText(`${st.streak}x`, cx, cy + 8);
        } else {
          ctx.fillStyle = st.activeLesson
            ? '#fde047'
            : st.overdriveActive
            ? theme.bright
            : st.direction === 1
            ? '#34d399'
            : '#f87171';
          ctx.font = '800 10px "JetBrains Mono", monospace';
          const dirLabel = st.activeLesson ? 'GUIDE ACTIVE' : st.direction === 1 ? 'CW ↻' : 'CCW ↺';
          ctx.fillText(dirLabel, cx, cy - 10);
          ctx.fillStyle = st.overdriveActive ? '#ffffff' : streakTier >= 2 ? '#fbbf24' : '#f3f4f6';
          ctx.font = '900 18px "JetBrains Mono", monospace';
          ctx.fillText(`${st.streak}x`, cx, cy + 8);
        }
      } else {
        ctx.fillStyle = '#a1abbe';
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillText(st.phase === 'PAUSED' ? 'PAUSED' : 'READY', cx, cy);
      }

      // Needle Arm & Pointer (Glowing Plasma Blade in Overdrive)
      const sa = st.spinnerAngle;
      const cosA = Math.cos(sa);
      const sinA = Math.sin(sa);
      ctx.beginPath();
      ctx.moveTo(cx + cosA * hubRadius, cy + sinA * hubRadius);
      ctx.lineTo(cx + cosA * (innerRadius - 1), cy + sinA * (innerRadius - 1));
      ctx.strokeStyle = isFailed ? '#ef4444' : st.overdriveActive ? theme.bright : '#374052';
      ctx.lineWidth = st.overdriveActive ? 2.6 : 2;
      ctx.stroke();

      const needleColor = isFailed ? '#ef4444' : '#ffffff';
      if (st.overdriveActive) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.moveTo(cx + cosA * (innerRadius - 6), cy + sinA * (innerRadius - 6));
        ctx.lineTo(cx + cosA * (outerRadius + 10), cy + sinA * (outerRadius + 10));
        ctx.strokeStyle = theme.bright;
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(cx + cosA * (innerRadius - 5), cy + sinA * (innerRadius - 5));
      ctx.lineTo(cx + cosA * (outerRadius + 5), cy + sinA * (outerRadius + 5));
      ctx.strokeStyle = needleColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      const tipBaseR = outerRadius + 8;
      const tipPeakR = outerRadius + (st.overdriveActive ? 17 : 14);
      const perpX = -sinA * 4.5;
      const perpY = cosA * 4.5;
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
  }, [bgFxMode, overdriveVfxMode, renderStateRef, themeId]);

  const hpClamped = Math.max(0, Math.min(100, hp));
  const hpColor = hpClamped > 55 ? '#34d399' : hpClamped > 25 ? '#fbbf24' : '#ef4444';
  const displayTime = dragSec !== null ? dragSec : songTime;
  const progressPct = Math.max(0, Math.min(100, (displayTime / Math.max(0.1, songDurationSec)) * 100));
  const isProTransportActive = isPracticeMode || isReplayMode;

  const pressEvents = isReplayMode
    ? replayEvents.filter((ev) => ev.action === 'PRESS')
    : [];

  // Live synced alternating k1 / k2 keycap highlight during active Replay playback (including holds)
  let replayK1 = false;
  let replayK2 = false;
  if (isReplayMode && !replayPaused && replayEvents.length > 0) {
    let lastPressIdx = -1;
    let isHoldActive = false;
    for (let i = 0; i < replayEvents.length; i++) {
      const ev = replayEvents[i];
      if (ev.songTime > songTime + 0.085) break;
      if (ev.action === 'PRESS') {
        lastPressIdx += 1;
        if (Math.abs(ev.songTime - songTime) <= 0.085) {
          if (lastPressIdx % 2 === 0) replayK1 = true;
          else replayK2 = true;
        }
        isHoldActive = true;
      } else if (ev.action === 'RELEASE' && ev.songTime <= songTime) {
        isHoldActive = false;
      }
    }
    if (isHoldActive && lastPressIdx >= 0) {
      if (lastPressIdx % 2 === 0) replayK1 = true;
      else replayK2 = true;
    }
  }

  // Hover inspector nearest Replay event
  const hoveredReplayEvent =
    isReplayMode && scrubHover && pressEvents.length > 0
      ? pressEvents.reduce<ReplayInputEvent | null>((best, ev) => {
          const dist = Math.abs(ev.songTime - scrubHover.sec);
          if (dist > Math.max(1.2, songDurationSec * 0.025)) return best;
          if (!best || dist < Math.abs(best.songTime - scrubHover.sec)) return ev;
          return best;
        }, null)
      : null;

  const stepReplayEvent = (dir: -1 | 1) => {
    if (!pressEvents.length) return;
    if (dir === -1) {
      const prev = [...pressEvents].reverse().find((ev) => ev.songTime < songTime - 0.18);
      onReplaySeek(prev ? Math.max(0, prev.songTime - 0.06) : 0, false);
    } else {
      const next = pressEvents.find((ev) => ev.songTime > songTime + 0.12);
      if (next) onReplaySeek(Math.max(0, next.songTime - 0.06), false);
    }
  };

  const k1Lit = pressedKey === 'k1' || replayK1;
  const k2Lit = pressedKey === 'k2' || replayK2;

  return (
    <div className="relative z-10 flex flex-1 w-full flex-col overflow-hidden px-3 py-2.5 sm:px-6 sm:py-3">
      {/* Unobtrusive Corner HUD — Top Row */}
      <div className="pointer-events-none relative z-20 flex w-full items-start justify-between gap-4">
        {/* Top-Left: Score + HP Integrity Bar + Theme-Colored Overdrive Bar */}
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

          {!isTutorialRun && (
            <div className="mt-2 space-y-1.5">
              {/* Integrity Bar */}
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-36 sm:w-44 overflow-hidden bg-white/10">
                  <div
                    className="h-full transition-all duration-150"
                    style={{ width: `${hpClamped}%`, backgroundColor: hpColor }}
                  />
                </div>
                <span className="tabular-nums text-[10px] font-bold text-[#b6bfd1]">
                  {isPracticeMode ? 'PRAC' : noFailActive ? 'NF' : `${Math.round(hpClamped)}%`}
                </span>
              </div>

              {/* Theme-Colored Once-Per-Run Overdrive Meter (45% of Chart Perfects) */}
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-36 sm:w-44 overflow-hidden transition-all"
                  style={{
                    backgroundColor: overdriveActive
                      ? `rgba(${activeTheme.bgAccentRgb}, 0.28)`
                      : 'rgba(255,255,255,0.09)',
                    boxShadow: overdriveActive
                      ? `0 0 14px rgba(${activeTheme.bgAccentRgb}, 0.8), inset 0 0 0 1px ${activeTheme.edgeTick}`
                      : undefined,
                  }}
                >
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${
                        overdriveUsed && !overdriveActive
                          ? 100
                          : Math.max(0, Math.min(100, overdriveCharge))
                      }%`,
                      background: overdriveActive
                        ? `linear-gradient(90deg, ${activeTheme.primary}, ${activeTheme.bright}, #ffffff)`
                        : overdriveUsed
                        ? 'rgba(148,163,184,0.22)'
                        : `linear-gradient(90deg, ${activeTheme.primary}, ${activeTheme.bright})`,
                    }}
                  />
                </div>
                <span
                  className="tabular-nums text-[10px] font-black tracking-wide whitespace-nowrap"
                  style={{
                    color: overdriveActive
                      ? activeTheme.edgeTick
                      : overdriveUsed
                      ? '#64748b'
                      : activeTheme.bright,
                  }}
                >
                  {overdriveActive
                    ? `OVERDRIVE 2× · ${overdriveTimeLeft.toFixed(1)}s`
                    : overdriveUsed
                    ? 'OD SPENT'
                    : `${Math.round(overdriveCharge)}% · ${overdrivePerfectsEarned}/${overdriveTargetPerfects} PERF`}
                  {overdriveVfxMode === 'off' ? ' · VFX OFF' : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Minimal Uncluttered Status */}
        <div className="pointer-events-auto flex items-center gap-3 shrink-0">
          {isReplayMode && replayLastClickLabel && (
            <span className="hidden sm:inline text-[11px] font-extrabold tracking-wide text-[#e9d5ff] tabular-nums whitespace-nowrap">
              {replayLastClickLabel}
            </span>
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

      {/* Tutorial Lesson Banner */}
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
          pointerDownInsideRef.current = true;
          onTriggerPress(e.timeStamp);
        }}
        onPointerUp={(e) => {
          if (!allowPointerTap) return;
          if (pointerDownInsideRef.current) {
            pointerDownInsideRef.current = false;
            onTriggerRelease(e.timeStamp);
          }
        }}
        onPointerLeave={(e) => {
          if (!allowPointerTap) return;
          if (pointerDownInsideRef.current) {
            pointerDownInsideRef.current = false;
            onTriggerRelease(e.timeStamp);
          }
        }}
        onPointerCancel={(e) => {
          if (!allowPointerTap) return;
          if (pointerDownInsideRef.current) {
            pointerDownInsideRef.current = false;
            onTriggerRelease(e.timeStamp);
          }
        }}
        className="relative flex-1 w-full cursor-pointer select-none min-h-0"
      >
        <canvas
          ref={glCanvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 block h-full w-full"
        />
        <canvas ref={canvasRef} className="relative z-[1] block h-full w-full" />

        {phase === 'IDLE' && !isReplayMode && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="lazer-slant-sm border border-white/15 bg-[#0e111a]/92 px-6 py-2 text-xs font-bold text-white">
              <span className="lazer-unslant-sm block">{promptHint}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Zone: 1:1 Chamfered Neon-Framed Pro Transport Console (Practice & Replay) OR Clean Corner HUD */}
      {isProTransportActive ? (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative z-20 mx-auto mt-1 w-full max-w-[1380px] border bg-[#090710]/94 backdrop-blur-md"
          style={{
            borderColor: activeTheme.primary,
            boxShadow: `0 -6px 32px rgba(0, 0, 0, 0.78), 0 0 18px rgba(${activeTheme.bgAccentRgb}, 0.28)`,
          }}
        >
          {/* Neon top edge accent highlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, ${activeTheme.bright}, ${activeTheme.primary}, ${activeTheme.secondary})`,
            }}
          />

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-2.5 px-2.5 py-1.5 text-xs">
            {/* Left Chamfered Combo + Mode Cell (Matches 1:1 Mockup) */}
            <div
              className="relative flex items-center pr-5 pl-2.5 py-1 shrink-0 tabular-nums"
              style={{
                background: `linear-gradient(115deg, rgba(${activeTheme.bgAccentRgb}, 0.20) 0%, rgba(12, 10, 22, 0.85) 86%)`,
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
                borderRight: `2px solid ${activeTheme.bright}`,
              }}
            >
              <div>
                <div className="flex items-center gap-1.5 text-[10px] leading-tight text-[#d1d5db]">
                  <span>
                    Combo: {streak} ({streakMult.toFixed(2)}x)
                  </span>
                  <span className="text-white/30">·</span>
                  <span
                    className="flex items-center gap-1 font-extrabold"
                    style={{ color: isReplayMode ? '#d8b4fe' : '#fbbf24' }}
                  >
                    <OrbIcon className="h-3 w-3" />
                    <span>{isReplayMode ? replayLabel : 'Unranked'}</span>
                  </span>
                </div>
                <div
                  className="font-display text-xl sm:text-2xl font-black leading-none mt-0.5 tracking-tight"
                  style={{ color: overdriveActive ? activeTheme.edgeTick : '#ffffff' }}
                >
                  {streak}x
                </div>
              </div>
            </div>

            {/* Metallic Bevel-Framed Transport Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={isReplayMode ? onToggleReplayPause : onTogglePracticePause}
                className="tactile-btn flex items-center gap-1.5 border border-white/25 bg-[#161926] px-3 py-1.5 font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
              >
                {(isReplayMode ? replayPaused : practicePaused) ? (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Play</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    <span>Pause</span>
                  </>
                )}
              </button>

              {isPracticeMode ? (
                <>
                  <button
                    type="button"
                    onClick={onDropCheckpoint}
                    className="tactile-btn flex items-center gap-1 border border-[#34d399]/45 bg-[#0d1f1a] px-2.5 py-1.5 font-bold text-[#34d399] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-[#34d399] cursor-pointer whitespace-nowrap"
                    title="Drop Checkpoint (Z)"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Drop (Z)</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveCheckpoint}
                    disabled={practiceCheckpoints.length === 0}
                    className="tactile-btn flex items-center gap-1 border border-white/20 bg-[#141824] px-2.5 py-1.5 font-bold text-[#e2e8f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-white/40 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    title="Remove Last Checkpoint (X)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Del (X)</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRespawnCheckpoint}
                    className="tactile-btn flex items-center gap-1 border border-white/22 bg-[#161b2a] px-2.5 py-1.5 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:border-[var(--accent-bright)] cursor-pointer whitespace-nowrap"
                    title="Respawn at Checkpoint / Start Pos (C)"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>
                      {practiceCheckpoints.length > 0 ? `CP (${practiceCheckpoints.length})` : 'Respawn (C)'}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => stepReplayEvent(-1)}
                    disabled={pressEvents.length === 0}
                    className="tactile-btn flex items-center border border-white/20 bg-[#141824] px-2.5 py-1.5 font-bold text-[#e5e7eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-[#c084fc] disabled:opacity-35 cursor-pointer"
                    title="Previous Recorded Input"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepReplayEvent(1)}
                    disabled={pressEvents.length === 0}
                    className="tactile-btn flex items-center border border-white/20 bg-[#141824] px-2.5 py-1.5 font-bold text-[#e5e7eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-[#c084fc] disabled:opacity-35 cursor-pointer"
                    title="Next Recorded Input"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReplaySeek(0, false)}
                    className="tactile-btn flex items-center gap-1 border border-white/22 bg-[#161b2a] px-2.5 py-1.5 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:border-[#c084fc] cursor-pointer whitespace-nowrap"
                    title="Restart Replay (R)"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[#c084fc]" />
                    <span className="hidden sm:inline">Reset (R)</span>
                  </button>
                </>
              )}
            </div>

            {/* Precision Interactive Timeline Scrubber */}
            <div className="flex min-w-[160px] flex-1 items-center gap-2.5">
              <span className="tabular-nums text-[11px] font-bold text-[#e5e7eb] whitespace-nowrap shrink-0">
                {formatTimeSec(displayTime)} <span className="text-[#64748b]">/</span>{' '}
                {formatTimeSec(songDurationSec)}
              </span>

              <div
                ref={scrubberRef}
                role="slider"
                aria-label={isReplayMode ? 'Replay Timeline Scrubber' : 'Practice Timeline Scrubber'}
                aria-valuemin={0}
                aria-valuemax={Math.round(songDurationSec)}
                aria-valuenow={Math.round(displayTime)}
                tabIndex={0}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  isScrubbingRef.current = true;
                  const info = computeScrubTime(e.clientX);
                  setScrubHover(info);
                  applyScrubAt(e.clientX, true);
                }}
                onPointerMove={(e) => {
                  setScrubHover(computeScrubTime(e.clientX));
                }}
                onPointerLeave={() => {
                  if (!isScrubbingRef.current) setScrubHover(null);
                }}
                className="group relative flex h-6 flex-1 cursor-pointer items-center select-none touch-none"
              >
                {/* Track Rail */}
                <div className="relative h-1.5 w-full bg-white/14 overflow-visible">
                  <div
                    className="h-full"
                    style={{
                      width: `${progressPct}%`,
                      background: `linear-gradient(90deg, ${activeTheme.primary}, ${activeTheme.bright})`,
                    }}
                  />

                  {/* Practice: Gold Start Pos + Clickable Emerald Checkpoint Diamonds */}
                  {isPracticeMode && practiceStartSec > 0 && (
                    <span
                      title={`Start Pos ${formatTimeSec(practiceStartSec)}`}
                      className="pointer-events-none absolute top-1/2 h-3 w-1 -translate-y-1/2 -translate-x-1/2 bg-[#fde047]"
                      style={{
                        left: `${Math.max(
                          0,
                          Math.min(100, (practiceStartSec / Math.max(1, songDurationSec)) * 100),
                        )}%`,
                      }}
                    />
                  )}
                  {isPracticeMode &&
                    practiceCheckpoints.map((cp) => {
                      const pct = (cp.songTime / Math.max(1, songDurationSec)) * 100;
                      return (
                        <button
                          key={cp.id}
                          type="button"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            onPracticeSeek(cp.songTime, false);
                          }}
                          title={`Jump to Checkpoint (${formatTimeSec(cp.songTime)})`}
                          className="absolute top-1/2 z-10 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rotate-45 border border-[#07080d] bg-[#34d399] hover:scale-125 transition-transform cursor-pointer"
                          style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}
                        />
                      );
                    })}

                  {/* Replay: Event Markers (Misses stand taller so mistakes are instantly spotted) */}
                  {isReplayMode &&
                    pressEvents.map((ev, idx) => {
                      const pct = (ev.songTime / Math.max(1, songDurationSec)) * 100;
                      const isMiss = ev.tier === 'MISS';
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
                          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
                          style={{
                            left: `${Math.max(0, Math.min(100, pct))}%`,
                            width: isMiss ? '2.5px' : '1.5px',
                            height: isMiss ? '14px' : '9px',
                            backgroundColor: col,
                            opacity: isMiss ? 0.95 : 0.72,
                          }}
                        />
                      );
                    })}

                  {/* Active Glowing Diamond Thumb */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rotate-45 border border-white"
                    style={{
                      left: `${progressPct}%`,
                      backgroundColor: activeTheme.bright,
                      boxShadow: `0 0 12px ${activeTheme.bright}`,
                    }}
                  />
                </div>

                {/* Rich Floating Scrubber Inspector Popover */}
                {scrubHover && (
                  <div
                    className="pointer-events-none absolute -top-9 -translate-x-1/2 border border-white/20 bg-[#0b0e18]/95 px-2 py-1 tabular-nums text-[10px] font-bold text-white whitespace-nowrap shadow-lg"
                    style={{ left: `${Math.max(6, Math.min(94, scrubHover.pct))}%` }}
                  >
                    <span>{formatTimeSec(scrubHover.sec)}</span>
                    {hoveredReplayEvent && (
                      <span
                        className="ml-1.5 font-extrabold"
                        style={{
                          color:
                            hoveredReplayEvent.tier === 'MISS'
                              ? '#f87171'
                              : hoveredReplayEvent.tier === 'PERFECT'
                              ? '#fde047'
                              : '#34d399',
                        }}
                      >
                        · {hoveredReplayEvent.tier || hoveredReplayEvent.action}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Joined Segmented Speed Controls (0.5x | 0.75x | 1.0x | 2.0x) */}
            <div className="flex items-center border border-white/20 bg-[#101320] tabular-nums shrink-0">
              {[0.5, 0.75, 1.0, 2.0].map((spd) => {
                const isSelected = (isReplayMode ? replaySpeed : practiceSpeed) === spd;
                return (
                  <button
                    key={spd}
                    type="button"
                    onClick={() =>
                      isReplayMode ? onChangeReplaySpeed(spd) : onChangePracticeSpeed(spd)
                    }
                    className="px-2 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap border-r border-white/12 last:border-r-0"
                    style={
                      isSelected
                        ? {
                            backgroundColor: activeTheme.primary,
                            color: activeTheme.onPrimary,
                            boxShadow: `inset 0 0 10px rgba(255,255,255,0.18)`,
                          }
                        : { color: '#b6bfd1' }
                    }
                  >
                    {spd.toFixed(spd % 1 === 0 ? 1 : 2).replace(/0$/, '')}x
                  </button>
                );
              })}
            </div>

            {/* Pattern Tag + Mechanical Keycaps + Exit */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden xl:inline text-[11px] font-bold whitespace-nowrap">
                <span className="text-[#808ba1] mr-1">Pattern</span>
                <span className="uppercase" style={{ color: modeColor }}>{modeName}</span>
              </span>
              <div className="flex items-center gap-1">
                <span
                  data-pressed={k1Lit}
                  className={`tactile-btn border px-2 py-1 font-mono text-[11px] font-bold ${
                    k1Lit
                      ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-white'
                      : 'border-white/20 bg-[#121624] text-[#e2e8f0]'
                  }`}
                >
                  {trigger1Label}
                </span>
                <span
                  data-pressed={k2Lit}
                  className={`tactile-btn border px-2 py-1 font-mono text-[11px] font-bold ${
                    k2Lit
                      ? 'border-[var(--accent-bright)] bg-[var(--accent)] text-white'
                      : 'border-white/20 bg-[#121624] text-[#e2e8f0]'
                  }`}
                >
                  {trigger2Label}
                </span>
              </div>
              <button
                type="button"
                onClick={isReplayMode ? onExitReplay : onExitPractice}
                className="tactile-btn flex items-center gap-1 border border-white/20 bg-[#141724] px-2 py-1.5 text-[11px] font-bold text-[#d1d5db] hover:border-white/45 hover:text-white cursor-pointer whitespace-nowrap"
                title={isReplayMode ? 'Exit Replay' : 'Exit Practice'}
              >
                <X className="h-3 w-3" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none relative z-20 flex w-full items-end justify-between gap-4">
          {/* Bottom-Left: Combo + Unbanked Orbs */}
          <div className="flex items-baseline gap-4">
            <div>
              <span className="block text-[11px] font-semibold text-[#b6bfd1] whitespace-nowrap">
                {getComboLabel(streak)} ({streakMult.toFixed(2)}x)
              </span>
              <span
                className="tabular-nums text-2xl sm:text-3xl font-black leading-none"
                style={{ color: overdriveActive ? activeTheme.edgeTick : '#ffffff' }}
              >
                {streak}x
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#fbbf24] tabular-nums whitespace-nowrap">
              <OrbIcon className="h-4 w-4" />
              <span>
                {`+${unbankedOrbs} Orbs${overdriveActive ? ' (2×)' : ''}`}
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
      )}
    </div>
  );
};
