"""Original Blacksite 07 modular set. Blender 4.3; no third-party assets."""
import bpy, bmesh, math, random, os
from mathutils import Vector
random.seed(7)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/assets/models/environment.glb')
mats={}
def material(name,color,metal=0,rough=.65,emission=0):
 m=bpy.data.materials.new(name); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
 if emission: p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
 mats[name]=m; return m
material('concrete',(.26,.31,.32),0,.88)
material('asphalt',(.10,.15,.17),.1,.45)
material('paint-dark',(.075,.12,.13),.65,.44)
material('paint-olive',(.19,.25,.21),.55,.6)
material('paint-blue',(.095,.23,.27),.6,.48)
material('paint-orange',(.56,.21,.065),.5,.53)
material('rust',(.25,.105,.055),.5,.8)
material('steel',(.25,.32,.32),.82,.32)
material('black',(.025,.037,.042),.1,.55)
material('rubber',(.028,.034,.033),0,.94)
material('glass',(.14,.28,.30),.65,.14)
material('amber',(.98,.49,.10),.1,.3,3)
material('cool-light',(.46,.81,.87),.1,.3,3)
material('red',(.8,.07,.025),.1,.4,2)
material('yellow',(.62,.43,.12),.3,.65)
objects=[]
def finish(o,name,mat):
 o.name=name; o.data.materials.append(mats[mat]); objects.append(o); return o
# Author in map's x,y-up,z coordinates; Blender export converts to Three's y-up.
def loc(v):return(v[0],-v[2],v[1])
def box(name,p,s,mat='paint-dark',bevel=0):
 sx,sy,sz=s[0]/2,s[2]/2,s[1]/2
 vertices=[(-sx,-sy,-sz),(sx,-sy,-sz),(sx,sy,-sz),(-sx,sy,-sz),(-sx,-sy,sz),(sx,-sy,sz),(sx,sy,sz),(-sx,sy,sz)]
 faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
 if bevel:
  bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.bevel(bm,geom=list(bm.edges),offset=bevel,segments=2,affect='EDGES');bm.to_mesh(mesh);bm.free()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=loc(p)
 return finish(o,name,mat)
def cyl(name,p,r,h,mat='steel',axis='y',vertices=12):
 pts=[(r*math.cos(i*2*math.pi/vertices),r*math.sin(i*2*math.pi/vertices),z) for z in [-h/2,h/2] for i in range(vertices)]
 faces=[tuple(reversed(range(vertices))),tuple(range(vertices,vertices*2))]+[(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(pts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=loc(p)
 if axis=='x':o.rotation_euler[1]=math.pi/2
 elif axis=='z':o.rotation_euler[0]=math.pi/2
 return finish(o,name,mat)
def beam(name,a,b,r=.035,mat='steel'):
 a,b=Vector(loc(a)),Vector(loc(b));d=b-a
 o=cyl(name,(0,0,0),r,d.length,mat,'y',8);o.location=(a+b)/2;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def bolt(p):cyl('Fastener',p,.035,.022,'steel','z',8)
def pipe(p,r,h,axis='y',mat='rust'):
 cyl('Industrial pipe',p,r,h,mat,axis)
 for off in [-h/2+.16,h/2-.16]:
  q=list(p);q['xyz'.index(axis)]+=off;cyl('Pipe coupling',q,r*1.25,.12,'steel',axis)
def ibeam(p,h):
 x,y,z=p;box('Column web',(x,y,z),(.13,h,.4),'steel');box('Column flange',(x-.22,y,z),(.1,h,.65),'steel');box('Column flange',(x+.22,y,z),(.1,h,.65),'steel');box('Column foot',(x,y-h/2+.06,z),(.85,.12,.85),'steel',.02)
def barrier(x,z):
 o=box('Jersey concrete barrier',(x,.58,z),(4,1.16,.7),'concrete',.15)
 for i in range(7):
  o=box('Hazard stripe',(x-1.7+i*.5,.65,z+.36),(.18,.65,.015),'yellow');o.rotation_euler[1]=-.55
 box('Barrier base',(x,.12,z),(4.2,.24,.95),'concrete',.07)
def crate(x,y,z,s=1):
 box('Cargo crate',(x,y+s*.5,z),(s,s,s),'paint-olive',.045)
 for a in [-1,1]:
  box('Crate reinforcement',(x+a*s*.38,y+s*.5,z),(s*.10,s+.04,s+.05),'steel',.01)
  box('Crate reinforcement',(x,y+s*.5,z+a*s*.38),(s+.05,s+.04,s*.10),'steel',.01)
 box('Cargo label',(x,y+s*.6,z+s*.506),(s*.4,s*.23,.01),'yellow')
def container(x,z,w=5.4,d=10,c='paint-blue'):
 box('Shipping container',(x,1.65,z),(w,3.3,d),c,.045)
 for side in [-1,1]:
  for i in range(25):box('Container corrugation',(x+side*(w*.5+.035),1.65,z-d/2+.2+i*(d-.4)/24),(.12,3.1,.11),c,.025)
  for i in range(11):box('Door rib',(x-w/2+.2+i*(w-.4)/10,1.65,z+side*(d*.5+.025)),(.11,3.08,.10),c,.02)
  for dy in [.15,3.15]:box('Container frame',(x,dy,z+side*d*.5),(w+.08,.16,.16),'steel')
  for dx in [-w*.22,w*.22]:
   cyl('Locking bar',(x+dx,1.65,z+side*(d*.5+.12)),.04,2.85,'steel')
   for dy in [.4,1.6,2.9]:box('Door hinge',(x+dx,dy,z+side*(d*.5+.13)),(.22,.12,.14),'steel',.015)
 for side in [-1,1]:box('Container top rail',(x+side*w*.5,3.3,z),(.14,.18,d+.1),'steel')
def lamp(x,z,h=7,face=0):
 cyl('Floodlight mast',(x,h/2,z),.09,h,'steel');box('Mast footing',(x,.16,z),(.6,.32,.6),'concrete',.05)
 box('Floodlight bracket',(x,h-.2,z),(.9,.12,.12),'steel')
 for dx in [-.4,.4]:
  box('Floodlight housing',(x+dx,h,z),(.48,.4,.32),'black',.04);box('Floodlight lens',(x+dx,h,z+.17),(.40,.3,.02),'amber',.02)
def fence(x,z,length,axis='z',height=3):
 n=int(length/3)+1
 for i in range(n+1):
  d=-length/2+i*length/n;p=(x+(d if axis=='x' else 0),height/2,z+(d if axis=='z' else 0));cyl('Fence upright',p,.045,height,'steel')
 for y in [.25,height-.3,height]:
  a=(x-(length/2 if axis=='x' else 0),y,z-(length/2 if axis=='z' else 0));b=(x+(length/2 if axis=='x' else 0),y,z+(length/2 if axis=='z' else 0));beam('Fence rail',a,b,.035)
 # Fine industrial mesh with crossed steel diagonals, economical geometry.
 for i in range(int(length/.8)):
  a=-length/2+i*.8
  for sign in [-1,1]:
   d=min(a+height*.65,length/2)
   if axis=='x':beam('Chain link',(x+a,.3,z),(x+d,height-.3,z),.008,'steel') if sign==1 else beam('Chain link',(x+a,height-.3,z),(x+d,.3,z),.008,'steel')
   else:beam('Chain link',(x,.3,z+a),(x,height-.3,z+d),.008,'steel') if sign==1 else beam('Chain link',(x,height-.3,z+a),(x,.3,z+d),.008,'steel')
def stairs(x,z):
 for i in range(6):box('Metal step',(x,.1+i*.18,z-i*.3),(1.5,.18,.32),'steel')
def monitor(p):
 x,y,z=p;box('Terminal foot',(x,y,z),(.7,.08,.5),'black',.03);box('Terminal stand',(x,y+.2,z),(.12,.4,.12),'steel');box('Monitor bezel',(x,y+.65,z),(.95,.62,.12),'black',.045);box('Monitor screen',(x,y+.65,z+.07),(.83,.49,.014),'cool-light',.018)
# World foundations.
box('Yard asphalt',(0,-.18,3),(40,.35,30),'asphalt')
box('Warehouse slab',(0,-.18,-26),(29,.35,32),'concrete')
box('Corridor slab',(0,-.18,-51),(9,.35,18),'concrete')
box('Control slab',(0,-.18,-69),(25,.35,18),'concrete')
box('Extraction asphalt',(0,-.18,-93),(32,.35,30),'asphalt')
# Yard boundaries, gate, fencing, barriers.
for x in [-18,18]:
 box('Perimeter plinth',(x,.25,3),(.4,.5,30),'concrete');fence(x,3,30)
for x in [-12,12]:fence(x,17,12,'x',3.6)
# Close the shoulders where the wide yard narrows to the warehouse.
for x in [-16,16]:fence(x,-10,4,'x',3)
for x in [-5,5]:
 box('Gate tower',(x,2.4,17),(.6,4.8,.7),'concrete',.05);cyl('Gate beacon',(x,4.9,17),.12,.2,'red')
for x in [-1,1]:
 box('Sliding gate frame',(x*2.5,1.7,17),(4.8,3.4,.15),'steel');
 for i in range(15):box('Gate vertical bar',(x*2.5-2.3+i*.33,1.7,17),(.055,3.2,.18),'black')
container(-11,1,5.4,9,'paint-blue');container(11,0,5.4,10,'paint-orange')
# A stack of empty shells adds a believable silhouette.
container(-11,-7.5,5.4,5,'paint-olive')
barrier(-5,6);barrier(6,4)
for p in [(-6,0,-5),(-7.5,0,-5),(-6.7,1.2,-5)]:crate(*p,1.2)
for x,z in [(-16,10),(16,10),(-16,-7),(16,-7)]:lamp(x,z)
# Abandoned utility truck; bevelled body, windscreen, tyres, chassis, lamps.
box('Truck chassis',(10,.62,9),(2.3,.25,5.0),'black',.08)
box('Truck cab',(10,1.28,7.7),(2.25,1.1,1.9),'paint-olive',.16)
box('Truck bonnet',(10,1.1,6.4),(2.2,.65,.85),'paint-olive',.12)
box('Windscreen',(10,1.65,6.78),(1.92,.65,.04),'glass',.035)
box('Cab roof',(10,1.92,7.7),(2.35,.12,1.95),'paint-olive',.06)
for x in [8.91,11.09]:
 box('Cab side glass',(x,1.6,7.7),(.03,.56,1.3),'glass',.025);box('Mirror',(x+(-.18 if x<10 else .18),1.6,7),(.12,.25,.3),'black',.02)
for z in [7,10.5]:
 for x in [8.9,11.1]:cyl('Truck tyre',(x,.57,z),.51,.30,'rubber','x',16);cyl('Truck wheel',(x+(-.17 if x<10 else .17),.57,z),.26,.035,'steel','x',12)
box('Truck cargo bed',(10,.95,10),(2.35,.15,2.65),'steel',.04)
for x in [8.85,11.15]:box('Cargo side panel',(x,1.3,10),(.12,.7,2.65),'paint-olive',.03)
for z in [8.7,11.3]:box('Truck cargo panel',(10,1.3,z),(2.3,.7,.12),'paint-olive',.03)
for x in [9.2,10.8]:box('Truck headlamp',(x,1.15,5.94),(.45,.22,.02),'glass',.03)
box('Truck grille',(10,.95,5.94),(.85,.25,.03),'black')
for i in range(7):box('Grille slot',(9.64+i*.12,.95,5.91),(.045,.24,.02),'steel')
# Facility shell: massive blue-grey cladding broken up with proper structural frames.
for x in [-14,14]:box('Warehouse side wall',(x,4,-26),(.45,8,32),'concrete',.04)
for z in [-10,-42]:
 for x in [-8.5,8.5]:box('Warehouse end wall',(x,4,z),(11,8,.5),'concrete',.04)
 box('Warehouse doorway lintel',(0,6.6,z),(6.2,2.8,.5),'concrete')
 # Corrugated exterior upper cladding and framing.
 for i in range(57):box('Cladding rib',(-13.8+i*.49,6.7,z+.28),(.08,2.5,.12),'paint-dark')
 box('Facade steel beam',(0,5.1,z+.35),(28.6,.24,.28),'steel')
 for x in [-13.7,-3.15,3.15,13.7]:ibeam((x,4,z+.2),8)
box('Warehouse roof',(0,8.1,-26),(29,.25,33),'paint-dark')
for z in [-16,-25,-34,-41]:
 for x in [-13.5,13.5]:ibeam((x,4,z),8)
 box('Roof truss',(0,7.5,z),(27,.18,.18),'steel')
 for x in [-10,-5,0,5,10]:beam('Truss diagonal',(x-2.5,7.5,z),(x,8,z),.05,'steel')
 # Suspended industrial fixtures.
 for x in [-7,7]:
  beam('Lamp suspension',(x,7.9,z),(x,6.5,z),.018,'steel');box('Warehouse light',(x,6.45,z),(1.4,.13,.6),'black',.03);box('Warehouse diffuser',(x,6.37,z),(1.25,.02,.45),'amber')
# Warehouse racks, crates, industrial loading platform.
for x in [-10.5,10.5]:
 for z in [-18,-26,-34]:
  for dx in [-1.35,1.35]:
   for dz in [-2.3,2.3]:box('Rack upright',(x+dx,2.4,z+dz),(.10,4.8,.10),'paint-orange')
  for y in [.15,1.9,3.6]:
   box('Warehouse shelf',(x,y,z),(2.8,.13,4.8),'steel')
   for dz in [-1.2,1.2]:crate(x,y+.08,z+dz,1.2)
  for dz in [-2.3,2.3]:beam('Rack diagonal',(x-1.35,.15,z+dz),(x+1.35,4.7,z+dz),.025,'paint-orange')
for p in [(-5,0,-22),(-6.4,0,-22),(-5.7,1.25,-22),(5,0,-36)]:crate(*p,1.25)
# Forklift: counterweight, tyres, detailed cage, mast and forks.
x,z=5,-18
box('Forklift chassis',(x,.52,z),(1.7,.55,2.6),'paint-orange',.14);box('Forklift rear engine',(x,1,z+.8),(1.6,.65,.8),'paint-orange',.13)
box('Forklift seat',(x,1.02,z),(1.05,.18,.75),'black',.09);box('Seat back',(x,1.38,z+.3),(1,.65,.18),'black',.07)
for dx in [-.7,.7]:
 for dz in [-.65,.65]:box('Safety cage upright',(x+dx,1.75,z+dz),(.08,2.25,.08),'black')
box('Forklift overhead guard',(x,2.87,z),(1.65,.12,1.7),'black',.04)
for dx in [-.6,0,.6]:box('Guard bar',(x+dx,2.95,z),(.055,.05,1.6),'steel')
for dx in [-.62,.62]:box('Lift mast',(x+dx,1.9,z-1.35),(.18,3.8,.22),'steel');box('Fork',(x+dx,.2,z-2.1),(.17,.13,1.75),'steel',.015)
for dz in [-.8,.8]:
 for dx in [-.84,.84]:cyl('Forklift tyre',(x+dx,.47,z+dz),.4,.25,'rubber','x',16);cyl('Wheel hub',(x+dx*1.08,.47,z+dz),.18,.06,'steel','x')
beam('Steering column',(x,1,z-.35),(x,1.5,z-.45),.045,'black');cyl('Steering wheel',(x,1.5,z-.45),.23,.05,'black')
# Pipework and roof stacks.
for x in [-12,-11.4]:pipe((x,5,-26),.16,29,'z')
for x in [-10,9]:
 pipe((x,9.3,-29),.6,2.2,'y','steel');cyl('Vent cap',(x,10.45,-29),.85,.18,'paint-dark')
# Narrow service corridor with panel details and pipes overhead.
for x in [-4,4]:
 box('Corridor wall',(x,2.2,-51),(.35,4.4,18),'concrete')
 for z in [-44,-48,-52,-56]:
  box('Corridor wall panel',(x+(.19 if x<0 else -.19),1.7,z),(.08,2.2,2.8),'paint-dark',.035)
  box('Panel seam',(x+(.24 if x<0 else -.24),1.7,z),(.025,2.0,.025),'steel')
box('Corridor roof',(0,4.45,-51),(8.4,.2,18),'paint-dark')
for x in [-3.25,3.25]:pipe((x,3.7,-51),.12,17,'z','steel')
for z in [-45,-51,-57]:
 box('Strip light housing',(0,4.15,z),(3,.12,.4),'black');box('Strip light',(0,4.07,z),(2.8,.02,.25),'cool-light')
 box('Emergency light',(3.75,2.9,z),(.15,.25,.4),'red',.03)
# Control room.
for x in [-12,12]:box('Control room wall',(x,2.6,-69),(.4,5.2,18),'concrete')
for z in [-60,-78]:
 for x in [-7.5,7.5]:box('Control room end',(x,2.6,z),(9,5.2,.4),'concrete')
 box('Control room lintel',(0,4.25,z),(6,1.9,.4),'concrete')
box('Control room roof',(0,5.3,-69),(24,.2,18),'paint-dark')
for x in [-10.9,10.9]:
 for z in [-64,-67,-70,-73,-76]:
  box('Server cabinet',(x,1.2,z),(1.35,2.4,1.7),'black',.06)
  for y in [.3,.6,.9,1.2,1.5,1.8,2.1]:
   box('Server drawer',(x,y,z+.87),(1.16,.22,.02),'paint-dark',.015)
   for dx in [-.4,.4]:box('Server indicator',(x+dx,y,z+.89),(.04,.04,.015),'cool-light')
# Side research workstations leave central route and mission terminal clear.
for x in [-7,7]:
 for z in [-64,-74]:
  box('Research workbench',(x,.92,z),(3,.15,1.1),'steel',.05)
  for dx in [-1.3,1.3]:box('Bench support',(x+dx,.45,z),(.12,.9,.8),'steel')
  monitor((x,.99,z));box('Keyboard',(x,.99,z+.4),(.65,.035,.25),'black',.02)
# Glass side-partition visual does not obstruct the central route.
for x in [-8.5,8.5]:
 for y in [.1,3.9]:box('Partition rail',(x,y,-69),(.09,.1,7),'steel')
 for z in [-72.5,-69,-65.5]:box('Partition mullion',(x,2,z),(.12,4,.12),'steel')
 # Glass panes omitted from static model to allow engine's breakable glass implementation.
for z in [-64,-70,-76]:
 box('Control light',(0,5.05,z),(7,.1,.4),'black');box('Control diffuser',(0,4.98,z),(6.5,.02,.2),'cool-light')
# Exterior extraction, concrete perimeter and generator yard.
for x in [-15,15]:fence(x,-92,28,'z',3)
fence(0,-106,30,'x',3)
# Close the shoulders beside the research building at extraction.
for x in [-13.5,13.5]:fence(x,-78,3,'x',3)
for x,z in [(-13,-82),(13,-82),(-13,-102),(13,-102)]:lamp(x,z,6)
for x in [-10,10]:
 box('Generator cabinet',(x,1.3,-88),(3.3,2.6,5),'paint-olive',.14)
 for i in range(14):box('Generator vent',(x+1.67,.7+i*.1,-88),(.025,.045,3.8),'black')
 pipe((x,3.1,-89),.18,1,'y','steel')
for p in [(-6,0,-99),(6,0,-84)]:crate(*p,1.4)
# Exterior concrete retaining base and floor drainage, utility details.
for x in [-17,17]:
 box('Cable trench',(x,.015,2),(.25,.035,28),'black')
 for z in range(-10,16,2):box('Drain grille',(x,.04,z),(.6,.025,.6),'steel')
for i in range(18):
 x=random.choice([-1,1])*random.uniform(7,16);z=random.uniform(-5,14)
 box('Scattered debris',(x,.04,z),(random.uniform(.1,.4),.08,random.uniform(.15,.6)),random.choice(['rust','concrete','black']))
# Planar UVs let the runtime's locally generated PBR weathering maps tile consistently.
for o in bpy.data.objects:
 if o.type != 'MESH':continue
 mesh=o.data;uv=mesh.uv_layers.new(name='Weathering UV')
 for poly in mesh.polygons:
  n=poly.normal; axis=max(range(3),key=lambda i:abs(n[i]))
  axes=[i for i in range(3) if i!=axis]
  for li in poly.loop_indices:
   co=mesh.vertices[mesh.loops[li].vertex_index].co
   uv.data[li].uv=(co[axes[0]]*.16,co[axes[1]]*.16)

# Batch static surfaces by area and material to keep WebGL draw calls low.
for zone,zmin,zmax in [('yard',-10,30),('warehouse',-43,-10),('corridor',-60,-43),('control',-79,-60),('extraction',-130,-79)]:
 for matname in mats:
  batch=[]
  for o in list(bpy.data.objects):
   if o.type != 'MESH':continue
   worldz=-o.location.y
   if zmin<=worldz<zmax and len(o.data.materials) and o.data.materials[0].name==matname:batch.append(o)
  if not batch:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in batch:o.select_set(True)
  bpy.context.view_layer.objects.active=batch[0]
  bpy.ops.object.join();batch[0].name=zone+'__'+matname
# All assets original geometry; compressed at HTTP delivery by host, not Draco.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_materials='EXPORT',export_extras=True)
print('WROTE',OUT,os.path.getsize(OUT))
