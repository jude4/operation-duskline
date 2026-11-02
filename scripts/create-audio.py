"""Create the project's original, fictional sound design. Python standard library only."""
from pathlib import Path
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/audio'
ROOT.mkdir(parents=True, exist_ok=True)
RATE = 22050
rng = random.Random(7007)


def save(name, duration, sample, gain=1.0, loop=False):
    count = int(duration * RATE)
    data = []
    for i in range(count):
        t = i / RATE
        edge = 1 if loop else min(1, t * 250, (duration - t) * 80)
        # Keep every original effect comfortably below digital clipping.
        value = max(-0.92, min(0.92, sample(t) * edge * gain))
        data.append(struct.pack('<h', int(value * 32767)))
    with wave.open(str(ROOT / f'{name}.wav'), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b''.join(data))


def noise():
    return rng.uniform(-1, 1)


def click(t, at, frequency=1800, decay=80):
    d = t - at
    return 0 if d < 0 else math.sin(d * frequency * math.tau) * math.exp(-d * decay)


save('shot', .32, lambda t: noise() * math.exp(-t * 44) * .65 + math.sin(t * math.tau * (115 - t * 130)) * math.exp(-t * 23) * .55)
save('reload', 1.48, lambda t: click(t, .04, 180, 40) * .7 + click(t, .32, 1100, 90) * .35 + click(t, .83, 220, 65) * .8 + click(t, 1.13, 1200, 90) * .35 + (noise() * .12 if .67 < t < .83 else 0))
save('door', 1.3, lambda t: (math.sin(t * 67 * math.tau) * .22 + noise() * .16) * math.sin(t / 1.3 * math.pi) + click(t, 1.1, 97, 23) * .5)
save('pickup', .5, lambda t: math.sin(t * math.tau * (520 if t < .16 else 780)) * math.exp(-t * 7) * .7)
save('terminal', .65, lambda t: (math.sin(t * math.tau * 640) + math.sin(t * math.tau * 960) * .4) * math.exp(-t * 6) * .45)
save('empty', .1, lambda t: click(t, .007, 900, 85) * .6 + noise() * math.exp(-t * 150) * .25)
save('impact', .2, lambda t: noise() * math.exp(-t * 55) * .55 + math.sin(t * math.tau * 250) * math.exp(-t * 40) * .3)
save('hurt', .3, lambda t: noise() * math.exp(-t * 26) * .3 + math.sin(t * math.tau * (95 - t * 90)) * math.exp(-t * 16) * .4)
save('enemy', .3, lambda t: math.sin(t * math.tau * (230 - t * 180)) * math.exp(-t * 18) * .55 + noise() * math.exp(-t * 30) * .3)
save('complete', 2.4, lambda t: sum(math.sin(t * math.tau * f) * math.exp(-max(0, t - k * .3) * 2) * (t > k * .3) for k, f in enumerate([261.63, 329.63, 392, 523.25])) * .17)
save('jump', .2, lambda t: noise() * math.sin(t / .2 * math.pi) * .16)
save('land', .28, lambda t: noise() * math.exp(-t * 23) * .35 + math.sin(t * math.tau * 85) * math.exp(-t * 28) * .4)
save('glass', .65, lambda t: noise() * math.exp(-t * 10) * .35 + sum(click(t, i * .045, 1700 + i * 370, 65) for i in range(8)) * .13)
save('switch', .18, lambda t: click(t, .01, 700, 55) * .45 + click(t, .05, 1200, 80) * .2)
save('step-outside', .3, lambda t: noise() * math.exp(-t * 25) * .38 + math.sin(t * math.tau * 82) * math.exp(-t * 36) * .25)
save('step-inside', .23, lambda t: noise() * math.exp(-t * 38) * .25 + math.sin(t * math.tau * 140) * math.exp(-t * 26) * .4)

# Exactly repeating tonal frequencies and periodic modulation make seamless loops.
save('outdoor', 6, lambda t: noise() * .22 + math.sin(t * math.tau * 45) * .045 + math.sin(t * math.tau * 78) * .025, loop=True)
save('indoor', 6, lambda t: math.sin(t * math.tau * 60) * .15 + math.sin(t * math.tau * 120) * .035 + noise() * .045 + math.sin(t * math.tau * 31) * .055, loop=True)
print(f'Generated {len(list(ROOT.glob("*.wav")))} original WAV assets in {ROOT}')
