"""Build an original stylized shrine hall and export an editable blend + web GLB."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
import sys
sys.path.insert(0,str(ROOT))
from brand_palette import tone
from privacy import prepare_portable_scene
WEB=ROOT.parent/'public'/'models'
WEB.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name,color):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=.6
    return m
body=mat('Honden dark structure',tone(.036,.02))
accent=mat('Honden turquoise detail',tone(.72,.025))
doors=mat('Honden inner glow',tone(.17,.035))

def box(name,loc,size,material=body):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    return o

def line(name,points,r=.028,material=accent):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=0
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    return o

def roof(name,width,depth,base,height):
    nx,ny=32,24
    def height_at(x,y):
        a,b=abs(x)/(width/2),abs(y)/(depth/2)
        hip=min(1-b**.73,max(0,(1-a)/.26))
        return base+height*hip+.68*b**7+.58*a**7
    vs=[]
    for layer in (0,-.2):
        for j in range(ny+1):
            y=-depth/2+depth*j/ny
            for i in range(nx+1):
                x=-width/2+width*i/nx
                vs.append((x,y,height_at(x,y)+layer))
    faces=[];size=(nx+1)*(ny+1)
    for k in range(2):
        for j in range(ny):
            for i in range(nx):
                a=k*size+j*(nx+1)+i
                f=(a,a+1,a+nx+2,a+nx+1)
                faces.append(f if k==0 else tuple(reversed(f)))
    boundary=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]+[ny*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(ny-1,0,-1)]
    for i,a in enumerate(boundary):
        b=boundary[(i+1)%len(boundary)];faces.append((a,b,b+size,a+size))
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(body)
    # Crisp eaves and sparse longitudinal ribs make the large curved roof legible.
    line(name+' eave', [vs[i] for i in boundary]+[vs[boundary[0]]],.04)
    for i in range(-7,8):
        x=i*width/18
        line(name+' seam',[(x,-depth/2+depth*j/24,height_at(x,-depth/2+depth*j/24)+.025) for j in range(25)],.012,doors)
    box(name+' ridge',(0,0,base+height+.12),(width*.53,.32,.3),accent)

# Raised terraces and a broad stairway; front is negative Blender Y / positive glTF Z.
box('Foundation',(0,0,.35),(18.8,12.8,.7))
box('Upper terrace',(0,0,1.0),(18,12, .6))
box('Deck',(0,0,1.36),(18.5,12.5,.12),accent)
for i in range(10):
    h=(i+1)*.14
    box('Approach stair %02d'%i,(0,-12.3+i*.64,h/2),(6.4,.67,h))
    line('Step nosing',[(-3.2,-12.62+i*.64,h),(3.2,-12.62+i*.64,h)],.019)
box('Sanctuary chamber',(0,1,3.85),(12,7.4,4.9))
box('Front lintel',(0,-4.8,6.9),(17,.38,.5))
box('Rear lintel',(0,4.8,6.9),(17,.38,.5))
for y in (-4.8,4.8):
    for x in (-7.7,-3.9,3.9,7.7):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.23,depth=5.45,location=(x,y,4.12))
        bpy.context.object.name='Hall pillar';bpy.context.object.data.materials.append(body)
        box('Column shoe',(x,y,1.55),(.68,.68,.3),accent)
        for k in range(3):box('Layered bracket',(x,y,6.35+k*.2),(.56+k*.32,.68+k*.19,.17))
for x in (-7.7,7.7):box('Side lintel',(x,0,6.9),(.4,10,.5))

# Central paired doors, railings and panel rhythms.
door_bottom,door_top=1.47,4.90
door_height=door_top-door_bottom
door_center=(door_bottom+door_top)/2
for x in (-1.18,1.18):
    box('Door leaf',(x,-2.76,door_center),(2.28,.13,door_height),doors)
    for dx in (-1.15,1.15):box('Door frame',(x+dx,-2.87,door_center),(.075,.09,door_height+.05),accent)
    for j in range(6):
        box('Door lattice',(x,-2.86,door_bottom+.18+j*(door_height-.36)/5),(2.25,.07,.045),accent)
# A restrained lintel finishes the doorway below the wall-mounted hengaku.
box('Entrance door head',(0,-2.84,4.97),(4.75,.22,.12),body)
for side in (-1,1):
    for x in (3,3.65,4.3,4.95,5.6):box('Facade lattice',(side*x,-2.75,3.9),(.048,.08,4.7),accent)
    box('Porch railing',(side*6.15,-5.72,2.5),(4.5,.12,.13),accent)
    for j in range(7):box('Porch baluster',(side*(4+j*.7),-5.72,1.95),(.075,.08,1.1))
    for y in (-3,-1,1,3,5):box('Side railing post',(side*8.5,y,1.95),(.12,.12,1.1))
    box('Side railing',(side*8.5,1,2.5),(.12,8,.12),accent)

roof('Main sweeping roof',23,15,7.05,4.5)
# Smaller entrance canopy projects toward the visitor.
roof('Entrance canopy',9,4.8,5.4,1.45)
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Entrance canopy'):o.location.y-=6.0
for x in (-3.4,3.4):
    box('Canopy pillar',(x,-7.0,3.4),(.2,.2,4.0))
    box('Canopy cap',(x,-7,5.35),(.65,.5,.3))
# Recess the hengaku above the entrance doors, against the facade under the roof.
# The chamber front is Y=-2.7; short concealed blocks attach the plaque to it.
plaque_y,plaque_z=-2.98,5.37
box('Entrance plaque',(0,plaque_y,plaque_z),(1.25,.16,.56),body)
for x in (-.43,.43):
    box('Plaque mounting block',(x,-2.80,plaque_z),(.10,.22,.18),body)
for z in (plaque_z-.23,plaque_z+.23):
    line('Plaque frame',[(-.57,plaque_y-.09,z),(.57,plaque_y-.09,z)],.012,doors)
for x in (-.57,.57):
    line('Plaque frame',[(x,plaque_y-.09,plaque_z-.23),(x,plaque_y-.09,plaque_z+.23)],.012,doors)
# A small suzu below the canopy, with clearance above its suspension ring.
bell_y,bell_z,bell_radius=-7.25,5.38,.25
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=bell_radius,location=(0,bell_y,bell_z))
bell=bpy.context.object;bell.name='Entrance suzu bell';bell.data.materials.append(body)
for poly in bell.data.polygons:poly.use_smooth=True
for z,r,label in [(bell_z,.253,'Bell equator'),(bell_z+.25,.06,'Bell suspension')]:
    line(label,[(r*math.cos(t*math.pi/24),bell_y+r*math.sin(t*math.pi/24),z) for t in range(49)],.01,doors)
line('Bell hanger',[(0,bell_y,bell_z+bell_radius),(0,bell_y,5.75)],.018,doors)
line('Bell sound slit',[(-.14,bell_y-.19,bell_z-.105),(0,bell_y-.235,bell_z-.105),(.14,bell_y-.19,bell_z-.105)],.017,body)
line('Bell rope',[(0,bell_y,bell_z-bell_radius),(0,bell_y,2.2)],.06,doors)

# Low offertory box on the front deck; an open slatted top, not a solid glowing block.
for x in (-1.36,1.36):box('Offertory foot',(x,-5.92,1.53),(.22,.9,.22))
box('Offertory bottom',(0,-5.92,1.67),(3.5,1.16,.12))
for y in (-6.47,-5.37):box('Offertory long wall',(0,y,1.98),(3.5,.12,.62))
for x in (-1.69,1.69):box('Offertory end wall',(x,-5.92,1.98),(.12,1.16,.62))
for y in (-6.51,-5.33):box('Offertory top rim',(0,y,2.31),(3.68,.10,.12),accent)
for x in (-1.79,1.79):box('Offertory side rim',(x,-5.92,2.31),(.10,1.28,.12),accent)
for i in range(11):box('Offertory grate slat',(-1.5+i*.3,-5.92,2.29),(.095,1.10,.10),accent)
for z in (1.74,2.2):line('Offertory front band',[(-1.67,-6.54,z),(1.67,-6.54,z)],.017)
for x in (-6.8,6.8):
    box('Courtyard lantern base',(x,-9.7,.25),(.85,.85,.5))
    box('Courtyard lantern shaft',(x,-9.7,1.05),(.25,.25,1.1))
    box('Courtyard lantern light',(x,-9.7,1.8),(.65,.65,.55),accent)
    box('Courtyard lantern cap',(x,-9.7,2.15),(.95,.95,.15))

# Recessed side halls and covered galleries broaden the ceremonial silhouette.
# The central hall above is unchanged in size and form.
for side,label in [(-1,'West'),(1,'East')]:
    cx=side*17
    box(label+' wing terrace',(cx,3,.55),(12,10,1.1))
    box(label+' wing deck',(cx,3,1.17),(12.3,10.3,.14),accent)
    box(label+' wing chamber',(cx,3.8,3.12),(9,6.4,3.8))
    for dx in (-4.8,-1.6,1.6,4.8):
        box(label+' wing pillar',(cx+dx,-.8,3.12),(.24,.24,3.8))
        box(label+' wing bracket',(cx+dx,-.8,4.98),(.8,.7,.25),accent)
    box(label+' wing lintel',(cx,-.8,5.12),(11,.32,.35))
    for dx in (-3.6,-2.7,-1.8,0,1.8,2.7,3.6):
        box(label+' wing screen',(cx+dx,.52,3.08),(.055,.1,3.5),accent)
    for j in range(4):box(label+' wing screen rail',(cx,.49,1.7+j*.85),(8.2,.07,.04),accent)
    roof(label+' wing roof',13,11,5.22,2.85)
    for o in list(bpy.context.scene.objects):
        if o.name.startswith(label+' wing roof'):o.location.x+=cx;o.location.y+=3
    # Galleries bridge the main terrace and the recessed wings.
    gx=side*10.4
    box(label+' gallery deck',(gx,2,1.3),(5,4.5,.2),accent)
    for dx in (-2,0,2):
        for y in (.3,3.7):box(label+' gallery column',(gx+dx,y,2.95),(.16,.16,3.1))
    box(label+' gallery front rail',(gx,.25,2.28),(4.8,.1,.1),accent)
    for dx in (-2,-1,0,1,2):box(label+' gallery baluster',(gx+dx,.25,1.8),(.08,.08,.85))
    roof(label+' gallery roof',6.2,5.4,4.65,1.2)
    for o in list(bpy.context.scene.objects):
        if o.name.startswith(label+' gallery roof'):o.location.x+=gx;o.location.y+=2

# Center the offertory box on the porch depth (deck front -6.25, facade -2.7).
# Translate the complete bell/rope and box together; preserve their relative layout.
entrance_depth_offset=1.45
for o in bpy.context.scene.objects:
    if o.name.startswith(('Entrance suzu bell','Bell ','Offertory ')):
        o.location.y+=entrance_depth_offset

# Bake curves to meshes; keep objects editable in the blend.
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
prepare_portable_scene()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'honden-01.blend'))
bpy.ops.export_scene.gltf(filepath=str(WEB/'honden-01.glb'),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False)
print('HONDEN_EXPORTED',str(WEB/'honden-01.glb'))
