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
