"""Birdbird cockpit modelling kit for headless Blender (bpy 5.x as a Python module).

All geometry is written in the COCKPIT FRAME used by cockpit3d.js: metres, x = right, y = up, z = aft (forward is −z),
origin on the aircraft centre line at the cabin reference height (each aircraft file documents it). glTF is +Y up, so the
cockpit frame is exactly the glTF/three.js frame; inside Blender (Z up) a point (x, y, z) lives at (x, −z, y), and the glTF
exporter's +Y-up conversion maps it back.

Pieces are accumulated per Blender object in a Geo (vertices + polygons + material per polygon), with primitives that
build consistently oriented, outward-facing surfaces: grid (parametric sheet), rbox (rounded box with an optional deform
callback, for cushions and knobs), tube (swept circle/ellipse along a path, for posts, handles, yokes), lathe (revolved
profile), prism (extruded outline). UV0 is a box projection in metres / material tile size (for the tiling detail maps),
UV1 ("lightmap") is a shared atlas for the baked ambient occlusion.
"""
import bpy, bmesh, math, os, json
import numpy as np
from mathutils import Vector, Matrix, Euler, Quaternion

D2R = math.pi / 180


# ----------------------------------------------------------------------------------------------- frames & matrices
def B(p):
    """cockpit frame → Blender coordinates"""
    return (p[0], -p[2], p[1])


def T(x=0, y=0, z=0):
    m = np.eye(4); m[:3, 3] = (x, y, z); return m


def RX(a):
    c, s = math.cos(a), math.sin(a); m = np.eye(4); m[1, 1] = c; m[1, 2] = -s; m[2, 1] = s; m[2, 2] = c; return m


def RY(a):
    c, s = math.cos(a), math.sin(a); m = np.eye(4); m[0, 0] = c; m[0, 2] = s; m[2, 0] = -s; m[2, 2] = c; return m


def RZ(a):
    c, s = math.cos(a), math.sin(a); m = np.eye(4); m[0, 0] = c; m[0, 1] = -s; m[1, 0] = s; m[1, 1] = c; return m


def S(x, y=None, z=None):
    m = np.eye(4); m[0, 0] = x; m[1, 1] = x if y is None else y; m[2, 2] = x if z is None else z; return m


def M(*ms):
    """M(a, b, c) = a @ b @ c (apply c first)"""
    r = np.eye(4)
    for m in ms:
        r = r @ m
    return r


def basis(o, ex, ey, ez):
    """matrix whose local x, y, z axes are ex, ey, ez placed at o"""
    m = np.eye(4); m[:3, 0] = ex; m[:3, 1] = ey; m[:3, 2] = ez; m[:3, 3] = o; return m


def xf(m, pts):
    p = np.asarray(pts, float)
    return p @ m[:3, :3].T + m[:3, 3]


def v3(*a):
    return np.array(a, float)


def nrm(v):
    v = np.asarray(v, float); return v / (np.linalg.norm(v) + 1e-12)


# ----------------------------------------------------------------------------------------------- geometry accumulator
class Geo:
    def __init__(self):
        self.V = []      # np arrays (k,3)
        self.F = []      # lists of vertex index lists (global)
        self.Mt = []     # material name per face
        self.n = 0

    def add(self, verts, faces, mat, toward=None, orient=None):
        verts = np.asarray(verts, float)
        faces = [list(f) for f in faces]
        if toward is not None:      # open sheet: flip so normals face the point
            c = verts.mean(0)
            fn = _face_normal(verts, faces[len(faces) // 2])
            pc = verts[faces[len(faces) // 2]].mean(0)
            if np.dot(fn, np.asarray(toward) - pc) < 0:
                faces = [f[::-1] for f in faces]
        elif orient == 'closed':    # closed solid: make the signed volume positive (outward normals)
            if _signed_volume(verts, faces) < 0:
                faces = [f[::-1] for f in faces]
        base = self.n
        self.V.append(verts); self.n += len(verts)
        self.F.extend([[base + i for i in f] for f in faces]); self.Mt.extend([mat] * len(faces))
        return self

    def merge(self, other, m=None):
        V = np.concatenate(other.V) if other.V else np.zeros((0, 3))
        if m is not None:
            V = xf(m, V)
        base = self.n
        self.V.append(V); self.n += len(V)
        self.F.extend([[base + i for i in f] for f in other.F]); self.Mt.extend(other.Mt)
        return self

    def verts(self):
        return np.concatenate(self.V) if self.V else np.zeros((0, 3))

    def tris(self):
        return sum(len(f) - 2 for f in self.F)


def _face_normal(V, f):
    n = np.zeros(3)
    for i in range(len(f)):
        a, b = V[f[i]], V[f[(i + 1) % len(f)]]
        n += np.array([(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])])
    return nrm(n)


def _signed_volume(V, F):
    s = 0.0
    for f in F:
        a = V[f[0]]
        for i in range(1, len(f) - 1):
            s += np.dot(a, np.cross(V[f[i]], V[f[i + 1]]))
    return s


# ----------------------------------------------------------------------------------------------- primitives
def grid(g, nu, nv, fn, mat, toward=None, m=None, closed_u=False):
    """parametric sheet fn(u, v) → point; quads; normals toward a point when given"""
    cu = nu if closed_u else nu + 1
    V = np.array([fn(i / nu, j / nv) for j in range(nv + 1) for i in range(cu)], float)
    if m is not None:
        V = xf(m, V)
    F = []
    for j in range(nv):
        for i in range(nu):
            i1 = (i + 1) % cu
            F.append([j * cu + i, j * cu + i1, (j + 1) * cu + i1, (j + 1) * cu + i])
    g.add(V, F, mat, toward=toward if toward is not None else None)
    return g


def _spacing(n, bias):
    """n+1 samples in [−1,1] crowded toward the ends (bias>1) for rounded edges"""
    t = np.linspace(-1, 1, n + 1)
    return np.sign(t) * np.abs(t) ** (1 / bias)


def rbox(g, size, r, mat, m=None, seg=3, flat=2, deform=None):
    """rounded box: full size (sx, sy, sz), edge radius r (scalar or per-axis); seg segments per rounded edge,
    flat segments across each face. deform(p, n) → p' in local coordinates (cushion puffing, pleats)."""
    hx, hy, hz = [s / 2 for s in size]
    rr = np.minimum(np.broadcast_to(np.asarray(r, float), (3,)), np.array([hx, hy, hz]) * 0.999)
    inner = np.array([hx, hy, hz]) - rr
    fl = flat if isinstance(flat, (tuple, list)) else (flat, flat, flat)
    def axis_samples(h, rad, nf=2):
        # rounded band: angles 45°→0° around the edge (the other 45° belong to the neighbouring face)
        th = np.linspace(math.pi / 4, 0, seg + 1)[:-1]
        lo = -h + rad - rad * np.tan(th)
        return np.concatenate([lo, np.linspace(-h + rad, h - rad, nf + 1), -lo[::-1]])
    ax = [axis_samples(h, rad, nf) for h, rad, nf in zip((hx, hy, hz), rr, fl)]
    V = []; F = []
    faces = [(0, 1, 2, +1), (0, 1, 2, -1), (1, 2, 0, +1), (1, 2, 0, -1), (2, 0, 1, +1), (2, 0, 1, -1)]
    # (normal axis, u axis, v axis, sign)
    for (na, ua, va, sg) in faces:
        h = [hx, hy, hz]
        us, vs = ax[ua], ax[va]
        base = len(V)
        for j, vv in enumerate(vs):
            for i, uu in enumerate(us):
                q = np.zeros(3); q[na] = sg * h[na]; q[ua] = uu; q[va] = vv
                c = np.clip(q, -inner, inner)
                d = q - c
                L = np.linalg.norm(d)
                # superellipse-like rounding: push the point to distance r from the inner box
                dn = d / L if L > 1e-12 else np.eye(3)[na] * sg
                p = c + dn * rr  # per-axis radius
                if deform is not None:
                    p = deform(p, dn)
                V.append(p)
        nu = len(us)
        for j in range(len(vs) - 1):
            for i in range(nu - 1):
                a = base + j * nu + i
                quad = [a, a + 1, a + nu + 1, a + nu]
                F.append(quad if sg > 0 else quad[::-1])
    V = np.array(V)
    if m is not None:
        V = xf(m, V)
    g.add(V, F, mat, orient='closed')
    return g


def box(g, c, size, mat, m=None):
    """sharp box (one quad per face)"""
    hx, hy, hz = [s / 2 for s in size]
    V = np.array([[x, y, z] for z in (-hz, hz) for y in (-hy, hy) for x in (-hx, hx)]) + np.asarray(c, float)
    F = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]
    if m is not None:
        V = xf(m, V)
    g.add(V, F, mat, orient='closed')
    return g


def _frames(P):
    """parallel-transport frames along a polyline"""
    P = np.asarray(P, float); n = len(P)
    Tn = np.array([nrm(P[min(n - 1, i + 1)] - P[max(0, i - 1)]) for i in range(n)])
    ref = np.array([0, 1, 0]) if abs(Tn[0][1]) < 0.9 else np.array([1, 0, 0])
    N0 = nrm(np.cross(ref, Tn[0])); Ns = [N0]
    for i in range(1, n):
        b = np.cross(Tn[i - 1], Tn[i]); s = np.linalg.norm(b)
        Nc = Ns[-1]
        if s > 1e-9:
            b /= s; ang = math.atan2(s, np.dot(Tn[i - 1], Tn[i]))
            Nc = Nc * math.cos(ang) + np.cross(b, Nc) * math.sin(ang) + b * np.dot(b, Nc) * (1 - math.cos(ang))
        Ns.append(nrm(Nc - Tn[i] * np.dot(Nc, Tn[i])))
    Bs = [np.cross(Tn[i], Ns[i]) for i in range(n)]
    return Tn, np.array(Ns), np.array(Bs)


def tube(g, path, radius, mat, sides=10, caps=True, m=None, up=None, ry=None):
    """swept cross-section along path; radius scalar/list; ry: second semi-axis (ellipse) scalar/list;
    up: optional fixed direction for the ellipse's first axis"""
    P = np.asarray(path, float); n = len(P)
    R = np.broadcast_to(np.asarray(radius, float), (n,))
    RY_ = R if ry is None else np.broadcast_to(np.asarray(ry, float), (n,))
    Tn, Ns, Bs = _frames(P)
    if up is not None:
        upv = nrm(up)
        Ns = np.array([nrm(upv - t * np.dot(upv, t)) for t in Tn]); Bs = np.array([np.cross(t, nn) for t, nn in zip(Tn, Ns)])
    V = []
    for i in range(n):
        for k in range(sides):
            a = 2 * math.pi * k / sides
            V.append(P[i] + Ns[i] * math.cos(a) * R[i] + Bs[i] * math.sin(a) * RY_[i])
    F = []
    for i in range(n - 1):
        for k in range(sides):
            k1 = (k + 1) % sides
            F.append([i * sides + k, i * sides + k1, (i + 1) * sides + k1, (i + 1) * sides + k])
    if caps:
        F.append(list(range(sides))[::-1]); F.append([(n - 1) * sides + k for k in range(sides)])
    V = np.array(V)
    if m is not None:
        V = xf(m, V)
    g.add(V, F, mat, orient='closed' if caps else None)
    return g


def lathe(g, prof, mat, seg=20, m=None, a0=0.0, a1=2 * math.pi):
    """revolve profile [(r, h), …] around local +Y; r=0 ends close the solid"""
    full = abs(a1 - a0 - 2 * math.pi) < 1e-9
    cols = seg if full else seg + 1
    V = []
    for (r, h) in prof:
        for k in range(cols):
            a = a0 + (a1 - a0) * k / seg
            V.append((r * math.cos(a), h, -r * math.sin(a)))
    F = []
    for j in range(len(prof) - 1):
        for k in range(seg):
            k1 = (k + 1) % cols if full else k + 1
            F.append([j * cols + k, j * cols + k1, (j + 1) * cols + k1, (j + 1) * cols + k])
    V = np.array(V, float)
    if m is not None:
        V = xf(m, V)
    g.add(V, F, mat, orient='closed' if full else None)
    return g


def prism(g, poly, depth, mat, m=None, z0=None):
    """extrude a 2D outline [(a, b), …] (local x, y) along local z from z0 (default −depth/2) by depth"""
    z0 = -depth / 2 if z0 is None else z0
    k = len(poly)
    V = [(a, b, z0) for a, b in poly] + [(a, b, z0 + depth) for a, b in poly]
    F = [list(range(k))[::-1], [k + i for i in range(k)]]
    for i in range(k):
        i1 = (i + 1) % k
        F.append([i, i1, k + i1, k + i])
    V = np.array(V, float)
    if m is not None:
        V = xf(m, V)
    g.add(V, F, mat, orient='closed')
    return g


def disc(g, r, mat, m, seg=24):
    V = [(r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), 0) for k in range(seg)]
    g.add(xf(m, V), [list(range(seg))], mat)
    return g


# ----------------------------------------------------------------------------------------------- materials
MATS = {}       # name → spec
TEXDIR = None


def material_specs(specs, texdir):
    """specs: name → dict(color=(r,g,b) linear-ish sRGB 0..1, rough, metal, tex=None|'fabric'|…, tile=m, nstr, alpha, emit)"""
    global TEXDIR
    TEXDIR = texdir
    MATS.clear(); MATS.update(specs)


def srgb2lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


_img_cache = {}


def _img(path, noncolor=False):
    key = (path, noncolor)
    if key in _img_cache:
        return _img_cache[key]
    im = bpy.data.images.load(path, check_existing=True)
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    _img_cache[key] = im
    return im


def gltf_group():
    name = 'glTF Material Output'
    g = bpy.data.node_groups.get(name)
    if g:
        return g
    g = bpy.data.node_groups.new(name, 'ShaderNodeTree')
    g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket('Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def build_material(name, ao_image=None):
    sp = MATS[name]
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (600, 0)
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); bs.location = (300, 0)
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    col = list(srgb2lin(sp['color'])) + [1.0]
    bs.inputs['Roughness'].default_value = sp.get('rough', 0.6)
    bs.inputs['Metallic'].default_value = sp.get('metal', 0.0)
    tex = sp.get('tex')
    if tex:
        uv0 = nt.nodes.new('ShaderNodeUVMap'); uv0.uv_map = 'UVMap'; uv0.location = (-700, 200)
        it = nt.nodes.new('ShaderNodeTexImage'); it.image = _img(f'{TEXDIR}/{tex}_albedo.jpg'); it.location = (-450, 250)
        nt.links.new(uv0.outputs['UV'], it.inputs['Vector'])
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.location = (0, 250)
        mix.inputs['Factor'].default_value = 1.0
        nt.links.new(it.outputs['Color'], mix.inputs[6])
        mix.inputs[7].default_value = col
        nt.links.new(mix.outputs[2], bs.inputs['Base Color'])
        npath = f'{TEXDIR}/{tex}_normal.jpg'
        if os.path.exists(npath) and sp.get('nstr', 1.0) > 0:
            nm = nt.nodes.new('ShaderNodeTexImage'); nm.image = _img(npath, True); nm.location = (-450, -250)
            nt.links.new(uv0.outputs['UV'], nm.inputs['Vector'])
            nn = nt.nodes.new('ShaderNodeNormalMap'); nn.location = (0, -250); nn.inputs['Strength'].default_value = sp.get('nstr', 1.0)
            nn.uv_map = 'UVMap'
            nt.links.new(nm.outputs['Color'], nn.inputs['Color']); nt.links.new(nn.outputs['Normal'], bs.inputs['Normal'])
    else:
        bs.inputs['Base Color'].default_value = col
    if sp.get('emit'):
        bs.inputs['Emission Color'].default_value = list(srgb2lin(sp['emit'])) + [1]
        bs.inputs['Emission Strength'].default_value = sp.get('emit_str', 1.0)
    if sp.get('alpha', 1.0) < 1.0:
        bs.inputs['Alpha'].default_value = sp['alpha']
        mat.surface_render_method = 'BLENDED'
        bs.inputs['IOR'].default_value = 1.0
        bs.inputs['Transmission Weight'].default_value = 0.0
    mat.use_backface_culling = not sp.get('double', False)
    if ao_image is not None and sp.get('ao', True):
        uv1 = nt.nodes.new('ShaderNodeUVMap'); uv1.uv_map = 'lightmap'; uv1.location = (-700, -600)
        ai = nt.nodes.new('ShaderNodeTexImage'); ai.image = ao_image; ai.location = (-450, -600); ai.name = 'AO'
        nt.links.new(uv1.outputs['UV'], ai.inputs['Vector'])
        sep = nt.nodes.new('ShaderNodeSeparateColor'); sep.location = (-150, -600)
        nt.links.new(ai.outputs['Color'], sep.inputs['Color'])
        gg = nt.nodes.new('ShaderNodeGroup'); gg.node_tree = gltf_group(); gg.location = (300, -600)
        nt.links.new(sep.outputs[0], gg.inputs['Occlusion'])
        nt.nodes.active = ai
    return mat


# ----------------------------------------------------------------------------------------------- Blender objects
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _img_cache.clear()
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
    return sc


def empty(name, pivot=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    _place(o, pivot, parent)
    o.empty_display_size = 0.05
    return o


def _place(o, pivot, parent):
    if parent is not None:
        o.parent = parent
        pw = parent.matrix_world.translation
        o.location = Vector(B(pivot)) - pw
    else:
        o.location = Vector(B(pivot))


def to_object(name, g, pivot=(0, 0, 0), parent=None, smooth_angle=34, ao=True, uv_override=None):
    """Geo (cockpit frame, world coordinates) → mesh object with its origin at pivot.
    uv_override: callable(p_cockpit) → (u, v) for UV0 (e.g. the panel faces); default is box projection by material tile."""
    V = g.verts()
    me = bpy.data.meshes.new(name)
    Vb = np.stack([V[:, 0], -V[:, 2], V[:, 1]], 1) - np.array(B(pivot))
    me.from_pydata(Vb.tolist(), [], g.F)
    # materials
    names = []
    for mn in g.Mt:
        if mn not in names:
            names.append(mn)
    for mn in names:
        me.materials.append(bpy.data.materials.get(mn) or build_material(mn))
    idx = {mn: i for i, mn in enumerate(names)}
    me.polygons.foreach_set('material_index', [idx[mn] for mn in g.Mt])
    # UV0
    uv = me.uv_layers.new(name='UVMap')
    loops_uv = []
    for fi, f in enumerate(g.F):
        P = V[f]
        if uv_override is not None:
            loops_uv.extend([uv_override(p) for p in P]); continue
        n = _face_normal(V, f)
        tile = MATS.get(g.Mt[fi], {}).get('tile', 0.2)
        a = int(np.argmax(np.abs(n)))
        if a == 0:
            uvs = [(p[2] * np.sign(n[0]) * -1, p[1]) for p in P]
        elif a == 1:
            uvs = [(p[0], -p[2] * np.sign(n[1])) for p in P]
        else:
            uvs = [(p[0] * np.sign(n[2]), p[1]) for p in P]
        loops_uv.extend([(x / tile, y / tile) for x, y in uvs])
    uv.data.foreach_set('uv', np.array(loops_uv, float).ravel())
    if ao:
        me.uv_layers.new(name='lightmap')
    me.uv_layers['UVMap'].active_render = True
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    _place(o, pivot, parent)
    # weld coincident vertices (rounded-box seams), then smooth by angle
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > smooth_angle * D2R:
            e.smooth = False
    bm.to_mesh(me); bm.free()
    o['ao'] = bool(ao)
    return o


def tri_count(objs):
    t = 0
    for o in objs:
        if o.type == 'MESH':
            t += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return t


# ----------------------------------------------------------------------------------------------- lightmap + AO bake
def bake_ao(objs, glass, out_path, size=1024, samples=48, distance=0.35, margin=4):
    """one shared AO atlas (UV1 'lightmap') for objs; glass hidden while baking"""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    sc.render.threads_mode = 'FIXED'; sc.render.threads = 2
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.light_settings.distance = distance
    # UV1 atlas: smart project all together, equal texel density, pack
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True); o.data.uv_layers.active = o.data.uv_layers['lightmap']
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(52), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(rotate=True, margin=margin / size * 1.6)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new('ao_atlas', size, size, alpha=False)
    img.generated_color = (1, 1, 1, 1)
    for o in objs:
        for slot in o.material_slots:
            mt = slot.material
            if mt is None or mt.get('_ao_done'):
                continue
            build_material(mt.name, ao_image=img); mt['_ao_done'] = 1
    hidden = []
    for gobj in glass:
        gobj.hide_render = True; hidden.append(gobj)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    sc.render.bake.margin = margin
    sc.render.bake.target = 'IMAGE_TEXTURES'
    bpy.ops.object.bake(type='AO', margin=margin, use_clear=True)
    for gobj in hidden:
        gobj.hide_render = False
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers['UVMap']
    tmp = out_path + '.png'
    img.filepath_raw = tmp; img.file_format = 'PNG'; img.save()
    # light denoise (median) + JPEG
    from PIL import Image, ImageFilter
    Image.open(tmp).convert('L').filter(ImageFilter.MedianFilter(3)).convert('RGB').save(out_path, 'JPEG', quality=85)
    # reload from disk so the exporter embeds the JPEG
    img2 = bpy.data.images.load(out_path)
    for m in bpy.data.materials:
        if m.node_tree and 'AO' in m.node_tree.nodes:
            m.node_tree.nodes['AO'].image = img2
    return img2


# ----------------------------------------------------------------------------------------------- export
def export_glb(path, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
                              export_image_format='AUTO', export_extras=True, export_cameras=False, export_lights=False,
                              export_animations=False, export_vertex_color='NONE')


def gltfpack(src, dst):
    import subprocess
    gp = os.environ.get('GLTFPACK', '/tmp/dl/gp/node_modules/.bin/gltfpack')
    # -c: meshopt (EXT_meshopt_compression) + quantisation; -kn/-km/-ke: keep named nodes, materials and extras (the app
    # animates the named nodes); -vtf: float UVs so the panel faces map 0..1 without a texture transform
    r = subprocess.run([gp, '-i', src, '-o', dst, '-c', '-kn', '-km', '-ke', '-vtf', '-vpf'], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stdout + r.stderr)
    return r.stdout


# ----------------------------------------------------------------------------------------------- preview render
def look_dir(yaw, pitch):
    """cockpit3d.js view angles (yaw + right, pitch + up) → direction in the cockpit frame"""
    y, p = yaw * D2R, pitch * D2R
    return np.array([math.sin(y) * math.cos(p), math.sin(p), -math.cos(y) * math.cos(p)])


def preview(path, eye, yaw, pitch, hfov=88, res=(1280, 800), samples=40, panel_image=None, sun=(-0.45, 0.55, -0.75), exposure=1.4):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = samples; sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 2; sc.cycles.transparent_max_bounces = 6
    sc.cycles.sample_clamp_indirect = 3.0
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast' if 'AgX - Medium High Contrast' in [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items] else 'None'
    sc.view_settings.exposure = exposure
    cam = bpy.data.cameras.new('cam'); cam.sensor_fit = 'HORIZONTAL'; cam.angle = hfov * D2R; cam.clip_start = 0.02
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co)
    co.location = Vector(B(eye))
    d = look_dir(yaw, pitch)
    co.rotation_euler = Vector(B(d)).to_track_quat('-Z', 'Z').to_euler()
    sc.camera = co
    # sky + sun + ground
    w = sc.world; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    bg = nt.nodes.new('ShaderNodeBackground'); sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'HOSEK_WILKIE'
    sky.sun_direction = Vector(B(nrm(sun))); sky.turbidity = 3.0
    o = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
    nt.links.new(bg.outputs['Background'], o.inputs['Surface'])
    ls = bpy.data.lights.new('sun', 'SUN'); ls.energy = 4.0; ls.angle = 2 * D2R
    lo = bpy.data.objects.new('sun', ls); sc.collection.objects.link(lo)
    lo.rotation_euler = Vector(B(nrm(sun))).to_track_quat('Z', 'Y').to_euler()
    gm = bpy.data.meshes.new('ground'); s = 400
    gm.from_pydata([(-s, -s, -1.9), (s, -s, -1.9), (s, s, -1.9), (-s, s, -1.9)], [], [[0, 1, 2, 3]])
    gmat = bpy.data.materials.new('ground'); gmat.use_nodes = True
    gmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.09, 0.12, 0.07, 1)
    gm.materials.append(gmat)
    go = bpy.data.objects.new('ground', gm); sc.collection.objects.link(go)
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    # no OIDN in the bpy wheel: a light median filter takes the remaining path-tracing grain off
    from PIL import Image, ImageFilter
    Image.open(path).convert('RGB').filter(ImageFilter.MedianFilter(3)).save(path)
    for ob in (co, lo, go):
        bpy.data.objects.remove(ob)


def set_panel_preview(names_images):
    """temporarily put a picture of the live panel on the *_face meshes for the preview render"""
    for name, path in names_images.items():
        o = bpy.data.objects.get(name)
        if not o or not path or not os.path.exists(path):
            continue
        mt = o.data.materials[0].copy()          # the faces share one material: give each its own picture
        o.data.materials[0] = mt
        nt = mt.node_tree; bs = nt.nodes.get('Principled BSDF')
        it = nt.nodes.new('ShaderNodeTexImage'); it.image = bpy.data.images.load(path)
        nt.links.new(it.outputs['Color'], bs.inputs['Base Color'])
        if 'Alpha' in it.outputs:
            nt.links.new(it.outputs['Alpha'], bs.inputs['Alpha'])
            mt.surface_render_method = 'DITHERED'
        bs.inputs['Roughness'].default_value = 0.55
        nt.links.new(it.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 0.35
