# Full-detail export of the owner's A320neo flight deck: modifiers applied (subdivision capped at SUBD), no dissolve.
# Writes vertices in the page's frame (x, z, y) + (0, -0.14, 4.74), triangles, and the object index of each triangle.
import bpy, sys, os, numpy as np
bpy.ops.wm.open_mainfile(filepath=sys.argv[-2], use_scripts=False)
LV = int(os.environ.get('SUBD', '1'))
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    for m in o.modifiers:
        if m.type == 'SUBSURF': m.levels = min(m.levels, LV)
dg = bpy.context.evaluated_depsgraph_get(); V = []; F = []; OB = []; names = []; coll = []; b = 0
T = np.array([0, -0.14, 4.74])
for o in bpy.data.objects:
    if o.type not in ('MESH', 'CURVE') or o.hide_render or o.hide_get(): continue
    ev = o.evaluated_get(dg)
    try: me = ev.to_mesh()
    except Exception: continue
    me.calc_loop_triangles()
    if not len(me.loop_triangles): ev.to_mesh_clear(); continue
    co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    M = np.array(o.matrix_world); co = co @ M[:3, :3].T + M[:3, 3]
    co = np.stack([co[:, 0], co[:, 2], co[:, 1]], 1) + T
    tr = np.zeros(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get('vertices', tr); tr = tr.reshape(-1, 3)
    V.append(co); F.append(tr + b); OB.append(np.full(len(tr), len(names))); names.append(o.name)
    coll.append(o.users_collection[0].name if o.users_collection else ''); b += len(co); ev.to_mesh_clear()
V = np.concatenate(V); F = np.concatenate(F); OB = np.concatenate(OB)
np.savez(sys.argv[-1], v=V.astype(np.float32), f=F.astype(np.int32), ob=OB.astype(np.int32), names=np.array(names), coll=np.array(coll))
print('objects', len(names), 'verts', len(V), 'tris', len(F))
import collections; print(collections.Counter(coll))
