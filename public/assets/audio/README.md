# Original sound design

All 18 mono WAV files are generated locally by `scripts/create-audio.py` using
oscillators and deterministic pseudorandom noise. They are original project assets;
there are no third-party samples, temporary URLs, or external licences required.

These are stylised fictional game effects, not recordings or simulations of any
real firearm. The soundscape mixes two quiet ambience loops (rain/wind and indoor
electrical machinery), with surface-specific footsteps and positional one-shots.

Format: 22,050 Hz, signed 16-bit PCM, mono. Regenerate with
`python3 scripts/create-audio.py`. Web Audio handles decoding, distance attenuation,
listener orientation, gain control, limiting, and pause/resume.
