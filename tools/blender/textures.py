"""Procedural tiling material textures for the cockpit models (numpy + Pillow, no external images).

Every texture is periodic (built in the frequency domain or from periodic patterns), so it tiles on box-projected UVs.
Albedo maps are near-neutral luminance variation (≈0.75–1.0); the colour comes from the glTF baseColorFactor, so one map
serves several colours. Normal maps are OpenGL convention (+Y up), as glTF expects.
Usage: python3 textures.py <outdir> [size]
"""
import sys, os
import numpy as np
from PIL import Image

RNG = np.random.default_rng(1729)


def fnoise(n, lo, hi, aniso=(1.0, 1.0)):
    """Periodic band-limited noise in [−1, 1]: white noise filtered to frequencies lo..hi (cycles per tile)."""
    w = RNG.standard_normal((n, n))
    F = np.fft.fft2(w)
    fy = np.fft.fftfreq(n)[:, None] * n * aniso[1]
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[0]
    r = np.sqrt(fx * fx + fy * fy)
    m = np.exp(-((np.log(np.maximum(r, 1e-6)) - np.log(np.sqrt(lo * hi))) ** 2) / (2 * (np.log(hi / lo) / 2.2) ** 2))
    m[0, 0] = 0
    out = np.real(np.fft.ifft2(F * m))
    return out / (np.abs(out).max() + 1e-9)


def cells(n, k):
    """Periodic Worley-style cell distance (F2−F1, normalised) for k feature points: leather grain."""
    pts = RNG.random((k, 2)) * n
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    d1 = np.full((n, n), 1e9, np.float32)
    d2 = np.full((n, n), 1e9, np.float32)
    for px, py in pts:
        dx = np.abs(xx - px); dx = np.minimum(dx, n - dx)
        dy = np.abs(yy - py); dy = np.minimum(dy, n - dy)
        d = np.sqrt(dx * dx + dy * dy)
        d2 = np.where(d < d1, d1, np.minimum(d2, d))
        d1 = np.minimum(d1, d)
    e = d2 - d1
    return e / e.max()


def normal_from_height(h, strength):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nz = np.ones_like(h)
    L = np.sqrt(gx * gx + gy * gy + nz * nz)
    # image rows go down; OpenGL normal maps have +Y up → flip gy
    n = np.stack([-gx / L, gy / L, nz / L], -1)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)


def save(path, arr, q=84):
    im = Image.fromarray(arr)
    if im.mode == 'L':
        im = im.convert('RGB')
    if 'normal' in path:  # normal maps at half size: fine detail only, and noisy maps compress poorly
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(path, 'JPEG', quality=q, subsampling=0 if 'normal' in path else 2)


def lum(v):
    v = np.clip(v, 0, 1)
    return (np.stack([v, v, v], -1) * 255).astype(np.uint8)


def build(out, n=512):
    os.makedirs(out, exist_ok=True)
    yy, xx = np.mgrid[0:n, 0:n] / n

    # woven seat fabric: basket weave threads + fibre noise (tile = 0.12 m)
    th = 48  # threads per tile
    wx = np.sin(xx * np.pi * th) ** 2
    wy = np.sin(yy * np.pi * th) ** 2
    checker = ((np.floor(xx * th / 2) + np.floor(yy * th / 2)) % 2)
    weave = np.where(checker > 0, wx * 0.8 + 0.2 * wy, wy * 0.8 + 0.2 * wx)
    fib = fnoise(n, 40, 200)
    mott = fnoise(n, 2, 8)
    h = weave * 0.8 + fib * 0.15
    save(f'{out}/fabric_albedo.jpg', lum(0.80 + 0.12 * weave + 0.05 * fib + 0.05 * mott))
    save(f'{out}/fabric_normal.jpg', normal_from_height(h, 2.2))

    # leather / vinyl grain (tile = 0.20 m)
    c = cells(n, 2600)
    g = fnoise(n, 30, 120)
    h = (1 - np.exp(-c * 9)) * 0.85 + g * 0.15
    save(f'{out}/leather_albedo.jpg', lum(0.86 + 0.08 * h + 0.05 * fnoise(n, 2, 10)))
    save(f'{out}/leather_normal.jpg', normal_from_height(h, 3.0))

    # cut-pile carpet (tile = 0.25 m)
    p = fnoise(n, 60, 250)
    blot = fnoise(n, 3, 12)
    save(f'{out}/carpet_albedo.jpg', lum(0.78 + 0.16 * p + 0.06 * blot))
    save(f'{out}/carpet_normal.jpg', normal_from_height(p * 0.9 + blot * 0.1, 3.5))

    # textured (stippled) interior plastic and wrinkle paint (tile = 0.15 m)
    s = fnoise(n, 50, 180)
    s = np.sign(s) * np.abs(s) ** 0.7
    wear = fnoise(n, 2, 6)
    save(f'{out}/plastic_albedo.jpg', lum(0.90 + 0.05 * s + 0.05 * wear))
    save(f'{out}/plastic_normal.jpg', normal_from_height(s, 1.6))

    # placeholder for the live panel faces (keeps their UVs through gltfpack; the app replaces the map)
    Image.new('RGB', (32, 32), (46, 46, 48)).save(f'{out}/panelph_albedo.jpg', 'JPEG', quality=90)

    # brushed / worn aluminium (tile = 0.2 m): anisotropic streaks, greyscale roughness variation in albedo
    b = fnoise(n, 4, 160, aniso=(0.04, 1.0))
    save(f'{out}/metal_albedo.jpg', lum(0.88 + 0.10 * b))

    # perforated headliner vinyl (tile = 0.10 m)
    k = 28
    hx = (xx * k) % 1 - 0.5
    hy = (yy * k + 0.5 * (np.floor(xx * k) % 2)) % 1 - 0.5
    hole = np.exp(-(hx * hx + hy * hy) / 0.012)
    v = fnoise(n, 20, 100)
    save(f'{out}/headliner_albedo.jpg', lum(0.95 - 0.25 * hole + 0.03 * v))
    save(f'{out}/headliner_normal.jpg', normal_from_height(-hole * 0.6 + v * 0.1, 2.0))


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else 'tex', int(sys.argv[2]) if len(sys.argv) > 2 else 512)
