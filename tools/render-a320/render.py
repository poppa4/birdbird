"""Render one flat, square-on view of a part of the flight deck.  usage: render.py name cx cy cz nx ny nz ax ay az width height px samples [clipnear clipfar]"""
import sys, bpy, math, mathutils as mu
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
name = a[0]; c = mu.Vector(map(float, a[1:4])); n = mu.Vector(map(float, a[4:7])).normalized(); up = mu.Vector(map(float, a[7:10])); W, H = float(a[10]), float(a[11]); px = int(a[12]); spp = int(a[13])
near = float(a[14]) if len(a) > 14 else 0.4; far = float(a[15]) if len(a) > 15 else 0.6
bpy.ops.wm.open_mainfile(filepath='/home/claude/rend/fd.blend'); sc = bpy.context.scene
up = (up - up.dot(n) * n).normalized(); z = -n; x = up.cross(z).normalized(); R = mu.Matrix((x, up, z)).transposed()
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = max(W, H); cam.clip_start = 0.01; cam.clip_end = near + far
ob = bpy.data.objects.new('c', cam); sc.collection.objects.link(ob); ob.matrix_world = mu.Matrix.Translation(c - n * near) @ R.to_4x4(); sc.camera = ob
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = spp; sc.cycles.use_denoising = True; sc.cycles.max_bounces = 4; sc.render.threads_mode = 'AUTO'
sc.render.resolution_x = px; sc.render.resolution_y = int(px * H / W); sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
# a large soft key light from behind the viewer, slightly from the top of the picture, for gentle shadows under knobs and guards
L = bpy.data.lights.new('k', 'AREA'); L.energy = 420; L.size = 2.2; lo = bpy.data.objects.new('k', L); sc.collection.objects.link(lo)
import os
lc = mu.Vector(map(float, os.environ['LC'].split(','))) if os.environ.get('LC') else c  # the light is fixed to the whole view, so tiles match
lp = lc - n * 1.6 + up * 0.7 - x * 0.35
lo.matrix_world = mu.Matrix.Translation(lp) @ (mu.Vector((0, 0, -1)).rotation_difference((lc - lp).normalized())).to_matrix().to_4x4()
sc.render.filepath = f'/home/claude/rend/out/{name}.png'; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
bpy.ops.render.render(write_still=True)
