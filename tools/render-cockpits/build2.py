"""Build a Blender scene from a FlightGear aircraft (model XML + .ac files). usage: build2.py <config.py>
config: ROOT, XML, OUT (.blend), SKIP (regex on sub-model path/instance), HIDE (regex on object name or 'file:name'), DIM (regex), optional fix(o)."""
import sys, os, re, math, runpy; sys.path.insert(0, '/home/claude/rend')
import bpy, bmesh, numpy as np, fgmodel
C = runpy.run_path(sys.argv[-1]); SKIP = re.compile(C.get('SKIP') or r'(?!)'); HIDE = re.compile(C.get('HIDE') or r'(?!)'); DIMR = re.compile(C['DIM']) if C.get('DIM') else None; EMIT = re.compile(C['EMIT']) if C.get('EMIT') else None
log = []; objs = fgmodel.assemble(C['ROOT'], C['XML'], lambda p, inst, cond: bool(SKIP.search(p) or SKIP.search(inst)), log)
objs = [o for o in objs if not HIDE.fullmatch(o['name']) and not HIDE.fullmatch(o['file'] + ':' + o['name']) and not any(HIDE.fullmatch(p) for p in o['path'])]
if C.get('fix'): objs = [o for o in (C['fix'](o) for o in objs) if o is not None]
bpy.ops.wm.read_factory_settings(use_empty=True); imgs = {}; cache = {}
def image(p):
    if p not in imgs:
        q = p if os.path.exists(p) else next((p[:-len(e)] + e2 for e in ('.rgb', '.png', '.jpg', '.dds') for e2 in ('.png', '.jpg', '.rgb') if p.lower().endswith(e) and os.path.exists(p[:-len(e)] + e2)), None)
        if not q:      # FlightGear also finds a texture next to the model that includes the .ac file: look up the folders
            d = os.path.dirname(p); b = os.path.basename(p)
            while len(d) >= len(C['ROOT']) and not q:
                d = os.path.dirname(d); q = os.path.join(d, b) if os.path.exists(os.path.join(d, b)) else None
        try: imgs[p] = bpy.data.images.load(q) if q else None
        except Exception: imgs[p] = None
        if imgs[p] is None: print('missing texture', p)
    return imgs[p]
def material(o, mi):
    key = (o['file'], mi, o['tex'], bool(EMIT and (EMIT.search(o['name']) or EMIT.search(o['file']))))
    if key in cache: return cache[key]
    m = o['mats'][mi] if mi < len(o['mats']) else {'name': 'x'}; M = bpy.data.materials.new(f"{m['name']}|{os.path.basename(o['tex'] or '')}"); M.use_nodes = True; nt = M.node_tree; B = nt.nodes['Principled BSDF']
    rgb = m.get('rgb', (1, 1, 1)); em = m.get('emis', (0, 0, 0)) if EMIT and (EMIT.search(o['name']) or EMIT.search(o['file'])) else (0, 0, 0); sp = m.get('spec', (.2, .2, .2)); shi = m.get('shi', 10); tr = m.get('trans', 0)
    B.inputs['Base Color'].default_value = (*rgb, 1); B.inputs['Roughness'].default_value = max(0.3, 1 - min(1, shi / 128) * 0.7); B.inputs['Specular IOR Level'].default_value = min(0.4, sum(sp) / 3)
    im = image(o['tex']) if o['tex'] else None
    if im:
        T = nt.nodes.new('ShaderNodeTexImage'); T.image = im; T.interpolation = 'Cubic'
        if min(rgb) > 0.95: nt.links.new(T.outputs['Color'], B.inputs['Base Color'])
        else:
            X = nt.nodes.new('ShaderNodeMix'); X.data_type = 'RGBA'; X.blend_type = 'MULTIPLY'; X.inputs[0].default_value = 1; X.inputs[7].default_value = (*rgb, 1); nt.links.new(T.outputs['Color'], X.inputs[6]); nt.links.new(X.outputs[2], B.inputs['Base Color'])
        if im.channels == 4 and im.depth == 32: nt.links.new(T.outputs['Alpha'], B.inputs['Alpha'])
        if max(em) > 0.01: nt.links.new(T.outputs['Color'], B.inputs['Emission Color']); B.inputs['Emission Strength'].default_value = max(em)
    elif max(em) > 0.01: B.inputs['Emission Color'].default_value = (*em, 1); B.inputs['Emission Strength'].default_value = 1
    if tr > 0: B.inputs['Alpha'].default_value = 1 - tr
    cache[key] = M; return M
col = bpy.data.collections.new('fd'); bpy.context.scene.collection.children.link(col)
for o in objs:
    me = bpy.data.meshes.new(o['name']); bm = bmesh.new(); vs = [bm.verts.new(v) for v in o['v']]; bm.verts.ensure_lookup_table(); uv = bm.loops.layers.uv.new('uv'); slots = {}
    for mi, idx, uvs, flags in o['faces']:
        if len(set(idx)) < 3: continue
        try: f = bm.faces.new([vs[k] for k in idx])
        except ValueError: continue
        if mi not in slots: slots[mi] = len(slots); me.materials.append(material(o, mi))
        f.material_index = slots[mi]; f.smooth = bool(flags & 0x10)
        for lp, (u, v) in zip(f.loops, uvs): lp[uv].uv = (u * o['rep'][0] + o['off'][0], v * o['rep'][1] + o['off'][1])
    bm.normal_update(); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(o['name'] or 'obj', me); col.objects.link(ob); ob['file'] = o['file']; ob['inst'] = '/'.join(o['inst'])
    md = ob.modifiers.new('es', 'EDGE_SPLIT'); md.split_angle = math.radians(o['crease']); md.use_edge_sharp = False
dimmed = {}
def dim(M):
    if M.name in dimmed: return dimmed[M.name]
    D = M.copy(); nt = D.node_tree; B = nt.nodes['Principled BSDF']; B.inputs['Emission Strength'].default_value = 0
    for l in list(B.inputs['Emission Color'].links): nt.links.remove(l)
    dimmed[M.name] = D; return D
if DIMR:
    for ob in col.objects:
        if DIMR.search(ob.name):
            for i, M in enumerate(ob.data.materials): ob.data.materials[i] = dim(M)
bpy.ops.wm.save_as_mainfile(filepath=C['OUT']); print('objects', len(col.objects), 'materials', len(bpy.data.materials))
import pickle; pickle.dump([{k: o[k] for k in ('name', 'file', 'inst', 'v', 'path')} for o in objs], open(C['OUT'][:-6] + '.pkl', 'wb'))
