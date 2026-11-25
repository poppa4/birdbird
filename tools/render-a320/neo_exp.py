import bpy,sys,numpy as np
bpy.ops.wm.open_mainfile(filepath=sys.argv[-2],use_scripts=False)
import os
LV=int(os.environ.get('SUBD','1')); ANG=float(os.environ.get('DISS','0.035'))
for o in bpy.data.objects:
    if o.type!='MESH': continue
    for m in o.modifiers:
        if m.type=='SUBSURF': m.levels=min(m.levels,LV)
        if m.type=='BEVEL': m.segments=min(m.segments,2)
    m=o.modifiers.new('pl','DECIMATE'); m.decimate_type='DISSOLVE'; m.angle_limit=ANG   # flat areas become single faces; curves keep their shape
dg=bpy.context.evaluated_depsgraph_get(); V=[];F=[];OB=[];names=[];b=0
for o in bpy.data.objects:
    if o.type!='MESH' or o.hide_render: continue
    ev=o.evaluated_get(dg); me=ev.to_mesh(); me.calc_loop_triangles()
    if not len(me.loop_triangles): ev.to_mesh_clear(); continue
    co=np.zeros(len(me.vertices)*3); me.vertices.foreach_get('co',co); co=co.reshape(-1,3); M=np.array(o.matrix_world); co=co@M[:3,:3].T+M[:3,3]
    tr=np.zeros(len(me.loop_triangles)*3,np.int64); me.loop_triangles.foreach_get('vertices',tr); tr=tr.reshape(-1,3)
    V.append(co); F.append(tr+b); OB.append(np.full(len(tr),len(names))); names.append(o.name); b+=len(co); ev.to_mesh_clear()
V=np.concatenate(V); F=np.concatenate(F); OB=np.concatenate(OB)
np.savez(sys.argv[-1],v=V.astype(np.float32),f=F.astype(np.int32),ob=OB.astype(np.int32),names=np.array(names))
print('evaluated: objects',len(names),'verts',len(V),'tris',len(F))
