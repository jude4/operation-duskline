"""Original VXR-7 viewmodel, authored for Operation Duskline. Blender 4.3+.
Run: blender -b --python scripts/create-weapon.py
All mesh design is original; no downloaded or restricted assets.
Blender +Y is forward and exports to glTF -Z.
"""
import bpy, math, os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def mat(name, color, metallic=0, rough=.45, emission=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=rough
    if emission: p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m
steel=mat('VXR · graphite steel',(.075,.09,.09),.82,.34)
edge=mat('VXR · machined edges',(.24,.28,.27),.9,.26)
black=mat('VXR · carbon polymer',(.018,.025,.024),.15,.65)
olive=mat('VXR · olive ceramic',(.18,.21,.16),.38,.53)
rubber=mat('VXR · stippled grip',(.034,.042,.038),0,.9)
orange=mat('VXR · safety amber',(.94,.29,.035),.25,.44)
glove=mat('Operator · woven olive glove',(.16,.19,.15),0,.92)
glove2=mat('Operator · reinforced leather',(.055,.065,.05),.05,.75)
sleeve=mat('Operator · charcoal field jacket',(.075,.105,.1),0,.92)
cuff=mat('Operator · cuff webbing',(.12,.15,.13),0,.95)
red=mat('VXR · luminous reticle',(.8,.06,.022),.2,.25,6)
marking=mat('VXR · enamel markings',(.55,.59,.48),.15,.6)

root=bpy.data.objects.new('VXR7_Assembly',None); bpy.context.collection.objects.link(root)

def finish(o,name,m,bevel=0,parent='auto'):
    o.name=name
    if m:o.data.materials.append(m)
    if parent=='auto':parent=root
    if parent:o.parent=parent
    if bevel:
        mod=o.modifiers.new('Soft machined edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
        try:bpy.ops.object.modifier_apply(modifier=mod.name)
        except:pass
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o

def box(name,loc,size,m,bevel=.003,rot=None,parent='auto'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc);o=bpy.context.object;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    return finish(o,name,m,bevel,parent)

def cyl(name,loc,r,depth,m,vertices=16,rot=(math.pi/2,0,0),parent='auto'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=rot)
    return finish(bpy.context.object,name,m,.001,parent)

def uv(name,loc,scale,m,parent='auto'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m,0,parent)

def profile(name,poly,width,m):
    # extruded hand-drawn Y/Z profile, with beveled silhouette.
    n=len(poly);v=[(x,y,z) for x in (-width/2,width/2) for y,z in poly]
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    return finish(o,name,m,.005)

# Profiled original upper/lower receivers and stock: not box placeholders.
profile('Forged upper receiver',[(-.18,.0),(-.17,.10),(-.11,.13),(.25,.13),(.33,.075),(.3,-.005),(-.08,-.035)],.115,steel)
profile('Lower receiver',[(-.15,.005),(.2,.005),(.23,-.07),(.12,-.11),(.04,-.10),(-.02,-.065),(-.12,-.065)],.103,olive)
profile('Adjustable shoulder stock',[(-.175,.08),(-.3,.08),(-.47,.045),(-.49,-.125),(-.42,-.13),(-.33,-.045),(-.17,-.025)],.092,black)
box('Rubber shoulder pad',(0,-.48,-.045),(.103,.024,.188),rubber,.012)
box('Cheek rest',(0,-.32,.075),(.1,.16,.035),olive,.009)
for side in (-1,1):
    box('Stock adjustment track',(.048*side,-.31,-.019),(.007,.19,.016),edge,.002)
    for y in (-.25,-.29,-.33):cyl('Stock pin',(.054*side,y,-.012),.007,.009,steel,12,(0,math.pi/2,0))
# Receiver side panel, ejection port, charge handle and safety selector.
box('Ejection port',(.061,.09,.059),(.004,.115,.044),black,.004)
box('Bolt plate',(.065,.1,.059),(.003,.08,.03),edge,.002)
handle=box('ChargingHandle',(.072,-.09,.086),(.05,.026,.023),edge,.003)
for frame,y in ((1,-.09),(12,-.15),(25,-.09)):
    handle.location.y=y;handle.keyframe_insert(data_path='location',frame=frame)
if handle.animation_data:handle.animation_data.action.name='Bolt_cycle'
for side in (-1,1):
    for y,z in ((-.12,.042),(.19,.035),(.29,.035)):
        cyl('Recessed torx fastener',(side*.06,y,z),.009,.006,edge,12,(0,math.pi/2,0))
        box('Torx inset',(side*.065,y,z),(.002,.008,.002),black,.0002)
    box('Receiver inlay',(side*.057,-.03,-.026),(.005,.1,.013),marking,.001)
cyl('Safety selector',(-.06,-.095,-.03),.017,.012,edge,16,(0,math.pi/2,0))
box('Safety lever',(-.071,-.081,-.04),(.009,.037,.01),orange,.002,rot=(.5,0,0))
# Angled grip / trigger guard.
profile('Pistol grip',[(-.12,-.055),(-.045,-.065),(-.065,-.205),(-.125,-.22),(-.157,-.19)],.074,rubber)
for i in range(6):box('Grip stipple ridge',(0,-.112,-.092-i*.017),(.077,.039,.005),black,.002,rot=(.2,0,0))
# trigger guard curved custom mesh loop.
for x in (-.037,.037):
    box('Guard side',(x,-.007,-.095),(.012,.09,.012),steel,.005,rot=(.08,0,0))
box('Guard front',(0,.037,-.067),(.077,.013,.061),steel,.006,rot=(.1,0,0))
box('Trigger blade',(0,-.018,-.066),(.009,.014,.045),edge,.003,rot=(.25,0,0))
# Detachable curved magazine; contrasting base and shell grooves.
profile('Magazine',[ (.06,-.08),(.16,-.08),(.18,-.205),(.213,-.285),(.13,-.317),(.085,-.231)],.076,black)
box('Magazine base plate',(0,.171,-.302),(.089,.102,.025),olive,.005,rot=(.3,0,0))
for side in (-1,1):
    for i in range(4):box('Magazine embossed channel',(.04*side,.102+i*.018,-.196),(.005,.008,.151),steel,.002,rot=(.21,0,0))
# Octagonal handguard and faceted barrel.
cyl('Handguard outer',(0,.397,.037),.071,.28,olive,8)
for side in (-1,1):
    for y in (.29,.34,.39,.44,.49):
        box('Cooling slot',(.064*side,y,.047),(.009,.029,.021),black,.003)
        box('Cooling bevel',(.066*side,y,.034),(.003,.03,.004),edge,.001)
# Barrel continues through open muzzle shroud.
cyl('Barrel',(0,.613,.037),.022,.225,steel,20)
cyl('Muzzle adapter',(0,.72,.037),.029,.038,edge,16)
cyl('Muzzle brake',(0,.765,.037),.036,.065,steel,8)
cyl('Muzzle bore',(0,.799,.037),.021,.002,black,20)
for side in (-1,1):
    for y in (.745,.765,.785):box('Brake gas vent',(.032*side,y,.037),(.005,.01,.026),black,.001)
# Picatinny-style top rib, alternating chamfered teeth.
box('Full length optics rail',(0,.16,.132),(.054,.61,.022),steel,.003)
for i in range(24):box('Rail tooth',(0,-.13+i*.025,.149),(.068,.012,.012),edge,.002)
# Small angled foregrip, mount and strap detail.
profile('Angled foregrip',[(.28,-.025),(.38,-.025),(.365,-.12),(.32,-.13),(.275,-.079)],.064,rubber)
for i in range(5):box('Foregrip rib',(0,.316,-.054-i*.014),(.068,.04,.004),black,.001,rot=(.15,0,0))
# Original open reflex sight housing. Torus axis aligned with barrel.
box('Optic riser',(0,.033,.17),(.054,.1,.032),black,.004)
for y in (-.006,.075):
    bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=8,location=(0,y,.218),major_radius=.037,minor_radius=.009,rotation=(math.pi/2,0,0))
    finish(bpy.context.object,'Reflex sight protective loop',steel)
for side in (-1,1):box('Reflex sight side rail',(.039*side,.034,.215),(.012,.082,.026),steel,.003)
box('Optic emitter',(0,-.002,.185),(.015,.018,.01),red,.001)
# Transparent sight pane / glass PBR.
glass=mat('VXR · coated optic glass',(.12,.32,.3),.3,.16);glass.diffuse_color=(.12,.32,.3,.14)
glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.14
glass.surface_render_method='DITHERED'
box('Optic glass',(0,.065,.218),(.056,.002,.055),glass,.002)
# Reticle dot intentionally held behind the sight and visible while aimed.
uv('Reflex reticle',(0,.068,.218),(.0018,.0012,.0018),red)
# Forward emergency irons.
box('Front sight post',(0,.492,.114),(.018,.018,.081),black,.002)
box('Front sight tip',(0,.492,.159),(.006,.01,.012),orange,.001)
# Side markings as raised text modelled locally.
def text(name,body,loc,size,rotation):
    curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.size=size;curve.extrude=.00015
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=rotation;o.parent=root;o.data.materials.append(marking)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
text('Factory model mark','VXR-7',(.062,-.12,.084),.018,(math.pi/2,0,math.pi/2))
# Viewmodel forearms and anatomical glove sections.
def limb(name,a,b,r1,r2,m):
    mid=(Vector(a)+Vector(b))/2;d=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r1,radius2=r2,depth=d.length,location=mid)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,m,.005)
# Arms slope back toward camera; forearm sleeves with cuffs and seams.
limb('Right sleeve',(.26,-.63,-.30),(.08,-.21,-.18),.085,.064,sleeve)
limb('Right woven cuff',(.09,-.235,-.184),(.067,-.18,-.161),.068,.062,cuff)
limb('Left sleeve',(-.33,-.52,-.36),(-.105,.17,-.15),.087,.06,sleeve)
limb('Left woven cuff',(-.12,.12,-.17),(-.099,.194,-.138),.064,.057,cuff)
# Right palm wraps pistol grip.
uv('Right glove palm',(.033,-.114,-.15),(.053,.053,.072),glove)
uv('Right glove back',(.061,-.134,-.146),(.042,.05,.06),glove2)
for i in range(4):
    z=-.116-i*.023
    limb('Right gloved finger',(.045,-.083,z),(-.035,-.081,z-.005),.013,.012,glove)
    uv('Right knuckle',(.047,-.084,z),(.016,.018,.016),glove2)
limb('Right index trigger finger',(.052,-.081,-.079),(.036,-.008,-.067),.012,.01,glove)
limb('Right thumb',(-.009,-.145,-.097),(-.048,-.099,-.08),.018,.014,glove)
# Supporting hand grips the angled foregrip from below.
uv('Left glove palm',(-.053,.273,-.11),(.051,.066,.048),glove)
uv('Left hand reinforcement',(-.081,.25,-.113),(.026,.052,.041),glove2)
for i in range(4):
    y=.24+i*.025
    limb('Left gloved finger',(-.052,y,-.09),(.031,y,-.092),.013,.011,glove)
    uv('Left knuckle',(-.058,y,-.085),(.018,.017,.019),glove2)
limb('Left support thumb',(-.034,.225,-.074),(-.046,.287,-.043),.016,.012,glove)
# Uniform stitching and wrist equipment.
for j in range(6):box('Right cuff seam',(.084+j*.005,-.206,-.15),(.002,.034,.003),olive,.0004)
box('Right cuff buckle',(.109,-.232,-.151),(.032,.025,.015),black,.002)
# Marker exports as glTF node for runtime muzzle location.
muzzle=bpy.data.objects.new('Muzzle',None);bpy.context.collection.objects.link(muzzle);muzzle.location=(0,.812,.037);muzzle.parent=root
# A distinct compact fictional sidearm; separate assembly toggled at runtime.
rifle_root=root
root=bpy.data.objects.new('Kestrel_Assembly',None);bpy.context.collection.objects.link(root)
profile('Kestrel profiled slide',[(-.105,.015),(-.105,.11),(-.07,.13),(.26,.13),(.295,.09),(.295,.023),(.22,.0)],.092,steel)
profile('Kestrel polymer chassis',[(-.09,.02),(.27,.02),(.26,-.047),(.035,-.055),(-.005,-.11),(-.105,-.09)],.081,olive)
profile('Kestrel grip',[(-.1,-.06),(-.017,-.065),(-.044,-.22),(-.126,-.23),(-.143,-.19)],.074,rubber)
box('Kestrel magazine plate',(0,-.088,-.225),(.083,.102,.017),black,.004,rot=(.15,0,0))
cyl('Kestrel barrel',(0,.282,.071),.019,.033,edge,16)
cyl('Kestrel bore',(0,.301,.071),.013,.003,black,16)
for side in (-1,1):
    for i in range(8):box('Kestrel slide serration',(.047*side,-.076+i*.01,.075),(.003,.004,.067),black,.001,rot=(.1,0,0))
    for i in range(6):box('Kestrel grip texture',(.038*side,-.084,-.095-i*.018),(.004,.057,.004),black,.001)
    box('Kestrel slide release',(.048*side,-.025,-.001),(.012,.05,.008),edge,.002)
for x in (-.035,.035):box('Kestrel trigger guard',(x,.013,-.076),(.009,.08,.009),steel,.003)
box('Kestrel trigger guard front',(0,.053,-.049),(.078,.012,.058),steel,.004)
box('Kestrel trigger',(0,.014,-.05),(.009,.012,.032),edge,.002,rot=(.2,0,0))
box('Kestrel rear sight',(0,-.08,.143),(.075,.018,.019),black,.002)
for x in (-.025,.025):uv('Kestrel rear dot',(x,-.092,.147),(.004,.002,.004),orange)
box('Kestrel front sight',(0,.251,.149),(.012,.021,.016),black,.002)
uv('Kestrel front dot',(0,.239,.153),(.003,.002,.003),red)
box('Kestrel accessory rail',(0,.18,-.051),(.058,.1,.013),black,.002)
for i in range(4):box('Kestrel accessory rail rib',(0,.145+i*.025,-.06),(.065,.009,.009),edge,.001)
# Compact two-handed stance: jacket sleeves, anatomical gloves and reinforcement.
limb('Kestrel right sleeve',(.24,-.57,-.27),(.07,-.19,-.16),.084,.063,sleeve)
limb('Kestrel left sleeve',(-.26,-.54,-.28),(-.07,-.14,-.18),.084,.059,sleeve)
limb('Kestrel right cuff',(.086,-.223,-.17),(.065,-.177,-.158),.068,.061,cuff)
limb('Kestrel left cuff',(-.083,-.19,-.187),(-.07,-.135,-.164),.064,.057,cuff)
uv('Kestrel right glove',(.029,-.1,-.149),(.051,.058,.073),glove)
uv('Kestrel left glove',(-.047,-.097,-.161),(.048,.065,.056),glove)
for i in range(4):
    zz=-.115-i*.024
    limb('Kestrel right finger',(.047,-.063,zz),(-.026,-.055,zz),.013,.011,glove)
    limb('Kestrel support finger',(-.052,-.073,zz-.01),(.025,-.073,zz-.01),.014,.011,glove2)
limb('Kestrel index finger',(.047,-.078,-.078),(.029,.008,-.049),.012,.01,glove)
limb('Kestrel support thumb',(-.05,-.125,-.111),(-.046,-.032,-.072),.015,.012,glove)
muzzle=bpy.data.objects.new('Kestrel_Muzzle',None);bpy.context.collection.objects.link(muzzle);muzzle.location=(0,.315,.071);muzzle.parent=root
# Batch static parts by material to keep the viewmodel to a small draw-call budget.
for assembly in (rifle_root,root):
    buckets={}
    for o in list(assembly.children):
        if o.type!='MESH' or o.name in ('Magazine','ChargingHandle') or o.animation_data:continue
        key=o.data.materials[0].name if len(o.data.materials) else 'default'
        buckets.setdefault(key,[]).append(o)
    for label,objects in buckets.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        objects[0].name=assembly.name+' · '+label
# Remove unwanted default frame and export all authored geometry and bolt clip.
bpy.context.scene.frame_set(1)
output=os.path.abspath(os.path.join(os.path.dirname(__file__),'../public/assets/models/vxr7.glb'))
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_animations=True,export_yup=True)
print('VXR7 export:',output)
