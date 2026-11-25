"""Read and write models/a320-shell*.bin (format read by a320-3d.js).
Header: uint32 length + JSON {S, groups:[{off, nv, ni, i32, sizes:[sp,su,sn,si], uv:[u0,v0,du,dv], tex}], ...}
Per group: Int16 pos*3 (normalised, metres = v/32767*... see scale), Uint16 uv*2, Int8 colour+mat*4, Uint16/Uint32 index.
In the page the mesh scale is 32767/S on positions normalised to [-1,1], so metres = int16 / S.
"""
import json, struct
import numpy as np


def pad4(n):
    return (n + 3) & ~3


def read(path):
    b = open(path, 'rb').read()
    hl = struct.unpack('<I', b[:4])[0]
    hdr = json.loads(b[4:4 + hl])
    base = 4 + hl
    groups = []
    for g in hdr['groups']:
        o = base + g['off']
        sp, su, sn, si = g['sizes']
        P = np.frombuffer(b, '<i2', g['nv'] * 3, o).reshape(-1, 3).copy(); o += sp
        UV = np.frombuffer(b, '<u2', g['nv'] * 2, o).reshape(-1, 2).copy(); o += su
        N = np.frombuffer(b, 'i1', g['nv'] * 4, o).reshape(-1, 4).copy(); o += sn
        I = np.frombuffer(b, '<u4' if g['i32'] else '<u2', g['ni'], o).reshape(-1, 3).astype(np.int64)
        groups.append(dict(meta=g, P=P, UV=UV, N=N, I=I))
    return hdr, groups


def metres(hdr, g):
    return g['P'].astype(np.float64) / hdr['S']


def write(path, hdr, groups):
    hdr = json.loads(json.dumps(hdr))
    blobs = []
    off = 0
    for gm, g in zip(hdr['groups'], groups):
        I = g['I']
        used = np.unique(I)
        remap = -np.ones(len(g['P']), np.int64); remap[used] = np.arange(len(used))
        P, UV, N, I = g['P'][used], g['UV'][used], g['N'][used], remap[I]
        i32 = len(P) > 65535
        parts = [P.astype('<i2').tobytes(), UV.astype('<u2').tobytes(), N.astype('i1').tobytes(),
                 I.astype('<u4' if i32 else '<u2').tobytes()]
        padded = [p + b'\0' * (pad4(len(p)) - len(p)) for p in parts]
        gm['off'] = off; gm['nv'] = len(P); gm['ni'] = int(I.size); gm['i32'] = i32
        gm['sizes'] = [len(x) for x in padded]
        blob = b''.join(padded); blobs.append(blob); off += len(blob)
    hj = json.dumps(hdr, separators=(',', ':')).encode()
    hj += b' ' * (pad4(len(hj)) - len(hj))
    open(path, 'wb').write(struct.pack('<I', len(hj)) + hj + b''.join(blobs))
