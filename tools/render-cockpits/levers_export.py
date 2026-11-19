"""Export lever objects from a flight-deck .blend as one small binary for the 3D cockpit: model-frame positions, normals and
colours (the material's base colour, times its image texture sampled at each corner).  usage: export.py file.blend out.bin 'group=regex;group=regex'"""
import sys, bpy, re, json, struct, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; blend, out, spec = a
bpy.ops.wm.open_mainfile(filepath=blend)
groups = [tuple(p.split('=', 1)) for p in spec.split(';')]
imgs = {}
def tex_of(mat):
    if not mat or not mat.use_nodes: return None, (0.6, 0.6, 0.6)
    base = (0.6, 0.6, 0.6); im = None
    for nd in mat.node_tree.nodes:
        if nd.type == 'BSDF_PRINCIPLED':
            bc = nd.inputs['Base Color']; base = tuple(bc.default_value[:3])
        if nd.type == 'TEX_IMAGE' and nd.image: im = nd.image
    if im is not None and im.name not in imgs:
        w, h = im.size
        px = np.array(im.pixels[:], np.float32).reshape(h, w, im.channels)[..., :3] if w and h else None
        imgs[im.name] = px
    return (imgs.get(im.name) if im else None), base
hdr = {'groups': []}; blob = b''
for gname, rx in groups:
    R = re.compile(rx); P = []; N = []; C = []
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or not R.fullmatch(ob.name): continue
        me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh(); me.calc_loop_triangles()
        M = ob.matrix_world; Nm = M.to_3x3().inverted().transposed(); uvl = me.uv_layers.active
        for t in me.loop_triangles:
            mat = ob.material_slots[t.material_index].material if ob.material_slots else None; px, base = tex_of(mat)
            for li in t.loops:
                v = me.vertices[me.loops[li].vertex_index]; p = M @ v.co; n = (Nm @ (me.loops[li].normal if me.has_custom_normals else (t.normal if not t.use_smooth else v.normal))).normalized()
                c = np.array(base)
                if px is not None and uvl is not None:
                    u, w = uvl.data[li].uv; h_, w_ = px.shape[:2]; c = c * px[int((w % 1) * (h_ - 1)), int((u % 1) * (w_ - 1))]
                c = np.clip(c, 0, 1) ** (1 / 2.2)
                P += list(p); N += list(n); C += [int(x * 255) for x in c]
        ob.to_mesh_clear() if hasattr(ob, 'to_mesh_clear') else None
    p = np.array(P, np.float32).tobytes(); n = (np.clip(np.array(N, np.float32), -1, 1) * 127).astype(np.int8).tobytes(); c = np.array(C, np.uint8).tobytes()
    pad = lambda b: b + b'\0' * ((-len(b)) % 4)
    hdr['groups'].append({'name': gname, 'nv': len(P) // 3, 'off': len(blob), 'sizes': [len(pad(p)), len(pad(n)), len(pad(c))]}); blob += pad(p) + pad(n) + pad(c)
    print(gname, len(P) // 3)
h = json.dumps(hdr).encode(); h += b' ' * ((-len(h)) % 4)
open(out, 'wb').write(struct.pack('<I', len(h)) + h + blob)
