"""Synthesise the malfunction, scene and commercial sound effects (v1.2).

    python3 tools/sfx_extra.py            # writes sounds/*.ogg (does not touch the applause recording)
"""
import os
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(12)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sounds")


def t(d):
    return np.arange(int(d * SR)) / SR


def n(d):
    return rng.standard_normal(int(d * SR))


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def env(nn, a=0.01, r=0.1):
    e = np.ones(nn)
    A, R = int(a * SR), int(r * SR)
    if A:
        e[:A] = np.linspace(0, 1, A)
    if R:
        e[-R:] *= np.linspace(1, 0, R)
    return e


def place(buf, x, at):
    i = int(at * SR)
    end = min(len(buf), i + len(x))
    buf[i:end] += x[: end - i]
    return buf


def osc(freq, d, kind="sine"):
    tt = t(d)
    f = np.broadcast_to(freq, tt.shape) if np.ndim(freq) else np.full(tt.shape, freq)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == "saw":
        return signal.sawtooth(ph)
    if kind == "square":
        return signal.square(ph)
    if kind == "tri":
        return signal.sawtooth(ph, 0.5)
    return np.sin(ph)


def bell(f, d=1.0, decay=0.3):
    tt = t(d)
    return sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt / (decay / m ** 0.5)) for m, a in [(1, 1), (2.76, 0.45), (5.4, 0.2)])


def note(k):
    return 440 * 2 ** ((k - 69) / 12)


def save(name, x, loop=False):
    x = np.asarray(x, dtype=float)
    m = np.max(np.abs(x)) or 1
    x = x / m * 0.89
    if not loop:
        f = min(len(x) // 3, int(0.04 * SR))
        x[-f:] *= np.linspace(1, 0, f)
    else:  # crossfade the ends so the loop has no click
        f = int(0.08 * SR)
        x[:f] = x[:f] * np.linspace(0, 1, f) + x[-f:] * np.linspace(1, 0, f)
        x = x[:-f]
    wav = f"/tmp/hg_{name}.wav"
    wavfile.write(wav, SR, (x * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "5", os.path.join(OUT, f"{name}.ogg")], check=True)
    os.remove(wav)


# --- power down / power up -------------------------------------------------------
d = 2.2
f = np.geomspace(220, 28, int(d * SR))
x = 0.6 * osc(f, d, "saw") + 0.4 * osc(f * 2.01, d, "saw")
x = lp(x, 1800) * np.linspace(1, 0, len(x)) ** 1.5
place(x, lp(n(0.15), 3000) * np.exp(-t(0.15) / 0.03) * 1.4, 0.0)  # relay clunk
save("power-down", x)

d = 2.0
f = np.geomspace(30, 240, int(d * SR))
x = (0.6 * osc(f, d, "saw") + 0.4 * osc(f * 1.5, d, "saw"))
x = lp(x, 2400) * np.linspace(0.1, 1, len(x)) * env(len(x), 0.05, 0.4)
for at in (0.35, 0.6, 0.72, 1.1):  # flickering relays
    place(x, hp(n(0.03), 2000) * np.exp(-t(0.03) / 0.006), at)
save("power-up", x)

# --- TV static (loop) and test tone ------------------------------------------------
x = hp(n(3.0), 400) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.7 * t(3.0)))
save("static", x, loop=True)
x = np.sin(2 * np.pi * 1000 * t(1.6)) * env(int(1.6 * SR), 0.01, 0.05)
save("tv-tone", x)

# --- sparks, zap, electric buzz ---------------------------------------------------------
buf = np.zeros(int(1.4 * SR))
for _ in range(70):
    at = rng.random() ** 1.7 * 1.1
    k = int(rng.integers(80, 900))
    c = hp(rng.standard_normal(k), 2500) * np.exp(-np.arange(k) / (k / 5))
    place(buf, c * (0.3 + rng.random()), at)
place(buf, lp(n(0.12), 1500) * np.exp(-t(0.12) / 0.02) * 2.0, 0)
save("sparks", buf)

d = 0.7
car = osc(120, d, "square") * (1 + 0.8 * np.sign(np.sin(2 * np.pi * 37 * t(d))))
x = bp(car + 0.6 * hp(n(d), 3000), 200, 6000) * env(int(d * SR), 0.002, 0.25)
save("zap", x)

d = 3.0
x = osc(60, d, "saw") + 0.6 * osc(120, d, "saw") + 0.3 * osc(180, d, "square")
x = lp(x, 900) * (1 + 0.2 * np.sin(2 * np.pi * 3 * t(d)))
save("buzz", x, loop=True)

# --- klaxon (loop), error beeps, doors ---------------------------------------------------------
d = 2.0
tt = t(d)
f = np.where((tt % 1.0) < 0.5, 520, 415)
x = lp(osc(f, d, "square") + 0.5 * osc(f * 1.5, d, "saw"), 3000)
save("klaxon", x, loop=True)

buf = np.zeros(int(1.6 * SR))
for i, fr in enumerate((880, 880, 440)):
    beep = osc(fr, 0.16 if i < 2 else 0.5, "square") * env(int((0.16 if i < 2 else 0.5) * SR), 0.003, 0.03)
    place(buf, lp(beep, 4000), i * 0.24)
save("error", buf)

buf = np.zeros(int(2.2 * SR))
slam = lp(n(0.6), 400) * np.exp(-t(0.6) / 0.12) * 2 + np.sin(2 * np.pi * 55 * t(0.6)) * np.exp(-t(0.6) / 0.2) * 1.5
grind = bp(n(0.55), 300, 1500) * np.linspace(0.2, 1, int(0.55 * SR)) * 0.5
place(buf, grind, 0.0)
place(buf, slam, 0.55)
place(buf, hp(n(1.2), 2500) * np.exp(-t(1.2) / 0.5) * 0.35, 0.8)  # pneumatic hiss
save("doors", buf)

# --- warp (Drift jump), shockwave (lock pulse) ---------------------------------------------------
d = 3.2
f = np.geomspace(60, 1400, int(d * SR))
x = lp(osc(f, d, "saw") + osc(f * 1.01, d, "saw"), 3500) * np.linspace(0.1, 1, int(d * SR)) ** 2
buf = np.zeros(int(4.4 * SR))
place(buf, x, 0)
place(buf, lp(n(1.2), 600) * np.exp(-t(1.2) / 0.35) * 2.5 + np.sin(2 * np.pi * 45 * t(1.2)) * np.exp(-t(1.2) / 0.4) * 2, 3.15)
save("warp", buf)

d = 2.4
tt = t(d)
x = np.sin(2 * np.pi * np.cumsum(np.geomspace(90, 30, len(tt))) / SR) * np.exp(-tt / 0.6) * 2
x += lp(n(d), 500) * np.exp(-tt / 0.4)
x += bp(n(d), 1500, 5000) * np.exp(-((tt - 0.15) ** 2) / 0.01) * 0.4
save("shockwave", x)

# --- wind (loop), cicadas (loop), chimes ---------------------------------------------------------
d = 4.0
tt = t(d)
w = n(d)
out = np.zeros_like(w)
fc = 500 + 350 * np.sin(2 * np.pi * 0.35 * tt) + 150 * np.sin(2 * np.pi * 0.9 * tt)
for i in range(0, len(w), 2048):
    seg = w[max(0, i - 2048):i + 2048]
    f0 = fc[i]
    out[i:i + 2048] = bp(seg, f0 * 0.6, f0 * 1.6)[-len(out[i:i + 2048]):]
save("wind", out * (0.7 + 0.3 * np.sin(2 * np.pi * 0.25 * tt)), loop=True)

d = 4.0
tt = t(d)
x = bp(n(d), 4200, 6200) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 42 * tt))) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.5 * tt))
save("cicadas", x, loop=True)

buf = np.zeros(int(2.4 * SR))
for i in range(9):
    place(buf, bell(note(int(rng.choice([79, 81, 84, 86, 88, 91]))), 1.2, 0.35) * (0.4 + 0.4 * rng.random()), i * 0.18 + rng.random() * 0.1)
save("chimes", buf)

# --- camera servo, neon sign, spotlight clunk ------------------------------------------------------
buf = np.zeros(int(1.2 * SR))
servo = osc(np.linspace(900, 1300, int(0.45 * SR)), 0.45, "saw")
place(buf, lp(servo, 2500) * env(int(0.45 * SR), 0.02, 0.05) * 0.5, 0.05)
place(buf, hp(n(0.04), 1500) * np.exp(-t(0.04) / 0.008) * 1.5, 0.6)  # shutter click
place(buf, hp(n(0.03), 1500) * np.exp(-t(0.03) / 0.006), 0.66)
save("camera", buf)

buf = np.zeros(int(1.6 * SR))
for at in (0.0, 0.12, 0.18, 0.4):
    place(buf, hp(n(0.02), 1000) * np.exp(-t(0.02) / 0.004) * 1.5, at)
hum = lp(osc(120, 1.1, "saw") + 0.5 * osc(240, 1.1, "square"), 1500) * 0.25
place(buf, hum * env(len(hum), 0.02, 0.3), 0.45)
save("neon", buf)

buf = np.zeros(int(1.6 * SR))
place(buf, lp(n(0.3), 300) * np.exp(-t(0.3) / 0.06) * 2 + np.sin(2 * np.pi * 70 * t(0.3)) * np.exp(-t(0.3) / 0.1), 0)
place(buf, lp(osc(100, 1.2, "saw"), 600) * env(int(1.2 * SR), 0.05, 0.6) * 0.3, 0.1)
save("spotlight", buf)

# --- commercials: cash register and three jingles -------------------------------------------------
buf = np.zeros(int(1.4 * SR))
place(buf, hp(n(0.08), 1200) * np.exp(-t(0.08) / 0.015), 0)
place(buf, bell(note(96), 1.2, 0.4) + 0.6 * bell(note(100), 1.2, 0.4), 0.08)
save("cash", buf)


def jingle(name, melody, bass, tempo=0.16, timbre="bell"):
    total = (max(at for _, at, _ in melody) + 2.0) * tempo / 0.16
    buf = np.zeros(int(total * SR))
    for k, at, dur in melody:
        if timbre == "bell":
            place(buf, bell(note(k), 0.9, 0.22) * 0.8, at * tempo / 0.16)
        else:
            d = dur * tempo / 0.16
            x = lp(osc(note(k), d, "saw") + 0.5 * osc(note(k) * 1.005, d, "saw"), 2800) * env(int(d * SR), 0.01, 0.08)
            place(buf, x * 0.6, at * tempo / 0.16)
    for k, at in bass:
        d = 0.3 * tempo / 0.16
        place(buf, lp(osc(note(k), d, "tri"), 600) * env(int(d * SR), 0.01, 0.1) * 0.8, at * tempo / 0.16)
    save(name, buf)


jingle("ad-jingle-a", [(72, 0, .15), (76, .16, .15), (79, .32, .15), (84, .48, .3), (79, .8, .15), (84, .96, .6)],
       [(48, 0), (55, .32), (48, .64), (55, .96)])
jingle("ad-jingle-b", [(79, 0, .2), (78, .2, .2), (79, .4, .2), (83, .6, .4), (81, 1.0, .2), (79, 1.2, .2), (76, 1.4, .6)],
       [(43, 0), (47, .4), (45, .8), (43, 1.2)], timbre="synth")
jingle("ad-jingle-c", [(84, 0, .12), (88, .12, .12), (91, .24, .12), (96, .36, .4), (91, .8, .12), (96, .92, .5)],
       [(60, 0), (64, .36), (67, .8)], tempo=0.13)
print("ok")
