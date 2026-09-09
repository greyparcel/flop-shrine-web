"""Remove workstation paths from saved Blender UI state and render metadata."""
import bpy


def prepare_portable_scene(render_path='//'):
    for screen in bpy.data.screens:
        for area in screen.areas:
            for space in area.spaces:
                if space.type == 'FILE_BROWSER' and space.params:
                    space.params.directory = b'//'
                    space.params.filename = ''
    for scene in bpy.data.scenes:
        scene.render.filepath = render_path
        scene.render.use_stamp = False
        for prop in scene.render.bl_rna.properties:
            if prop.identifier.startswith('use_stamp_'):
                setattr(scene.render, prop.identifier, False)
    bpy.context.preferences.filepaths.save_version = 0
