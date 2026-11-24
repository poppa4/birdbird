import sys, bpy, math, numpy as np
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:]; RX=int(argv[0]); SPP=int(argv[1]); OUT=argv[2]
CAM=[float(v) for v in argv[3:6]]; TGT=[float(v) for v in argv[6:9]]; LENS=float(argv[9])
bpy.ops.wm.open_mainfile(filepath='/home/claude/rend/fd.blend'); sc=bpy.context.scene
# front view frame (same as map.py)
c=np.array((-0.478,0.229,0.)); n=np.array((-0.955,-0.297,0.)); n/=np.linalg.norm(n); up=np.array((0,1.,0)); up=up-up.dot(n)*n; up/=np.linalg.norm(up); x=np.cross(up,-n)
PPM=3000; W=4920; Wf,Hf=1.64,0.54; Y0=3900+40
def to3d(sx,sy): return c+(sx/PPM-Wf/2)*x+(Hf/2-(sy-Y0)/PPM)*up - n*0.003
SCR=[('pfd',530,4435,545,524),('nd',1129,4436,545,524),('ewd',2219,4407,558,526),('sd',2219,4975,558,526),('nd',3238,4434,558,524),('pfd',3839,4435,558,524),('isis',1956,4677,188,176)]
def coord(p): return Vector((p[0],p[1],p[2]))
for i,(nm,sx,sy,w,h) in enumerate(SCR):
    P=[to3d(sx,sy+h),to3d(sx+w,sy+h),to3d(sx+w,sy),to3d(sx,sy)]
    me=bpy.data.meshes.new(f'scr{i}'); me.from_pydata([coord(p) for p in P],[],[(0,1,2,3)]); me.update()
    uv=me.uv_layers.new(); 
    for li,(u,v) in enumerate([(0,0),(1,0),(1,1),(0,1)]): uv.data[li].uv=(u,v)
    ob=bpy.data.objects.new(f'scr{i}',me); sc.collection.objects.link(ob)
    M=bpy.data.materials.new(f'scr{i}'); M.use_nodes=True; nt=M.node_tree; nt.nodes.clear()
    T=nt.nodes.new('ShaderNodeTexImage'); T.image=bpy.data.images.load(f'/home/claude/rend/scr/{nm}.png'); T.interpolation='Cubic'
    E=nt.nodes.new('ShaderNodeEmission'); E.inputs['Strength'].default_value=1.6; O=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(T.outputs['Color'],E.inputs['Color']); nt.links.new(E.outputs[0],O.inputs['Surface']); me.materials.append(M)
# lit DCDUs and MCDUs (the model's screens use a 0-1 UV square)
def lit(obname,img,strength=1.3):
    o=bpy.data.objects[obname]; M=bpy.data.materials.new(obname+'_lit'); M.use_nodes=True; nt=M.node_tree; nt.nodes.clear()
    T=nt.nodes.new('ShaderNodeTexImage'); T.image=bpy.data.images.load(img); T.interpolation='Cubic'
    E=nt.nodes.new('ShaderNodeEmission'); E.inputs['Strength'].default_value=strength; O=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(T.outputs['Color'],E.inputs['Color']); nt.links.new(E.outputs[0],O.inputs['Surface']); o.data.materials.clear(); o.data.materials.append(M)
for n in ('dcduScreenL','dcduScreenR'): lit(n,'/home/claude/rend/scr/dcdu.png')
for n in ('mcdu1.screen','mcdu2.screen'): lit(n,'/home/claude/rend/scr/mcdu.png')
# hide glass/visors so the sky shows
for o in bpy.data.objects:
    if o.type=='MESH' and any(m and ('glass' in m.name or 'visor' in m.name) for m in o.data.materials): o.hide_render=True
# world: dusk gradient
wd=bpy.data.worlds.new('dusk'); sc.world=wd; wd.use_nodes=True; nt=wd.node_tree; nt.nodes.clear()
tc=nt.nodes.new('ShaderNodeTexCoord'); sep=nt.nodes.new('ShaderNodeSeparateXYZ'); ramp=nt.nodes.new('ShaderNodeValToRGB'); bg=nt.nodes.new('ShaderNodeBackground'); out=nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(tc.outputs['Generated'],sep.inputs[0]); 
nt.links.new(tc.outputs['Normal'],sep.inputs[0])
mm=nt.nodes.new('ShaderNodeMath'); mm.operation='MULTIPLY'; mm.inputs[1].default_value=-1.0; nt.links.new(sep.outputs['Y'],mm.inputs[0]); nt.links.new(mm.outputs[0],ramp.inputs['Fac'])
cr=ramp.color_ramp; cr.elements[0].position=0.0; cr.elements[0].color=(1.0,0.45,0.16,1); cr.elements[1].position=0.22; cr.elements[1].color=(0.015,0.05,0.20,1)
for p,col in ((0.008,(0.98,0.66,0.40,1)),(0.022,(0.50,0.58,0.78,1)),(0.05,(0.20,0.38,0.78,1)),(0.11,(0.06,0.17,0.50,1))): e=cr.elements.new(p); e.color=col
nt.links.new(ramp.outputs['Color'],bg.inputs['Color']); bg.inputs['Strength'].default_value=1.0; nt.links.new(bg.outputs[0],out.inputs['Surface'])
# warm panel flood lights under the glareshield + soft fill
def area(name,loc,rot,size,energy,col):
    L=bpy.data.lights.new(name,'AREA'); L.size=size; L.energy=energy; L.color=col; ob=bpy.data.objects.new(name,L); ob.location=loc; ob.rotation_euler=rot; sc.collection.objects.link(ob)
area('flood',(-0.30,0.34,0),(0,math.radians(-90),0),1.2,16,(1.0,0.70,0.40))
area('fill',(0.9,0.9,0),(0,math.radians(70),0),1.5,45,(0.55,0.65,0.95))
area('ped',(-0.05,0.25,0),(math.radians(0),math.radians(-160),0),0.6,3,(1.0,0.75,0.5))
# camera
cam=bpy.data.cameras.new('cam'); cam.lens=LENS; cam.sensor_width=36; co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); sc.camera=co
co.location=CAM; f=(Vector(TGT)-Vector(CAM)).normalized(); r=f.cross(Vector((0,1,0))).normalized(); u=r.cross(f)
from mathutils import Matrix
co.matrix_world=Matrix(((r.x,u.x,-f.x,CAM[0]),(r.y,u.y,-f.y,CAM[1]),(r.z,u.z,-f.z,CAM[2]),(0,0,0,1)))
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SPP; sc.cycles.use_denoising=True; sc.cycles.max_bounces=4
sc.render.resolution_x=RX; sc.render.resolution_y=int(RX*9/16); sc.render.film_transparent=False
sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'
sc.render.filepath=OUT; sc.render.image_settings.file_format='PNG'
bpy.ops.render.render(write_still=True)
