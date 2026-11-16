"""Assemble a FlightGear aircraft model: follow the model XML files, place every .ac file with its offsets, and return
materials-per-object meshes in one frame (AC3D axes: x aft, y up, z to the left of the aircraft, metres)."""
import os, re, math, numpy as np, ac3d
from lxml import etree
def rot(axis, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array({'x': [[1, 0, 0], [0, c, -s], [0, s, c]], 'y': [[c, 0, s], [0, 1, 0], [-s, 0, c]], 'z': [[c, -s, 0], [s, c, 0], [0, 0, 1]]}[axis])
def offsets(node):
    o = node.find('offsets'); g = lambda k: float((o.findtext(k) or '0').strip() or 0) if o is not None else 0.0
    # SimGear: v' = v * Ry(pitch) * Rx(roll) * Rz(heading) * T (row vectors)  ->  column form: Rz Rx Ry
    R = rot('z', g('heading-deg')) @ rot('x', g('roll-deg')) @ rot('y', g('pitch-deg')); return R, np.array([g('x-m'), g('y-m'), g('z-m')])
A2F = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)      # ac (x, y, z) -> FlightGear (x, -z, y)
def assemble(root, xml, skip=None, log=None):
    """root: aircraft folder; xml: model file relative to root. skip(path, inst) -> True leaves a sub-model out."""
    out = []; seen = []
    def resolve(p, base):
        p = p.strip()
        if p.startswith('Aircraft/'):
            parts = p.split('/'); q = os.path.join(root, *parts[2:]); return q if os.path.exists(q) else None
        q = os.path.normpath(os.path.join(base, p)); return q if os.path.exists(q) else (os.path.join(root, p) if os.path.exists(os.path.join(root, p)) else None)
    def parse(f):
        try: return etree.parse(f, etree.XMLParser(recover=True, remove_comments=True)).getroot()
        except Exception as e: return None
    def load(f, R, t, inst, depth):
        if depth > 12 or f is None: return
        if f.lower().endswith('.ac'):
            try: mats, objs = ac3d.load(f)
            except Exception as e:
                if log is not None: log.append(('bad ac', f, str(e)))
                return
            d = os.path.dirname(f)
            for o in objs:
                v = o['v'] @ A2F.T; v = v @ R.T + t; o['v'] = v @ A2F          # back to ac axes (A2F is orthogonal)
                o['mats'] = mats; o['file'] = os.path.relpath(f, root); o['inst'] = inst; o['tex'] = os.path.join(d, o['tex']) if o['tex'] else None; out.append(o)
            return
        x = parse(f)
        if x is None: return
        base = os.path.dirname(f); Ro, to = offsets(x); R2 = R @ Ro; t2 = R @ to + t
        inc = x.get('include')
        if inc: load(resolve(inc, base), R, t, inst, depth + 1)
        p = x.findtext('path')
        if p: load(resolve(p, base), R2, t2, inst, depth + 1)
        for m in x.findall('model'):
            mp = m.findtext('path'); nm = (m.findtext('name') or '').strip()
            if not mp: continue
            q = resolve(mp, base); ii = inst + [nm or os.path.splitext(os.path.basename(mp.strip()))[0]]
            if q is None:
                if log is not None: log.append(('missing', mp.strip(), '/'.join(inst)))
                continue
            cond = m.find('condition') is not None
            if log is not None: seen.append(('/'.join(ii), os.path.relpath(q, root), cond))
            if skip and skip(os.path.relpath(q, root), '/'.join(ii), cond): continue
            Rm, tm = offsets(m); load(q, R2 @ Rm, R2 @ tm + t2, ii, depth + 1)
    load(os.path.join(root, xml), np.eye(3), np.zeros(3), [], 0)
    if log is not None: log.extend(('model',) + s for s in seen)
    return out
def selects(root, xml_files):
    """the select animations of some model files: [(file, [object names], has condition)] to help decide what to hide"""
    R = []
    for f in xml_files:
        x = etree.parse(os.path.join(root, f), etree.XMLParser(recover=True, remove_comments=True)).getroot()
        for a in x.findall('animation'):
            if (a.findtext('type') or '').strip() == 'select': R.append((f, [n.text.strip() for n in a.findall('object-name')], etree.tostring(a.find('condition')).decode()[:300] if a.find('condition') is not None else ''))
    return R
if __name__ == '__main__':
    import sys
    log = []; O = assemble(sys.argv[1], sys.argv[2], None, log)
    for l in log: print(l)
    V = np.concatenate([o['v'] for o in O]); print(len(O), 'meshes', sum(len(o['faces']) for o in O), 'faces bbox', V.min(0).round(2), V.max(0).round(2))
