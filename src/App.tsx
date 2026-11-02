import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, AudioLines, Check, ChevronRight, CircleHelp, Crosshair, Expand, Flag, Focus, Headphones, HeartPulse, Info, Layers, MapPin, Mouse, Pause, Play, Radio, RotateCcw, Settings2, Shield, Signal, Volume2, X } from 'lucide-react';
import gsap from 'gsap';
import type { GameEngine } from './game/engine/GameEngine';
import { defaultSettings, initialState, type GameActions, type GameState, type Settings } from './types';

type Panel = 'settings' | 'controls' | 'about' | null;
const settingsKey = 'duskline-settings-v1';

function loadSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(settingsKey) ?? '{}');
    return {
      sensitivity: clamp(stored.sensitivity, .25, 2.5, defaultSettings.sensitivity),
      volume: clamp(stored.volume, 0, 1, defaultSettings.volume),
      effectsVolume: clamp(stored.effectsVolume, 0, 1, defaultSettings.effectsVolume),
      fov: clamp(stored.fov, 60, 100, defaultSettings.fov),
      quality: ['low', 'medium', 'high'].includes(stored.quality) ? stored.quality : defaultSettings.quality,
      motion: typeof stored.motion === 'boolean' ? stored.motion : defaultSettings.motion,
      crosshair: typeof stored.crosshair === 'boolean' ? stored.crosshair : defaultSettings.crosshair,
    };
  } catch { return { ...defaultSettings }; }
}
function clamp(value: unknown, min: number, max: number, fallback: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback; }
function time(value: number) { const t = Math.floor(value); return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`; }

export default function App() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<GameState>({ ...initialState });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const settingsRef = useRef(settings);
  const [panel, setPanel] = useState<Panel>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let engine: GameEngine | null = null;
    const initialise = async () => {
      const { GameEngine: Engine } = await import('./game/engine/GameEngine');
      if (!active || !sceneRef.current) return;
      engine = new Engine(sceneRef.current, (next: GameState) => { if (active) setState({ ...next }); }, settingsRef.current);
      engineRef.current = engine;
      await engine.init();
    };
    initialise().catch((error: unknown) => {
      if (active) setState(s => ({ ...s, phase: 'error', error: error instanceof Error ? error.message : String(error) }));
    });
    return () => { active = false; engine?.dispose(); if (engineRef.current === engine) engineRef.current = null; };
  }, [attempt]);

  useEffect(() => {
    if (!uiRef.current) return;
    const targets = Array.from(uiRef.current.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!targets.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      // Keep all content readable while shaders compile or the render loop is busy.
      // The transition adds movement without putting mission controls behind an opacity gate.
      gsap.fromTo(targets, { y: 9 }, { y: 0, duration: .35, stagger: .018, ease: 'power2.out', clearProps: 'transform' });
    }, uiRef);
    return () => context.revert();
  }, [state.phase, panel]);

  useEffect(() => {
    if (!panel) return;
    const close = (event: KeyboardEvent) => { if (event.code === 'Escape') { event.preventDefault(); setPanel(null); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [panel]);

  const changeSettings = (next: Settings) => {
    setSettings(next); settingsRef.current = next; engineRef.current?.setSettings(next);
    try { localStorage.setItem(settingsKey, JSON.stringify(next)); } catch { /* Preferences remain usable without browser storage. */ }
  };
  const openPanel = (next: Panel) => { if (state.phase === 'playing') engineRef.current?.pause(); setPanel(next); };
  const start = () => { setPanel(null); engineRef.current?.start(); };
  const restart = () => { setPanel(null); engineRef.current?.restart(); };

  return <main className={`duskline phase-${state.phase}`} ref={uiRef}>
    <div className="game-scene" ref={sceneRef} aria-label="Real-time 3D Blacksite 07 environment" />
    <div className="film-grain" aria-hidden="true" />
    {state.phase === 'loading' && <div className="loading-screen screen">
      <div className="loading-mark"><BrandMark /><span>AEGIS / FIELD OPERATIONS</span></div>
      <div className="loading-content" data-reveal><div className="eyebrow">SECURE CONNECTION ESTABLISHED</div><h1>INITIALISING<br /><span>BLACKSITE 07</span></h1><div className="loading-track"><span style={{ width: `${state.progress <= 1 ? state.progress * 100 : state.progress}%` }} /></div><div className="loading-status"><span>{state.loadingLabel}</span><span>{Math.min(100, Math.round(state.progress <= 1 ? state.progress * 100 : state.progress)).toString().padStart(2, '0')}%</span></div></div>
      <div className="loading-bottom"><span>OPERATION: DUSKLINE</span><span>ORIGINAL BROWSER EXPERIENCE / 001</span></div>
    </div>}

    {state.phase === 'menu' && <div className="main-menu screen">
      <header className="menu-header" data-reveal><a className="brand" href="#" onClick={event => event.preventDefault()} aria-label="AEGIS Interactive"><BrandMark /><span>AEGIS<span className="brand-sub">INTERACTIVE</span></span></a><div className="header-signal"><span className="status-dot" /> SINGLE PLAYER EXPERIENCE <span className="header-divider" /><span className="build-number">BUILD 01.07</span></div></header>
      <section className="menu-hero">
        <div className="hero-eyebrow" data-reveal><span className="orange-rule" /> CLASSIFIED OPERATION <span className="eyebrow-slash">/</span> 07</div>
        <h1 className="hero-title" data-reveal><span>OPERATION:</span>DUSKLINE<span className="title-period">.</span></h1>
        <div className="hero-location" data-reveal><MapPin size={13} strokeWidth={1.7} /><span>BLACKSITE 07</span><span className="location-line" /><span className="location-description">ABANDONED RESEARCH FACILITY</span></div>
        <p className="hero-description" data-reveal>The signal went dark. The security didn't.<br />Go inside. Recover the data. Make it out.</p>
        <div className="mission-entry" data-reveal><button className="start-button" onClick={start}><span className="play-bracket"><Play size={17} fill="currentColor" strokeWidth={0} /></span><span>START MISSION</span><ArrowRight size={20} /></button><span className="entry-note">ONE OPERATIVE. ONE OBJECTIVE.<br /><span>NO SECOND CHANCES.</span></span></div>
        <nav className="menu-nav" data-reveal aria-label="Mission options"><button onClick={() => openPanel('settings')}><Settings2 size={14} />Settings</button><button onClick={() => openPanel('controls')}><Mouse size={14} />Controls</button><button onClick={() => openPanel('about')}><Info size={14} />About</button></nav>
      </section>
      <aside className="mission-intel" data-reveal><div className="intel-kicker"><Radio size={12} /> LIVE INTELLIGENCE <span className="status-dot" /></div><div className="intel-number">07<span>/ BLACKSITE</span></div><div className="intel-rows"><div><span>CONNECTION</span><b className="text-green">ESTABLISHED</b></div><div><span>LOCAL TIME</span><b>19:42:08</b></div><div><span>CONDITIONS</span><b>RAIN / 08°C</b></div><div><span>THREAT LEVEL</span><b className="text-orange">ELEVATED</b></div></div><div className="intel-objective"><span>PRIMARY DIRECTIVE</span><p>Recover the classified<br />research data module.</p></div><div className="intel-wave" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ height: `${4 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * .38)) * 22}px` }} />)}</div><div className="intel-encrypted"><Shield size={11} /> END-TO-END ENCRYPTED</div></aside>
      <footer className="menu-footer" data-reveal><div className="footer-left"><span className="footer-cross">+</span><span>SECTOR 04<span className="footer-dim"> / NORTHERN PERIMETER</span></span></div><div className="footer-center"><Headphones size={14} /><span>HEADPHONES RECOMMENDED</span></div><div className="footer-right"><span className="status-dot" /> SYSTEMS ONLINE <span className="footer-dim">// WEBGL</span></div></footer>
      <div className="scene-caption" data-reveal><span className="scene-corner" /><span>BLACKSITE 07 — LOADING YARD</span><span className="scene-caption-sub">RENDERED IN REAL TIME</span></div>
    </div>}

    {state.phase === 'playing' && <><HUD state={state} settings={settings} pause={() => engineRef.current?.pause()} /><MobileControls actions={engineRef.current} /></>}

    {state.phase === 'paused' && !panel && <div className="pause-screen screen"><div className="pause-content" data-reveal><div className="eyebrow"><Pause size={13} /> OPERATION SUSPENDED</div><h1>STAND BY<span className="text-orange">.</span></h1><p>Your mission is paused. Take a breath.</p><div className="pause-location"><MapPin size={12} />{state.area}<span>{time(state.elapsed)}</span></div><div className="pause-actions"><button className="start-button" onClick={() => engineRef.current?.resume()}><Play size={17} fill="currentColor" /><span>RESUME MISSION</span><ArrowRight size={19} /></button><button onClick={restart}><RotateCcw size={15} />Restart mission</button><button onClick={() => setPanel('settings')}><Settings2 size={15} />Settings</button><button onClick={() => setPanel('controls')}><Mouse size={15} />Controls</button><button onClick={() => { engineRef.current?.exit(); setPanel(null); }}><ArrowLeft size={15} />Exit to main menu</button></div></div><div className="pause-note"><Shield size={12} />SECURE CHANNEL / BLACKSITE 07</div></div>}

    {(state.phase === 'complete' || state.phase === 'dead') && <div className="result-screen screen"><div className="result-card" data-reveal><div className={`result-icon ${state.phase === 'dead' ? 'failed' : ''}`}>{state.phase === 'complete' ? <Check size={29} /> : <X size={29} />}</div><div className="eyebrow">{state.phase === 'complete' ? 'DATA SECURED / OPERATIVE EXTRACTED' : 'OPERATIVE SIGNAL LOST'}</div><h1>{state.phase === 'complete' ? <>MISSION<br />COMPLETE<span className="text-orange">.</span></> : <>MISSION<br />FAILED<span className="text-orange">.</span></>}</h1><p>{state.phase === 'complete' ? 'Blacksite 07 has given up its secrets. Your work here is done.' : 'Security systems remain active. Re-enter the facility and finish the operation.'}</p><div className="result-stats"><div><span>MISSION TIME</span><strong>{time(state.elapsed)}</strong></div><div><span>UNITS DISABLED</span><strong>{String(state.kills).padStart(2, '0')}</strong></div><div><span>DATA MODULE</span><strong>{state.hasData ? 'SECURED' : 'MISSING'}</strong></div></div><button className="start-button" onClick={restart}><RotateCcw size={17} /><span>{state.phase === 'complete' ? 'REPLAY OPERATION' : 'RETRY MISSION'}</span><ArrowRight size={20} /></button><button className="text-button" onClick={() => engineRef.current?.exit()}><ArrowLeft size={14} />Back to main menu</button></div></div>}

    {state.phase === 'error' && <div className="error-screen screen"><div className="result-card" data-reveal><div className="eyebrow">CONNECTION INTERRUPTED</div><h1>UNABLE TO<br />INITIALISE<span className="text-orange">.</span></h1><p>The environment could not be loaded. Use a modern browser with WebGL enabled and try again.</p><div className="error-detail">{state.error}</div><button className="start-button" onClick={() => { setState({ ...initialState }); setAttempt(a => a + 1); }}><RotateCcw size={16} /><span>RETRY CONNECTION</span><ArrowRight size={20} /></button></div></div>}

    {panel && <div className="panel-backdrop" onClick={() => setPanel(null)}><section className={`dialog panel-${panel}`} role="dialog" aria-modal="true" aria-labelledby="panel-title" onClick={e => e.stopPropagation()}><header className="dialog-header" data-reveal><div><div className="eyebrow">FIELD OPERATIONS / CONFIGURATION</div><h2 id="panel-title">{panel === 'settings' ? 'MAKE IT YOURS.' : panel === 'controls' ? 'KNOW YOUR CONTROLS.' : 'BEHIND THE OPERATION.'}</h2></div><button className="icon-button" aria-label="Close panel" onClick={() => setPanel(null)}><X size={21} /></button></header>{panel === 'settings' ? <SettingsPanel settings={settings} change={changeSettings} /> : panel === 'controls' ? <ControlsPanel /> : <AboutPanel />}<footer className="dialog-footer"><span>{panel === 'settings' ? 'PREFERENCES SAVED AUTOMATICALLY' : 'OPERATION: DUSKLINE / BLACKSITE 07'}</span><button className="text-button" onClick={() => setPanel(null)}><Check size={14} />Done</button></footer></section></div>}
    <span className="sr-only" role="status" aria-live="polite">{state.phase === 'playing' ? state.notification : ''}</span>
  </main>;
}

function BrandMark() { return <svg className="brand-mark" viewBox="0 0 40 42" fill="none" aria-hidden="true"><path d="M20 2 37 12v19L20 41 3 31V12L20 2Z" stroke="currentColor" strokeWidth="1.5" /><path d="m20 11 10 19h-6l-4-8-4 8h-6l10-19Z" fill="currentColor" /><path d="M17 31h6" stroke="currentColor" strokeWidth="2" /></svg>; }

function HUD({ state, settings, pause }: { state: GameState; settings: Settings; pause: () => void }) {
  const heading = ((Math.round(state.heading) % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return <div className={`hud ${state.aiming ? 'is-aiming' : ''}`}>
    <div className="hud-vignette" />
    <header className="hud-top"><div className="hud-mission"><span className="hud-operation">OPERATION: DUSKLINE</span><div className="hud-objective"><span className="objective-diamond" /><div><span className="hud-mini">OBJECTIVE {String(state.objective + 1).padStart(2, '0')} / 05</span><strong>{state.objectiveText}</strong></div></div><div className="objective-progress">{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < state.objective ? 'done' : i === state.objective ? 'active' : ''} />)}</div></div><div className="compass"><div className="compass-ticks" /><span>W</span><span>NW</span><strong>{directions[Math.round(heading / 45) % 8]}<i>{String(heading).padStart(3, '0')}°</i></strong><span>NE</span><span>E</span><div className="compass-pointer" /></div><div className="hud-top-right"><span><span className="status-dot" /> LIVE UPLINK</span><button className="pause-button" aria-label="Pause mission" onClick={pause}><Pause size={14} /><kbd>ESC</kbd></button></div></header>
    <div className="hud-area"><MapPin size={11} /> BLACKSITE 07 <span>/</span> {state.area}</div>
    {settings.crosshair && !state.aiming && <div className={`crosshair ${state.sprinting ? 'sprinting' : ''}`} aria-hidden="true"><span /><span /><span /><span /><i /></div>}
    {state.hit > 0 && <div className="hit-marker" aria-label="Target hit"><i /><i /><i /><i /></div>}
    {state.prompt && <div className="interaction-prompt"><kbd>E</kbd><span>{state.prompt}</span></div>}
    {state.notification && <div className="hud-notification" key={state.notification}><div className="notification-bar" /><Radio size={15} /><span>{state.notification}</span></div>}
    <div className="hud-bottom"><div className="health-block"><div className="health-heading"><HeartPulse size={18} /><span>VITALS</span><strong>{Math.max(0, Math.ceil(state.health))}<small> / 100</small></strong></div><div className="health-track"><span style={{ width: `${Math.max(0, state.health)}%` }} /></div><div className="hud-player-status"><span className="status-dot" />{state.crouching ? 'CROUCHED' : state.sprinting ? 'SPRINTING' : 'OPERATIVE ACTIVE'}<span>ALPHA 01</span></div></div><div className="hud-quick-actions"><span><kbd>E</kbd> INTERACT</span><span><kbd>R</kbd> RELOAD</span><span><kbd>F</kbd> INSPECT</span></div><div className="ammo-block"><div className="weapon-line"><span>{state.weapon}</span><span className="weapon-mode">AUTO / 5.56</span></div><div className="ammo-numbers"><strong className={state.ammo <= 6 ? 'low-ammo' : ''}>{String(state.ammo).padStart(2, '0')}</strong><i>/</i><span>{String(state.reserve).padStart(3, '0')}</span><div className="ammo-cartridges">{Array.from({ length: 5 }, (_, i) => <b key={i} className={state.ammo > i * 6 ? 'filled' : ''} />)}</div></div><div className="ammo-status">{state.reloading ? <><RotateCcw size={11} className="spin" /> RELOADING</> : state.ammo === 0 ? <><kbd>R</kbd> RELOAD REQUIRED</> : <><span className="ammo-dot" /> {state.aiming ? 'SIGHTS ENGAGED' : 'WEAPON READY'}</>}</div></div></div>
    {state.damage > 0 && <div className="damage-overlay" style={{ opacity: Math.min(.8, state.damage) }} />}
  </div>;
}

function SettingsPanel({ settings, change }: { settings: Settings; change: (settings: Settings) => void }) {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => change({ ...settings, [key]: value });
  return <div className="settings-content" data-reveal><div className="settings-section-label"><Mouse size={13} /> INPUT & CAMERA</div><Slider label="Mouse sensitivity" value={settings.sensitivity} min={.25} max={2.5} step={.05} display={`${settings.sensitivity.toFixed(2)}×`} onChange={v => update('sensitivity', v)} /><Slider label="Field of view" value={settings.fov} min={60} max={100} step={1} display={`${settings.fov}°`} onChange={v => update('fov', v)} /><Toggle label="Camera motion" description="Subtle walking bob and recoil movement" checked={settings.motion} change={v => update('motion', v)} /><Toggle label="Crosshair" description="Show the centre aiming reticle" checked={settings.crosshair} change={v => update('crosshair', v)} /><div className="settings-section-label"><Volume2 size={13} /> AUDIO</div><Slider label="Master volume" value={settings.volume} min={0} max={1} step={.01} display={`${Math.round(settings.volume * 100)}%`} onChange={v => update('volume', v)} /><Slider label="Sound effects" value={settings.effectsVolume} min={0} max={1} step={.01} display={`${Math.round(settings.effectsVolume * 100)}%`} onChange={v => update('effectsVolume', v)} /><div className="settings-section-label"><Layers size={13} /> GRAPHICS</div><div className="setting-row quality-setting"><div><label>Render quality</label><p>Adjust shadows, resolution, and atmosphere.</p></div><div className="segmented" aria-label="Graphics quality">{(['low', 'medium', 'high'] as const).map(q => <button key={q} aria-pressed={settings.quality === q} className={settings.quality === q ? 'selected' : ''} onClick={() => update('quality', q)}>{q}</button>)}</div></div><button className="reset-settings text-button" onClick={() => change({ ...defaultSettings })}><RotateCcw size={12} />Restore defaults</button></div>;
}
function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) { return <label className="setting-row slider-setting"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /><output>{display}</output></label>; }
function Toggle({ label, description, checked, change }: { label: string; description: string; checked: boolean; change: (v: boolean) => void }) { return <div className="setting-row"><div><label>{label}</label><p>{description}</p></div><button className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => change(!checked)}><span /></button></div>; }

function ControlsPanel() {
  const controls = [['W A S D', 'Move'], ['MOUSE', 'Look around'], ['SHIFT', 'Sprint'], ['CTRL / C', 'Crouch'], ['SPACE', 'Jump'], ['LMB', 'Fire'], ['RMB', 'Aim down sights'], ['R', 'Reload'], ['E', 'Interact / collect'], ['F', 'Inspect weapon'], ['1 / 2', 'Switch weapon'], ['ESC', 'Pause / release pointer']];
  return <div className="controls-content" data-reveal><div className="controls-intro"><Mouse size={22} /><p>Enter the mission to capture your mouse.<br /><strong>Press Escape at any time to pause.</strong></p></div><div className="controls-grid">{controls.map(([key, label]) => <div className="control-item" key={key}><span>{label}</span><kbd>{key}</kbd></div>)}</div><div className="controls-hint"><Crosshair size={17} /><p>Look directly at an object and move within reach to interact. Find the access card in the loading yard, recover the research data, then reach extraction.</p></div><div className="touch-hint"><span className="settings-section-label">TOUCH DEVICES</span><p>Left joystick to move. Drag the right side to look. Use the on-screen fire, aim, interact, reload, jump, and crouch controls.</p></div></div>;
}
function AboutPanel() { return <div className="about-content" data-reveal><div className="about-label"><BrandMark /><span>AN AEGIS INTERACTIVE EXPERIENCE</span></div><h3>The signal went dark.<br />Your mission starts here.</h3><p>OPERATION: DUSKLINE is an original, single-player first-person mission set in a forgotten industrial research facility.</p><p>Explore five connected areas. Find access credentials, disable autonomous security units, recover a classified data module, and make it to extraction.</p><div className="about-tech"><div><span>ENGINE</span><strong>THREE.JS / WEBGL</strong></div><div><span>PHYSICS</span><strong>RAPIER 3D</strong></div><div><span>ASSETS</span><strong>ORIGINAL / LOCAL</strong></div></div><p className="about-note">All locations, organisations, equipment, and events are fictional. No downloads, accounts, or multiplayer connection required.</p></div>; }

function MobileControls({ actions }: { actions: GameActions | null }) {
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const joystick = useRef<{ id: number; x: number; y: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const updateJoystick = (event: PointerEvent<HTMLDivElement>) => {
    if (!joystick.current || event.pointerId !== joystick.current.id) return;
    const dx = event.clientX - joystick.current.x; const dy = event.clientY - joystick.current.y;
    const length = Math.hypot(dx, dy); const factor = Math.min(1, 44 / (length || 1));
    const x = dx * factor / 44; const y = dy * factor / 44;
    setStick({ x: x * 34, y: y * 34 }); actions?.mobileMove(x, -y);
  };
  const endJoystick = () => { joystick.current = null; setStick({ x: 0, y: 0 }); actions?.mobileMove(0, 0); };
  return <div className="mobile-controls"><div className="touch-look" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }} onPointerMove={e => { if (!look.current || e.pointerId !== look.current.id) return; actions?.mobileLook(e.clientX - look.current.x, e.clientY - look.current.y); look.current.x = e.clientX; look.current.y = e.clientY; }} onPointerUp={() => { look.current = null; }} onPointerCancel={() => { look.current = null; }} /><div className="touch-joystick" aria-label="Movement joystick" onPointerDown={e => { const rect = e.currentTarget.getBoundingClientRect(); joystick.current = { id: e.pointerId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; e.currentTarget.setPointerCapture(e.pointerId); updateJoystick(e); }} onPointerMove={updateJoystick} onPointerUp={endJoystick} onPointerCancel={endJoystick}><div style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} /><span>MOVE</span></div><div className="touch-actions"><button className="touch-fire" aria-label="Fire" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); actions?.fire(true); }} onPointerUp={() => actions?.fire(false)} onPointerCancel={() => actions?.fire(false)}><Crosshair size={29} /></button><button aria-label="Aim" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); actions?.aim(true); }} onPointerUp={() => actions?.aim(false)} onPointerCancel={() => actions?.aim(false)}><Focus size={21} /></button><button onClick={() => actions?.interact()}>E<span>USE</span></button><button onClick={() => actions?.reload()}><RotateCcw size={19} /><span>RELOAD</span></button><button onClick={() => actions?.jump()}><ArrowDown size={20} style={{ transform: 'rotate(180deg)' }} /><span>JUMP</span></button><button onClick={() => actions?.crouch()}><ArrowDown size={20} /><span>CROUCH</span></button></div></div>;
}
