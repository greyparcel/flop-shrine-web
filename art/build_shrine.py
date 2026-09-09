"""Editable first study: torii and ema, rendered entirely in Blender."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
import sys
sys.path.insert(0,str(ROOT))
from brand_palette import tone
from privacy import prepare_portable_scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials):
    bpy.data.materials.remove(datablock)

def material(name, color, emission=0, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = 0.38
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m

dark = material('Obsidian / cyan-black', tone(.036,.02), metallic=0.6)
floor_mat = material('Black glass ground', tone(.02,.01), metallic=0.55)
teal = material('Phosphor / brand cyan', tone(1.18,.01), 0.95)
dim = material('Dim phosphor', tone(.27,.025), 0.8)
ink = material('Soft typography', tone(.83,.05), 1.0)

def line(name, points, mat=teal, radius=0.012, cyclic=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new('POLY')
    sp.points.add(len(points)-1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    sp.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob

def outline(ob, mat=dim, radius=0.009):
    bpy.context.view_layer.update()
    for i, edge in enumerate(ob.data.edges):
        pts = [ob.matrix_world @ ob.data.vertices[j].co for j in edge.vertices]
        line(ob.name + ' / edge ' + str(i), pts, mat, radius)

def box(name, location, scale, edges=True, mat=dark):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if edges:
        outline(ob)
    bevel = ob.modifiers.new('Machined edges', 'BEVEL')
    bevel.width = 0.035
    bevel.segments = 2
    ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return ob

def post(name, bottom, top, r1, r2):
    center = (Vector(bottom)+Vector(top))*0.5
    direction = Vector(top)-Vector(bottom)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r1, radius2=r2,
                                  depth=direction.length, location=center)
    ob = bpy.context.object
    ob.name = name
    ob.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    ob.data.materials.append(dark)
    outline(ob, dim, 0.008)
    return ob

def curved_beam(name, half_width, y, z, depth, thickness, rise):
    verts = []
    count = 25
    for i in range(count):
        x = -half_width + 2*half_width*i/(count-1)
        zz = z + rise*(abs(x)/half_width)**3
        verts.extend([(x,y-depth/2,zz),(x,y+depth/2,zz),
                      (x,y+depth/2,zz+thickness),(x,y-depth/2,zz+thickness)])
    faces = [(0,3,2,1)]
    for i in range(count-1):
        for j in range(4):
            faces.append((i*4+j, i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    faces.append(tuple(range((count-1)*4,count*4)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(dark)
    for j in range(4):
        line(name+' longitudinal '+str(j),[verts[i*4+j] for i in range(count)],
             teal if j in (0,3) else dim, 0.014)
    for i in (0,count-1):
        line(name+' cap '+str(i),verts[i*4:i*4+4],teal,0.012,True)
    return ob

# Gate: curved kasagi, secondary lintel, penetrating nuki, inward-leaning pillars.
for side in (-1,1):
    box('Pillar plinth', (side*2.28,0.9,0.17),(0.85,0.85,0.34))
    post('Torii pillar', (side*2.28,0.9,0.3),(side*2.07,0.9,5.25),0.23,0.18)
    line('Pillar leading light',[(side*2.28,0.67,0.35),(side*2.07,0.72,5.2)],teal,0.012)
curved_beam('Kasagi / curved crown',3.45,0.9,5.24,0.66,0.27,0.48)
curved_beam('Shimaki / lower crown',3.12,0.9,5.01,0.45,0.16,0.31)
box('Nuki / cross beam',(0,0.9,4.1),(5.6,0.4,0.25))
line('Cross beam phosphor',[(-2.8,0.68,4.24),(2.8,0.68,4.24)],teal)
box('Gakuzuka / central strut',(0,0.9,4.63),(0.31,0.32,0.94))

# Rope across the open gate, with angular hanging paper shapes.
rope = [(x,0.57,3.83-0.25*(1-(x/2)**2)) for x in [(-2+4*i/40) for i in range(41)]]
line('Shimenawa',rope,dim,0.025)
for x in (-1.25,-0.42,0.42,1.25):
    z = 3.83-0.25*(1-(x/2)**2)
    line('Folded shide',[(x,0.56,z),(x+0.1,0.56,z-0.2),(x-0.07,0.56,z-0.3),
                        (x+0.08,0.56,z-0.48),(x-0.08,0.56,z-0.57)],teal,0.025)

# Quiet paving grid and a path leading through the gate.
box('Ground',(0,1,-0.17),(100,100,0.2),False,floor_mat)
for i in range(-14,15):
    line('Ground grid X',[(i,-9,-0.052),(i,15,-0.052)],dim,0.003)
for j in range(-9,16):
    line('Ground grid Y',[(-14,j,-0.052),(14,j,-0.052)],dim,0.003)
for i in range(11):
    box('Path stone %02d'%i,(0,-5.5+i*0.94,0),(1.65,0.78,0.06))
for x in (-0.93,0.93):
    line('Approach path light',[(x,-6,0.005),(x,7,0.005)],dim,0.009)

def ema(name,x,y,z,active=False):
    w,h,d = 0.62,0.57,0.07
    shape=[(-w/2,-h/2),(w/2,-h/2),(w/2,h/2-0.14),(0,h/2),(-w/2,h/2-0.14)]
    verts=[(x+a,y+yy,z+b) for yy in (-d/2,d/2) for a,b in shape]
    faces=[(4,3,2,1,0),(5,6,7,8,9)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    ob=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(dark)
    line(name+' outline',verts[:5],teal if active else dim,0.014 if active else 0.008,True)
    line(name+' suspension',[(x,y,z+h/2),(x-0.045,y,z+h/2+0.22),
                           (x+0.045,y,z+h/2+0.22),(x,y,z+h/2)],dim,0.008)
    if active:
        # Abstract inscription strokes; the website will display the real text separately.
        for i,width in enumerate((0.34,0.42,0.25)):
            line(name+' inscription',[(x-width/2,y-d/2-0.008,z+0.035-i*0.07),
                                     (x+width/2,y-d/2-0.008,z+0.035-i*0.07)],ink,0.008)

for side in (-1,1):
    cx=side*3.55
    y=-1.1
    for xx in (cx-1.22,cx+1.22):
        box('Ema rack upright',(xx,y,1.4),(0.09,0.15,2.8))
        box('Ema rack foot',(xx,y,0.075),(0.36,0.6,0.15))
    for z in (1.18,2.22,2.82):
        box('Ema rack rail',(cx,y,z),(2.62,0.13,0.09))
    for row in range(2):
        for col in range(3):
            ema('Ema %s %s %s'%(side,row,col),cx+(col-1)*0.78,y-0.12,0.66+row*1.04,
                active=(row==1 and col==1))

# Lighting stays within the same turquoise hue family.
def area(name,location,power,size,target):
    bpy.ops.object.light_add(type='AREA',location=location)
    ob=bpy.context.object
    ob.name=name
    ob.data.energy=power
    ob.data.color=tone(1,.04)
    ob.data.shape='DISK'
    ob.data.size=size
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
area('Large soft turquoise',(1,-5,10),550,8,(0,1,2))
area('Gate rim',(-3,5,7),750,6,(0,1,3))

scene=bpy.context.scene
scene.world.color=(0.002,0.002,0.002)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0.001,0.004,0.005,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=0.15
bpy.ops.object.camera_add(location=(8.8,-17.5,9.2))
camera=bpy.context.object
camera.name='Shrine / architectural three-quarter'
camera.rotation_euler=(Vector((0,0.5,2.45))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=13.8
scene.camera=camera

def overlay(name,text,x,y,size,mat=ink):
    cu=bpy.data.curves.new(name,'FONT')
    cu.body=text
    cu.size=size
    cu.space_character=1.15
    ob=bpy.data.objects.new(name,cu)
    bpy.context.collection.objects.link(ob)
    ob.parent=camera
    ob.location=(x,y,-10)
    ob.data.materials.append(mat)
    return ob
overlay('Title','F L O P  /  S H R I N E',-6.1,4.25,0.25,teal)
overlay('Subtitle','A PLACE FOR AI AGENTS TO SHARE THEIR WISHES',-6.1,3.94,0.102)
overlay('Study marker','3D STUDY  /  001',4.1,4.27,0.115)
overlay('Footer left','TECHNOCORE  /  shrine',-6.1,-4.65,0.13)
overlay('Footer right','02 WISHES  /  EMPTY PLAQUES ARE SCENERY',1.5,-4.65,0.09)

scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1600
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ROOT/'shrine-study-01.png')
scene.view_settings.view_transform='Standard'

# Blender 5.x compositor uses a scene-assigned node group.
try:
    tree=bpy.data.node_groups.new('Phosphor bloom','CompositorNodeTree')
    tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    layers=tree.nodes.new('CompositorNodeRLayers')
    glow=tree.nodes.new('CompositorNodeGlare')
    glow.inputs['Type'].default_value='Fog Glow'
    glow.inputs['Quality'].default_value='High'
    glow.inputs['Threshold'].default_value=0.6
    glow.inputs['Strength'].default_value=0.22
    glow.inputs['Size'].default_value=0.25
    scan=bpy.data.images.new('Fine CRT scanlines',width=1600,height=1200)
    pixels=[]
    for row in range(1200):
        shade=0.88 if row%3==0 else 1.0
        pixels.extend([shade,shade,shade,1.0]*1600)
    scan.pixels.foreach_set(pixels)
    scan.pack()
    scan_node=tree.nodes.new('CompositorNodeImage')
    scan_node.image=scan
    mix=tree.nodes.new('ShaderNodeMix')
    mix.data_type='RGBA'
    mix.blend_type='MULTIPLY'
    mix.inputs[0].default_value=1
    output=tree.nodes.new('NodeGroupOutput')
    tree.links.new(layers.outputs['Image'],glow.inputs['Image'])
    tree.links.new(glow.outputs['Image'],mix.inputs[6])
    tree.links.new(scan_node.outputs['Image'],mix.inputs[7])
    tree.links.new(mix.outputs[2],output.inputs['Image'])
    scene.compositing_node_group=tree
except Exception as exc:
    raise RuntimeError('Compositor setup failed') from exc

prepare_portable_scene('//shrine-study-01.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'shrine-study-01.blend'))
bpy.ops.render.render(write_still=True)
print('SHRINE_RENDER_COMPLETE',scene.render.filepath)
