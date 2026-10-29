"""Build crowd reactions from CC0 / CC-BY voice clips by layering pitch-shifted copies."""
import subprocess, sys, os, numpy as np, soundfile as sf
SR = 44100
SRC = "/home/claude/work/dl3"
OUT = "/home/claude/work/crowd/out"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def load(path, start=None, end=None, semis=0.0, tempo=1.0):
    af = [f"aresample={SR}"]
    if semis or tempo != 1.0:
        af.append(f"rubberband=pitch={2 ** (semis / 12):.5f}:tempo={tempo:.4f}:formant=preserved:pitchq=quality")
    cmd = ["ffmpeg", "-v", "error"]
    if start is not None: cmd += ["-ss", str(start)]
    if end is not None: cmd += ["-to", str(end)]
    cmd += ["-i", path, "-ac", "1", "-af", ",".join(af), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    # trim silence
    thr = 0.02 * np.max(np.abs(x) + 1e-9)
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx): x = x[max(0, idx[0] - 200): idx[-1] + 2000]
    return x / (np.max(np.abs(x)) + 1e-9)

def glide(x, r0, r1):
    """Time-varying playback rate: pitch slides from r0 to r1."""
    n = len(x)
    rates = np.linspace(r0, r1, n)
    pos = np.cumsum(rates)
    pos = pos[pos < n - 1]
    return np.interp(pos, np.arange(n), x)

def fade(x, a=0.03, b=0.15):
    n = len(x); fa = int(a * SR); fb = int(b * SR)
    env = np.ones(n)
    env[:fa] = np.linspace(0, 1, fa) ** 2
    env[-fb:] *= np.linspace(1, 0, fb) ** 1.5
    return x * env

def reverb(st, decay=1.1, mix=0.22):
    n = int(decay * SR)
    t = np.arange(n) / SR
    out = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.0 / decay)
        ir[:int(0.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        wet = np.convolve(st[ch], ir)[: len(st[ch]) + n // 2]
        dry = np.pad(st[ch], (0, len(wet) - len(st[ch])))
        out.append(dry * (1 - mix) + wet * mix)
    return np.array(out)

def mixdown(layers, length):
    st = np.zeros((2, length))
    for x, off, g, pan in layers:
        o = int(off * SR)
        seg = x[: max(0, length - o)]
        l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
        st[0, o:o + len(seg)] += seg * g * l
        st[1, o:o + len(seg)] += seg * g * r
    return st

def finish(st, name, peak=0.85):
    # gentle high-pass and low-pass via ffmpeg after normalising
    st = st / (np.max(np.abs(st)) + 1e-9) * peak
    tmp = f"{OUT}/{name}.wav"
    sf.write(tmp, st.T.astype(np.float32), SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", "highpass=f=110,lowpass=f=9000,loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "44100", "-c:a", "libvorbis", "-q:a", "5", f"{OUT}/{name}.ogg"], check=True)
    print(name, st.shape[1] / SR)

S = f"{SRC}/x/spurts"
# ---------- crowd "Ooh!" (impressed, rising then held) ----------
ooh_sources = [(f"{SRC}/oooo.ogg", 0.0, 1.5), (f"{S}/Ohh_01.wav", None, None), (f"{S}/Ohh_02.wav", None, None),
               (f"{S}/Woah_01.wav", None, None), (f"{S}/Woah_02.wav", None, None), (f"{S}/(surprised)_03.wav", None, None)]
layers = []
for i, semis in enumerate([-7, -5, -4, -2, -1, 0, 1, 2, 3, -3, -6, 0.5, 2.5, -2.5]):
    path, a, b = ooh_sources[i % len(ooh_sources)]
    tempo = rng.uniform(0.62, 0.8)  # stretch so the "ooh" is held
    x = load(path, a, b, semis=semis, tempo=tempo)
    x = glide(x, rng.uniform(0.94, 0.98), rng.uniform(1.03, 1.07))  # slight rise, the classic impressed "oooOOH"
    layers.append((fade(x, 0.08, 0.35), rng.uniform(0, 0.16), rng.uniform(0.45, 1.0), rng.uniform(-0.8, 0.8)))
L = max(int(o * SR) + len(x) for x, o, _, _ in layers)
finish(reverb(mixdown(layers, L), 1.3, 0.28), "crowd-ooh")

# ---------- crowd "Aww…" (sympathetic, falling) ----------
aww_sources = [(f"{S}/Ohh_01.wav", None, None), (f"{S}/Ohh_02.wav", None, None), (f"{S}/(worried)_01.wav", None, None),
               (f"{SRC}/oooo.ogg", 0.0, 1.2), (f"{S}/Oh_01.wav", None, None), (f"{S}/Oh_02.wav", None, None)]
layers = []
for i, semis in enumerate([-6, -4, -3, -1, 0, 1, 2, 3, -5, -2, 0.5, 1.5, -7, 2.5]):
    path, a, b = aww_sources[i % len(aww_sources)]
    x = load(path, a, b, semis=semis + 2, tempo=rng.uniform(0.55, 0.7))
    x = glide(x, rng.uniform(1.04, 1.08), rng.uniform(0.80, 0.86))  # falls ~4 semitones: "awww…"
    layers.append((fade(x, 0.06, 0.45), rng.uniform(0, 0.14), rng.uniform(0.45, 1.0), rng.uniform(-0.8, 0.8)))
L = max(int(o * SR) + len(x) for x, o, _, _ in layers)
finish(reverb(mixdown(layers, L), 1.3, 0.28), "crowd-aww")

# ---------- "Really leave?": Celmak's distressed "No, no, no…" over a sad crowd ----------
segs = [(0.22, 0.72), (1.36, 1.95), (2.69, 3.20), (3.76, 4.44)]
voice = []
for k, (a, b) in enumerate(segs):
    x = load(f"{SRC}/female_distressed_no_no_no.ogg", a, b)
    voice.append(fade(x, 0.01, 0.06) * [1.0, 0.92, 0.85, 0.8][k])
    voice.append(np.zeros(int([0.10, 0.08, 0.14, 0][k] * SR)))
voice = np.concatenate(voice)
crowd, _ = sf.read(f"{OUT}/crowd-aww.wav")
crowd = crowd.T
L = int(0.35 * SR) + max(len(voice), crowd.shape[1])
st = np.zeros((2, L))
st[:, : crowd.shape[1]] += crowd * 0.35
st[:, int(0.35 * SR): int(0.35 * SR) + len(voice)] += np.vstack([voice, voice]) * 0.9
finish(reverb(st, 0.7, 0.12), "dont-leave")

# ---------- Ba-dum-tss (public domain recording) ----------
x = load("/home/claude/work/dl2/rimshot.flac")
finish(np.vstack([x, x]), "rimshot", 0.95)
