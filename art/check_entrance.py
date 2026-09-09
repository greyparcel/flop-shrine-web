"""Check mesh intersections and arrival-view occlusion for the entrance ornaments."""
import bpy
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree

deps = bpy.context.evaluated_depsgraph_get()
roof = bpy.data.objects['Entrance canopy']
plaque = bpy.data.objects['Entrance plaque']
bell = bpy.data.objects['Entrance suzu bell']

def world_bvh(obj):
    evaluated = obj.evaluated_get(deps)
    mesh = evaluated.to_mesh()
    result = BVHTree.FromPolygons([evaluated.matrix_world @ v.co for v in mesh.vertices], [list(p.vertices) for p in mesh.polygons])
    evaluated.to_mesh_clear()
    return result

roof_tree = world_bvh(roof)
result = {'roofIntersection': {o.name: bool(roof_tree.overlap(world_bvh(o))) for o in (bell, plaque)}}
eye = Vector((0, -52/3, .7))
center = bell.matrix_world.translation
radius = bell.dimensions.x/2
result['bellVisibility'] = []
for dz in (-.65, 0, .65):
    point = center + Vector((0, -radius * (1-dz*dz)**.5, radius*dz))
    direction = point-eye
    hit, location, normal, index, obj, matrix = bpy.context.scene.ray_cast(deps, eye, direction.normalized(), distance=direction.length+.05)
    result['bellVisibility'].append({'height': dz, 'firstHit': obj.name if hit else None})
print('ENTRANCE_AUDIT ' + json.dumps(result))
assert not any(result['roofIntersection'].values()), 'Entrance ornament intersects canopy'
assert all(item['firstHit'] in ('Entrance suzu bell', 'Bell equator') for item in result['bellVisibility']), 'Bell is occluded from the arrival viewpoint'

# The plaque belongs to the doorway facade, not the outer lip of the canopy.
chamber=bpy.data.objects['Sanctuary chamber']
facade_y=min((chamber.matrix_world @ Vector(v)).y for v in chamber.bound_box)
plaque_back=max((plaque.matrix_world @ Vector(v)).y for v in plaque.bound_box)
door_top=max((o.matrix_world @ Vector(v)).z for o in bpy.data.objects if o.name.startswith('Door leaf') for v in o.bound_box)
plaque_bottom=min((plaque.matrix_world @ Vector(v)).z for v in plaque.bound_box)
assert 0 < facade_y-plaque_back < .3, 'Plaque is not close to the entrance facade'
assert plaque_bottom > door_top, 'Plaque overlaps the doorway'
head=bpy.data.objects['Entrance door head']
head_top=max((head.matrix_world @ Vector(v)).z for v in head.bound_box)
assert plaque_bottom-head_top > .04, 'No separation above the doorway head'
mounts=[o for o in bpy.data.objects if o.name.startswith('Plaque mounting block')]
assert len(mounts)==2
for mount in mounts:
    bounds=[mount.matrix_world @ Vector(v) for v in mount.bound_box]
    assert min(v.y for v in bounds)<=plaque_back and max(v.y for v in bounds)>=facade_y, 'Mount does not connect plaque and facade'
# Sample away from the central bell rope, which naturally hangs in front.
for view_y in (-52/3,-52/3-8):
    view=Vector((0,view_y,.7))
    for x in (-.45,.45):
        for dz in (-.26,0,.26):
            point=plaque.matrix_world.translation+Vector((x,-.081,dz))
            direction=point-view
            hit,_,_,_,obj,_=bpy.context.scene.ray_cast(deps,view,direction.normalized(),distance=direction.length+.02)
            assert hit and (obj.name=='Entrance plaque' or obj.name.startswith('Plaque frame')), f'Plaque is obstructed at {view_y}, {x}, {dz}: {obj.name if hit else None}'
print('PLAQUE_FACADE_ATTACHMENT_AND_VISIBILITY_OK')
