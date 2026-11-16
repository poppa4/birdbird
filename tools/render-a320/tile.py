"""Render one tile of a view. usage: tile.py name cx cy cz nx ny nz ax ay az W H pxPerM samples near far cols rows col row"""
import sys, subprocess, bpy, mathutils as mu
a = sys.argv[1:]; name = a[0]; c = mu.Vector(map(float, a[1:4])); n = mu.Vector(map(float, a[4:7])).normalized(); up = mu.Vector(map(float, a[7:10])); W, H, ppm = float(a[10]), float(a[11]), float(a[12]); spp = a[13]; near, far = a[14], a[15]
cols, rows, ci, ri = map(int, a[16:20]); up = (up - up.dot(n) * n).normalized(); x = up.cross(-n).normalized(); tw, th = W / cols, H / rows
cc = c + x * (-W / 2 + tw * (ci + .5)) + up * (H / 2 - th * (ri + .5))
import os
os.environ['LC'] = ','.join(map(str, c))
subprocess.run(['python3', 'render.py', '--', f'{name}_{ri}_{ci}', *map(str, cc), *map(str, n), *map(str, up), str(tw), str(th), str(round(tw * ppm)), spp, near, far], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('done', name, ri, ci)
