"""Build a Blender scene from the FlightGear A320-family flight deck model (GPL-2.0) and save it as a .blend."""
import sys, os; sys.path.insert(0, '/home/claude/rend')
import bpy, bmesh, numpy as np, ac3d, math
RES = '/home/claude/fg/A320-family/Models/FlightDeck/res/'
mats, objs = ac3d.load(RES + 'fd_complete.ac')
bpy.ops.wm.read_factory_settings(use_empty=True)
imgs = {}; bm_cache = {}
def image(n):
    if n not in imgs:
        p = RES + n; imgs[n] = bpy.data.images.load(p) if os.path.exists(p) else None
        if imgs[n] is None: print('missing texture', n)
    return imgs[n]
def material(mi, tex):
    key = (mi, tex)
    if key in bm_cache: return bm_cache[key]
    m = mats[mi]; M = bpy.data.materials.new(f"{m['name']}|{tex}"); M.use_nodes = True; nt = M.node_tree; B = nt.nodes['Principled BSDF']
    rgb = m.get('rgb', (1, 1, 1)); em = m.get('emis', (0, 0, 0)); sp = m.get('spec', (.2, .2, .2)); shi = m.get('shi', 10); tr = m.get('trans', 0)
    B.inputs['Base Color'].default_value = (*rgb, 1); B.inputs['Roughness'].default_value = max(0.25, 1 - min(1, shi / 128) * 0.7)
    B.inputs['Specular IOR Level'].default_value = min(0.5, sum(sp) / 3)
    im = image(tex) if tex else None
    if im:
        T = nt.nodes.new('ShaderNodeTexImage'); T.image = im; T.interpolation = 'Cubic'
        if rgb == (1, 1, 1): nt.links.new(T.outputs['Color'], B.inputs['Base Color'])
        else:
            X = nt.nodes.new('ShaderNodeMix'); X.data_type = 'RGBA'; X.blend_type = 'MULTIPLY'; X.inputs[0].default_value = 1; X.inputs[7].default_value = (*rgb, 1); nt.links.new(T.outputs['Color'], X.inputs[6]); nt.links.new(X.outputs[2], B.inputs['Base Color'])
        nt.links.new(T.outputs['Alpha'], B.inputs['Alpha'])
        if max(em) > 0.01: nt.links.new(T.outputs['Color'], B.inputs['Emission Color']); B.inputs['Emission Strength'].default_value = max(em)
    elif max(em) > 0.01: B.inputs['Emission Color'].default_value = (*em, 1); B.inputs['Emission Strength'].default_value = 1
    if tr > 0: B.inputs['Alpha'].default_value = 1 - tr
    M['ac_emis'] = max(em); bm_cache[key] = M; return M
# Aircraft configuration: A320neo with CFM LEAP engines and no head-up display, as in the model's A320neo-CFM set file.
# These objects are shown only with the HUD option or with IAE engines (select animations in a320.flightdeck.xml).
HIDE = {'autoland_light.plug', 'autoland_light_on.plug', 'hud', 'hud_box', 'hud_brt', 'hud_brt.axis', 'hud_brt.mark', 'hud_norm_sw', 'hud_declutter_btn', 'hud_ceiling', 'fcu_hud.plug', 'fcu_labels_hud.plug',
        'Eng1N1Btn', 'Eng1N1Btn2O', 'Eng1N1Prot', 'Eng2N1Btn', 'Eng2N1Btn2O', 'Eng2N1Prot', 'glare_ovh_eng_iae.plug', 'ovh_eng_iae.plug'}
objs = [o for o in objs if not (set(o['path']) & HIDE) and not o['name'].startswith('hud_')]
col = bpy.data.collections.new('fd'); bpy.context.scene.collection.children.link(col)
for o in objs:
    me = bpy.data.meshes.new(o['name']); bm = bmesh.new(); vs = [bm.verts.new(v) for v in o['v']]; bm.verts.ensure_lookup_table(); uv = bm.loops.layers.uv.new('uv'); slots = {}
    for fi, (mi, idx, uvs, flags) in enumerate(o['faces']):
        if len(set(idx)) < 3: continue
        if o['name'] == 'pedestal_low_glare.001' and fi == 0: continue  # a 'Max UP trim limitation' placard that is not part of the standard pedestal
        try: f = bm.faces.new([vs[k] for k in idx])
        except ValueError: continue
        if mi not in slots: slots[mi] = len(slots); me.materials.append(material(mi, o['tex']))
        f.material_index = slots[mi]; f.smooth = bool(flags & 0x10)
        for lp, (u, v) in zip(f.loops, uvs): lp[uv].uv = (u * o['rep'][0] + o['off'][0], v * o['rep'][1] + o['off'][1])
    bm.normal_update(); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(o['name'], me); col.objects.link(ob); ob['ac_path'] = '/'.join(o['path']); ob['ac_tex'] = o['tex'] or ''
    md = ob.modifiers.new('es', 'EDGE_SPLIT'); md.split_angle = math.radians(o['crease']); md.use_edge_sharp = False
# Dark cockpit: annunciator captions (FAULT, OFF, ON, AVAIL ...), LEDs and warning lights are unlit, as on the ground with nothing
# abnormal. They stay faintly readable, as real unlit captions are, so the picture still teaches what each button says.
import re
DIM = re.compile(r'(\d[A-Z]{1,2}(\.\d+)?$)|(_led(\.|$))|(_on(\.|_|$))|(_sgn\.)|(gear_(down|unlk)$)|(^engine_(fault|fire)_)|(^mcdu_ann_)|(^CockpitDoor(Fault|Open)$)|(^prio_.*(arrow|capt\.capt|fo_fo))|(^atc_msg_on)|(_lit(\\.|$))|(_glare\\.(cpt|fo|ovh)$)')
dimmed = {}
def dim(M):
    if M.name in dimmed: return dimmed[M.name]
    D = M.copy(); D.name = M.name + '|dim'; nt = D.node_tree; B = nt.nodes['Principled BSDF']; B.inputs['Emission Strength'].default_value = 0
    for l in list(B.inputs['Emission Color'].links): nt.links.remove(l)
    src = B.inputs['Base Color'].links[0].from_socket if B.inputs['Base Color'].links else None
    if src:
        X = nt.nodes.new('ShaderNodeMix'); X.data_type = 'RGBA'; X.blend_type = 'MULTIPLY'; X.inputs[0].default_value = 1; X.inputs[7].default_value = (.34, .34, .34, 1); nt.links.new(src, X.inputs[6]); nt.links.new(X.outputs[2], B.inputs['Base Color'])
    dimmed[M.name] = D; return D
nd = 0
for ob in col.objects:
    if DIM.search(ob.name):
        nd += 1
        for i, M in enumerate(ob.data.materials): ob.data.materials[i] = dim(M)
print('dimmed', nd)
bpy.ops.wm.save_as_mainfile(filepath='/home/claude/rend/fd.blend'); print('objects', len(col.objects), 'materials', len(bpy.data.materials))
