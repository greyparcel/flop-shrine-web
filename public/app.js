import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {palette,glslColor,brand} from './palette.js';
import {createWishDisplay} from './wish-display.js';

const canvas=document.querySelector('#scene');
const status=document.querySelector('#status');
const state={target:0,distance:0,length:184,effects:true,ready:false,gateCount:42,brand};
// Read-only diagnostics for local verification; no network or tracking.
Object.defineProperty(window,'shrineWalk',{get:()=>({...state})});

try {
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<650?1.25:1.5));
renderer.setClearColor(palette.background,1);
renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
const scene=new THREE.Scene();
scene.background=palette.background.clone();
scene.fog=new THREE.FogExp2(palette.background,0.024);
const camera=new THREE.PerspectiveCamera(62,1,0.08,650);
const teal=palette.edge;
const edgeMaterial=new THREE.LineBasicMaterial({color:teal,transparent:true,opacity:0.87});
const bodyMaterial=new THREE.MeshBasicMaterial({color:palette.body,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
// Broad, constant-amplitude waves. Three.js uses Y for height (Blender uses Z).
class FloatingPath extends THREE.Curve {
  constructor(){super();this.arcLengthDivisions=4096;}
  getPoint(t,out=new THREE.Vector3()){
    const phase=t*Math.PI*4;
    return out.set(9*Math.sin(phase),4*(Math.sin(phase-.7)+Math.sin(.7)),-210*t);
  }
}
const path=new FloatingPath();
const curveLength=path.getLength();
const pathEnd=path.getPointAt(1);
const exitTangent=path.getTangentAt(1);
const endForward=exitTangent.clone();endForward.y=0;endForward.normalize();
const courtyardEnd=pathEnd.clone().addScaledVector(endForward,150).add(new THREE.Vector3(0,3,0));
const approach=new THREE.CubicBezierCurve3(pathEnd.clone(),pathEnd.clone().addScaledVector(exitTangent,18),pathEnd.clone().addScaledVector(endForward,130).add(new THREE.Vector3(0,3,0)),courtyardEnd);
approach.arcLengthDivisions=1024;
const approachLength=approach.getLength();
state.length=curveLength+approachLength;
const walkStorageKey='flop-shrine-walk-position';
try {
  const saved=JSON.parse(sessionStorage.getItem(walkStorageKey)||'null');
  if(saved && Number.isFinite(saved.distance)) state.target=state.distance=Math.max(0,Math.min(state.length,saved.distance));
} catch {}
function saveWalkPosition(){
  try {sessionStorage.setItem(walkStorageKey,JSON.stringify({distance:state.distance}));} catch {}
}
window.addEventListener('pagehide',saveWalkPosition);
document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');
  if(link && new URL(link.href).origin===location.origin) saveWalkPosition();
});

state.gateSpacing=(curveLength-18)/(state.gateCount-1);
state.lastGateDistance=curveLength-9;
state.torchStartDistance=curveLength+5;
const wishDisplay=await createWishDisplay({gateSpacing:state.gateSpacing,gateCount:state.gateCount});
state.wishCount=wishDisplay.count;
function routePoint(distance,out=new THREE.Vector3()){
  if(distance<=curveLength)return path.getPointAt(Math.max(0,distance/curveLength),out);
  const beyond=distance-curveLength;
  approach.getPointAt(Math.min(1,beyond/approachLength),out);
  if(beyond>approachLength)out.addScaledVector(endForward,beyond-approachLength);
  return out;
}
function routeTangent(distance){
  if(distance<=curveLength)return path.getTangentAt(Math.max(0,distance/curveLength));
  return approach.getTangentAt(Math.min(1,(distance-curveLength)/approachLength));
}
const positions=[];
const transforms=[];
for(let i=0;i<state.gateCount;i++){
  const u=(9+i*state.gateSpacing)/curveLength;
  const position=path.getPointAt(u);
  const tangent=path.getTangentAt(u);
  // Yaw follows the path, but pillars stay vertical: no pitch or roll.
  const orientation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(-tangent.x,-tangent.z));
  positions.push(position);
  transforms.push(new THREE.Matrix4().compose(position,orientation,new THREE.Vector3(1,1,1)));
}
const wireVertices=[];
function repeatGeometry(geometry){
  const mesh=new THREE.InstancedMesh(geometry,bodyMaterial,positions.length);
  transforms.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();scene.add(mesh);
  const edges=new THREE.EdgesGeometry(geometry,24).attributes.position;
  const vertex=new THREE.Vector3();
  for(const matrix of transforms){for(let i=0;i<edges.count;i++){
    vertex.fromBufferAttribute(edges,i).applyMatrix4(matrix);
    wireVertices.push(vertex.x,vertex.y,vertex.z);
  }}
}
function box(w,h,d,x,y,z=0){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);repeatGeometry(g);}
function curvedBeam(width,y,height,depth,rise){
  const n=32,shape=new THREE.Shape();
  const yy=x=>y+rise*Math.pow(Math.abs(x)/(width/2),3);
  shape.moveTo(-width/2,yy(-width/2));
  for(let i=1;i<=n;i++){const x=-width/2+width*i/n;shape.lineTo(x,yy(x));}
  for(let i=n;i>=0;i--){const x=-width/2+width*i/n;shape.lineTo(x,yy(x)+height);}
  shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});
  g.translate(0,0,-depth/2);repeatGeometry(g);
}
for(const sign of [-1,1]){
  box(.54,.24,.62,sign*2.08,.12);
  const g=new THREE.CylinderGeometry(.155,.155,5.3,8);
  g.translate(sign*2.08,2.89,0);repeatGeometry(g);
}
box(5.12,.21,.18,0,4.13);
box(.22,.93,.24,0,4.68);
curvedBeam(5.78,5.10,.14,.39,.26);
curvedBeam(6.22,5.30,.22,.55,.37);
const wireGeometry=new THREE.BufferGeometry();
wireGeometry.setAttribute('position',new THREE.Float32BufferAttribute(wireVertices,3));
scene.add(new THREE.LineSegments(wireGeometry,edgeMaterial));

// Low path lamps, with local pools of light following the floating route.
// An analytic light field avoids dozens of dynamic shadow-casting lights on phones.
const lampSpacing=state.gateSpacing*2;
const lampCount=Math.floor((curveLength-18)/lampSpacing)+1;
state.lampSpacing=lampSpacing;
state.lampCount=lampCount;
const lampBaseGeometry=new THREE.BoxGeometry(.17,.32,.17);
const lampCapGeometry=new THREE.BoxGeometry(.24,.065,.24);
const lampBases=new THREE.InstancedMesh(lampBaseGeometry,new THREE.MeshBasicMaterial({color:palette.metal}),lampCount);
const lampCaps=new THREE.InstancedMesh(lampCapGeometry,new THREE.MeshBasicMaterial({color:palette.lamp}),lampCount);
const lampMatrix=new THREE.Matrix4(),lampPosition=new THREE.Vector3();
const up=new THREE.Vector3(0,1,0);
for(let i=0;i<lampCount;i++){
  const u=(9+i*lampSpacing)/curveLength;
  const center=path.getPointAt(u),tangent=path.getTangentAt(u);
  const sideways=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
  const rotation=new THREE.Quaternion().setFromAxisAngle(up,Math.atan2(-tangent.x,-tangent.z));
  const sign=i%2===0?-1:1;
    lampPosition.copy(center).addScaledVector(sideways,sign*1.4).addScaledVector(up,.16);
    lampMatrix.compose(lampPosition,rotation,new THREE.Vector3(1,1,1));
    lampBases.setMatrixAt(i,lampMatrix);
    lampPosition.y+=.17;
    lampMatrix.compose(lampPosition,rotation,new THREE.Vector3(1,1,1));
    lampCaps.setMatrixAt(i,lampMatrix);
}
lampBases.instanceMatrix.needsUpdate=true;lampCaps.instanceMatrix.needsUpdate=true;
scene.add(lampBases,lampCaps);

const floorVertices=[],floorUV=[],floorIndices=[];
const floorSegments=700;
for(let i=0;i<=floorSegments;i++){
  const u=i/floorSegments,center=path.getPointAt(u),tangent=path.getTangentAt(u);
  const sideways=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
  for(const sign of [-1,1]){
    const p=center.clone().addScaledVector(sideways,sign*3.4);
    floorVertices.push(p.x,p.y-.025,p.z);floorUV.push(sign*3.4,u*curveLength);
  }
  if(i<floorSegments){const k=i*2;floorIndices.push(k,k+2,k+1,k+1,k+2,k+3);}
}
const litFloorGeometry=new THREE.BufferGeometry();
litFloorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(floorVertices,3));
litFloorGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(floorUV,2));
litFloorGeometry.setIndex(floorIndices);
const litFloorMaterial=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  uniforms:{spacing:{value:lampSpacing},lastLamp:{value:lampCount-1}},
  vertexShader:`varying vec2 coord;varying float depth;
    void main(){coord=uv;vec4 p=modelViewMatrix*vec4(position,1.);depth=length(p.xyz);gl_Position=projectionMatrix*p;}`,
  fragmentShader:`precision highp float;uniform float spacing;uniform float lastLamp;varying vec2 coord;varying float depth;
    void main(){float nearest=floor((coord.y-9.)/spacing+.5);
      float pool=0.;
      for(int k=-1;k<=1;k++){
        float index=nearest+float(k);
        if(index<0.||index>lastLamp)continue;
        float side=mod(index,2.)<.5?-1.:1.;
        float along=coord.y-(9.+index*spacing);
        float radius=pow((coord.x-side*1.4)/1.05,2.)+pow(along/1.7,2.);
        pool+=exp(-radius*1.3);
      }
      float grain=.94+.06*sin(coord.x*83.)*sin(coord.y*111.);
      float fade=exp(-pow(depth*.024,2.));
      float edge=1.-smoothstep(2.6,3.4,abs(coord.x));
      gl_FragColor=vec4(${glslColor(.4,.018)}*grain,pool*.65*fade*edge);
    }`
});
scene.add(new THREE.Mesh(litFloorGeometry,litFloorMaterial));

// The destination is an actual Blender-authored GLB, not a billboard.
const hallAsset=await new GLTFLoader().loadAsync('./models/honden-01.glb');
hallAsset.scene.updateMatrixWorld(true);
const hallGroups=new Map();
const courtyardLightGeometries=[];
const bellContours=[];
hallAsset.scene.traverse(object=>{
  if(!object.isMesh)return;
  const name=object.material.name;
  let geometry=object.geometry.clone();
  if(geometry.index)geometry=geometry.toNonIndexed();
  for(const attribute of Object.keys(geometry.attributes))if(attribute!=='position')geometry.deleteAttribute(attribute);
  geometry.applyMatrix4(object.matrixWorld);
  if(/Entrance.suzu.bell/.test(object.name)){
    const shell=geometry.clone();shell.computeBoundingBox();
    const center=shell.boundingBox.getCenter(new THREE.Vector3());
    shell.translate(-center.x,-center.y,-center.z);shell.scale(1.035,1.035,1.035);shell.translate(center.x,center.y,center.z);
    bellContours.push(shell);
  }
  if(/Courtyard.lantern.light/.test(object.name)){
    courtyardLightGeometries.push(geometry);return;
  }
  if(!hallGroups.has(name))hallGroups.set(name,[]);
  hallGroups.get(name).push(geometry);
});
const hall=new THREE.Group();hall.name='Blender Honden';
// A quiet silhouette makes the unlit round bell readable without decorative cross-lines.
for(const geometry of bellContours)hall.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:palette.outline,side:THREE.BackSide})));
const hallLightReveal={value:0};
// Four broad pools fall on actual architectural surfaces, rather than outlining the roof in bulbs.
const hallLampLocations=[[-6,5.6,5.6],[6,5.6,5.6],[-17,4.3,3.3],[17,4.3,3.3]];
const courtyardLampLocations=[[-6.8,1.8,9.7],[6.8,1.8,9.7]];
for(const [name,geometries] of hallGroups){
  const geometry=mergeGeometries(geometries,false);
  geometry.computeVertexNormals();
  const accented=name.includes('turquoise');
  const color=accented?palette.accent:name.includes('inner')?palette.inner:palette.body;
  const surface=new THREE.MeshBasicMaterial({color,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  surface.onBeforeCompile=shader=>{
    shader.uniforms.hallLightReveal=hallLightReveal;
    shader.vertexShader='varying vec3 hallPosition;varying vec3 hallNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhallPosition=position;hallNormal=normal;');
    shader.fragmentShader='varying vec3 hallPosition;varying vec3 hallNormal;uniform float hallLightReveal;\n'+shader.fragmentShader;
    const pools=hallLampLocations.map(p=>`{vec3 offset=vec3(${p.map(n=>n.toFixed(2)).join(',')})-hallPosition;float d=length(offset);float facing=.18+.82*max(0.,dot(normalize(hallNormal),normalize(offset)));wash+=facing*exp(-d*d/8.5);}`).join('\n');
    const courtyardPools=courtyardLampLocations.map(p=>`{vec3 offset=vec3(${p.map(n=>n.toFixed(2)).join(',')})-hallPosition;float d=length(offset);float facing=.18+.82*max(0.,dot(normalize(hallNormal),normalize(offset)));wash+=facing*exp(-d*d/8.5);}`).join('\n');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat wash=0.;${pools}\n${courtyardPools}\ndiffuseColor.rgb+=${glslColor(.49,.035)}*.575*wash*hallLightReveal;`);
  };
  hall.add(new THREE.Mesh(geometry,surface));
  if(!name.includes('inner'))hall.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,26),new THREE.LineBasicMaterial({color:accented?palette.detail:palette.outline,transparent:true,opacity:.75})));
}
// Reuse the Blender lantern chambers at the same intensity as the hanging lamps.
const courtyardLampMaterial=new THREE.MeshBasicMaterial({color:palette.lamp,fog:false});
for(const geometry of courtyardLightGeometries)hall.add(new THREE.Mesh(geometry,courtyardLampMaterial));
state.courtyardLightCount=courtyardLightGeometries.length;
hall.scale.setScalar(3);
hall.position.copy(courtyardEnd).addScaledVector(endForward,52);
hall.rotation.y=Math.atan2(-endForward.x,-endForward.z);
scene.add(hall);
const hallMaterials=[];
hall.traverse(object=>{
  if(!object.material)return;
  object.material.fog=false;
  hallMaterials.push({material:object.material,color:object.material.color.clone()});
});
hall.visible=false;
const courtyardPoolMaterial=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{reveal:hallLightReveal},
  vertexShader:`varying vec2 poolUV;void main(){poolUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`precision highp float;uniform float reveal;varying vec2 poolUV;void main(){float r=length((poolUV-.5)*16.);float d=length(vec2(r,1.788));float facing=.18+.82*1.788/d;float pool=facing*exp(-d*d/8.5)*(1.-smoothstep(7.,8.,r));gl_FragColor=vec4(${glslColor(.49,.035)}*.575,pool*reveal);}`
});
for(const [x,,z] of courtyardLampLocations){
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(16,16),courtyardPoolMaterial);
  pool.rotation.x=-Math.PI/2;pool.position.set(x,.012,z);hall.add(pool);
}
hall.updateMatrixWorld(true);
state.hondenLocalWidth=new THREE.Box3().setFromObject(hallAsset.scene).getSize(new THREE.Vector3()).x;
const hallFocus=hall.localToWorld(new THREE.Vector3(0,3.8,2.8));
const promptAnchor=hall.localToWorld(new THREE.Vector3(0,3.8,3.0));
const promptScreen=new THREE.Vector3();
state.hondenScale=3;
state.hondenLoaded=true;
state.hondenSource='Blender GLB';

// Architectural lights are independent of the hall's distance-triggered reveal.
const hallLights=new THREE.Group();hallLights.name='Distant honden lanterns';
hallLights.position.copy(hall.position);hallLights.quaternion.copy(hall.quaternion);hallLights.scale.copy(hall.scale);
const beaconPositions=hallLampLocations.flat();
const beaconsGeometry=new THREE.BufferGeometry();
beaconsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(beaconPositions,3));
const beaconsMaterial=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(1700./max(1.,-p.z),3.,42.);}`,
  fragmentShader:`precision highp float;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float glow=exp(-r*r*4.)*(1.-smoothstep(.5,1.,r));gl_FragColor=vec4(${glslColor(1.1,.12)},glow*.25);}`
});
hallLights.add(new THREE.Points(beaconsGeometry,beaconsMaterial));
const lanternMaterial=new THREE.MeshBasicMaterial({color:palette.lamp,fog:false});
const lanternFrameMaterial=new THREE.MeshBasicMaterial({color:palette.frame,fog:false});
for(const p of hallLampLocations){
  const lantern=new THREE.Group();lantern.position.set(...p);
  lantern.add(new THREE.Mesh(new THREE.BoxGeometry(.5,.8,.5),lanternMaterial));
  for(const y of [-.47,.47]){
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.7,.12,.7),lanternFrameMaterial);cap.position.y=y;lantern.add(cap);
  }
  for(const x of [-.27,.27])for(const z of [-.27,.27]){
    const frame=new THREE.Mesh(new THREE.BoxGeometry(.045,.88,.045),lanternFrameMaterial);frame.position.set(x,0,z);lantern.add(frame);
  }
  const hanger=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.8,5),lanternFrameMaterial);hanger.position.y=.92;lantern.add(hanger);
  hallLights.add(lantern);
}
scene.add(hallLights);
state.hondenLightCount=beaconPositions.length/3;
state.hondenLightsIndependent=true;

// Kagaribi: open iron fire baskets on splayed tripods, shared by all 24 fixtures.
const torchRows=12,torchFlames=[];
const torchMetalMaterial=new THREE.MeshBasicMaterial({color:palette.outline});
const brazierParts=[];
function brazierRod(a,b,r=.035){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const geometry=new THREE.CylinderGeometry(r,r,delta.length(),6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
  geometry.translate(...start.add(end).multiplyScalar(.5).toArray());brazierParts.push(geometry);
}
for(let i=0;i<3;i++){
  const a=i*Math.PI*2/3;
  // Each slender leg crosses the center to support the opposite side of the basket.
  brazierRod([Math.cos(a)*.47,.03,Math.sin(a)*.47],[-Math.cos(a)*.25,1.93,-Math.sin(a)*.25],.024);
}
for(const [r,y] of [[.25,1.86],[.46,2.22]]){
  const ring=new THREE.TorusGeometry(r,.022,5,24);ring.rotateX(Math.PI/2);ring.translate(0,y,0);brazierParts.push(ring);
}
for(let i=0;i<6;i++){
  const a=i*Math.PI*2/6,c=Math.cos(a),s=Math.sin(a);
  brazierRod([c*.25,1.86,s*.25],[c*.47,2.26,s*.47],.019);
}
for(const angle of [0,Math.PI/3,Math.PI*2/3]){
  brazierRod([-.25*Math.cos(angle),1.87,-.25*Math.sin(angle)],[.25*Math.cos(angle),1.87,.25*Math.sin(angle)],.019);
}
const brazierGeometry=mergeGeometries(brazierParts);for(const g of brazierParts)g.dispose();
const logMaterial=new THREE.MeshBasicMaterial({color:palette.wood});
const logGeometry=new THREE.CylinderGeometry(.045,.06,.58,7);logGeometry.rotateZ(Math.PI/2);
const fireMaterial=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  uniforms:{time:{value:0},still:{value:0}},
  vertexShader:`varying vec2 fuv;void main(){fuv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`precision highp float;uniform float time;uniform float still;varying vec2 fuv;
    void main(){float h=fuv.y;float sway=sin(h*10.-time*3.)*.055*h*(1.-still);
      float x=abs(fuv.x-.5+sway);float width=.29*pow(1.-h,.72)+.009;
      float flame=1.-smoothstep(width*.25,width,x);
      float sideHeight=h/.73;float sideWidth=.16*pow(max(0.,1.-sideHeight),.8);
      float sideX=abs(abs(fuv.x-.5-sway*.8)-.21);
      flame=max(flame,(1.-smoothstep(sideWidth*.2,max(.001,sideWidth),sideX))*(1.-smoothstep(.59,.74,h)));
      flame*=smoothstep(0.,.12,h)*(1.-smoothstep(.87,1.,h));
      float core=(1.-smoothstep(.025,.22,x))*pow(1.-h,1.5);
      gl_FragColor=vec4(mix(${glslColor(1.05,.02)},${glslColor(1.2,.4)},core),flame*.88);
    }`
});
// Local ground catches the elevated firelight; the rest of the approach stays dark.
const brazierPoolGeometry=new THREE.PlaneGeometry(6,6);
brazierPoolGeometry.rotateX(-Math.PI/2);
const brazierPoolMaterial=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 poolUV;varying float depth;void main(){poolUV=uv;vec4 p=modelViewMatrix*vec4(position,1.);depth=length(p.xyz);gl_Position=projectionMatrix*p;}`,
  fragmentShader:`precision highp float;varying vec2 poolUV;varying float depth;
    void main(){vec2 ground=(poolUV-.5)*6.;float r=length(ground);
      float facing=2.52/length(vec3(ground,2.52));
      float pool=exp(-r*r/3.2)*facing*(1.-smoothstep(2.3,3.,r));
      float fade=exp(-pow(depth*.024,2.));
      float grain=.96+.04*sin(ground.x*83.)*sin(ground.y*111.);
      gl_FragColor=vec4(${glslColor(.4,.018)}*grain,pool*.65*fade);
    }`
});
for(let i=0;i<torchRows;i++){
  const d=state.torchStartDistance+i*8;
  const center=routePoint(d);
  const tangent=routeTangent(d);
  const sideways=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
  for(const sign of [-1,1]){
    const pos=center.clone().addScaledVector(sideways,sign*3.25);
    const basket=new THREE.Mesh(brazierGeometry,torchMetalMaterial);basket.position.copy(pos);scene.add(basket);
    const pool=new THREE.Mesh(brazierPoolGeometry,brazierPoolMaterial);pool.position.copy(pos).y-=.015;scene.add(pool);
    for(let j=0;j<3;j++){
      const log=new THREE.Mesh(logGeometry,logMaterial);log.position.copy(pos).y+=1.93+j*.045;log.rotation.y=j*Math.PI/3;scene.add(log);
    }
    const fire=new THREE.Mesh(new THREE.PlaneGeometry(1.22,1.12),fireMaterial);fire.position.copy(pos).y+=2.52;scene.add(fire);torchFlames.push(fire);
  }
}
state.torchCount=torchFlames.length;
for(const fire of torchFlames)fire.layers.set(1);
state.approachLightDesign='kagaribi';
state.lastTorchDistance=state.torchStartDistance+(torchRows-1)*8;

// CRT treatment is computed every frame; it is not a prerecorded animation.
// Preserve sub-byte shadow colors until the final display conversion.
const floatColor=renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float');
const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,type:floatColor?THREE.HalfFloatType:THREE.UnsignedByteType});
state.shadowBuffer=floatColor?'float16':'byte8';
target.samples=4;
// Preserve architecture occlusion in a separate flame pass, outside CRT processing.
const flameTarget=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,type:target.texture.type});
flameTarget.samples=4;
const occlusionMaterial=new THREE.MeshBasicMaterial({colorWrite:false});
const screenScene=new THREE.Scene();
const screenCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const screenMaterial=new THREE.ShaderMaterial({
  uniforms:{image:{value:target.texture},flames:{value:flameTarget.texture},resolution:{value:new THREE.Vector2(1,1)},crt:{value:1}},
  vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:`precision highp float;uniform sampler2D image;uniform sampler2D flames;uniform vec2 resolution;uniform float crt;varying vec2 uv0;
  vec3 displaySRGB(vec3 linearColor){
    vec3 c=max(linearColor,vec3(0.));
    return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
  }
  void main(){vec2 uv=uv0;vec3 c=texture2D(image,uv).rgb;
    if(crt>.5){vec2 p=1.6/resolution;vec3 glow=vec3(0.);
      glow+=texture2D(image,uv+vec2(p.x,0.)).rgb;glow+=texture2D(image,uv-vec2(p.x,0.)).rgb;
      glow+=texture2D(image,uv+vec2(0.,p.y)).rgb;glow+=texture2D(image,uv-vec2(0.,p.y)).rgb;
      glow+=texture2D(image,uv+p*2.).rgb;glow+=texture2D(image,uv-p*2.).rgb;
      c+=glow*.075;
      c*=.94+.06*sin(uv.y*resolution.y*2.094395);
      vec2 v=uv-.5;c*=1.-.58*dot(v,v);
    }
    c+=texture2D(flames,uv).rgb;
    gl_FragColor=vec4(displaySRGB(c),1.);
  }`
});
screenScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),screenMaterial));
function resize(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  renderer.setSize(w,h,false);camera.aspect=w/h;
  camera.fov=w<650?74:62;camera.updateProjectionMatrix();
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());
  target.setSize(size.x,size.y);flameTarget.setSize(size.x,size.y);screenMaterial.uniforms.resolution.value.copy(size);
}
addEventListener('resize',resize);resize();
const clamp=v=>Math.max(0,Math.min(state.length,v));
let dronePhase='off',droneSpeed=0,lift=0;
const droneButton=document.querySelector('#drone');
const overviewBounds=new THREE.Box3();
for(let i=0;i<=100;i++)overviewBounds.expandByPoint(routePoint(state.length*i/100));
overviewBounds.expandByPoint(hallFocus);overviewBounds.expandByScalar(16);
const overviewCenter=overviewBounds.getCenter(new THREE.Vector3());
const overviewDirection=new THREE.Vector3(.25,1,.65).normalize();
const overviewRight=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),overviewDirection).normalize();
const overviewUp=new THREE.Vector3().crossVectors(overviewDirection,overviewRight).normalize();
const overviewCorners=[];
for(const x of [overviewBounds.min.x,overviewBounds.max.x])for(const y of [overviewBounds.min.y,overviewBounds.max.y])for(const z of [overviewBounds.min.z,overviewBounds.max.z])overviewCorners.push(new THREE.Vector3(x,y,z).sub(overviewCenter));
function droneLabel(){droneButton.setAttribute('aria-pressed',String(dronePhase!=='off'&&dronePhase!=='return'));droneButton.querySelector('span').textContent=dronePhase==='hold'?'END':dronePhase==='off'||dronePhase==='return'?'OFF':'ON';}
function stopDrone(){if(dronePhase==='off'||dronePhase==='return')return;dronePhase=lift>0?'return':'off';droneSpeed=0;state.target=state.distance;droneLabel();}
droneButton.onclick=()=>{if(dronePhase!=='off'&&dronePhase!=='return'){stopDrone();return;}lift=0;inertia=0;state.target=state.distance=0;droneSpeed=0;dronePhase='walk';droneLabel();};
document.querySelector('#experience').addEventListener('wheel',stopDrone,{passive:true});
function move(amount){state.target=clamp(state.target+amount);}
document.querySelector('#experience').addEventListener('wheel',e=>{e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;move(Math.max(-260,Math.min(260,e.deltaY*unit))*.022);},{passive:false});
let drag=null,inertia=0;
canvas.addEventListener('wheel',()=>{inertia=0;},{passive:true});
document.addEventListener('pointerdown',()=>{if(inertia){inertia=0;state.target=state.distance;}},true);
const wishPanel=document.querySelector('#gate-wish');
const promptPanel=document.querySelector('#participate');
let suppressWishClickUntil=0;
for(const surface of [canvas,wishPanel,promptPanel]){
surface.addEventListener('pointerdown',e=>{if(!e.isPrimary){drag=null;inertia=0;state.target=state.distance;return;}drag={id:e.pointerId,y:e.clientY,time:performance.now(),velocity:0,touch:e.pointerType==='touch',travel:0};if(surface===canvas){canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});}});
surface.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  stopDrone();
  const now=performance.now(),elapsed=Math.max(8,now-drag.time),speed=drag.touch?1.3:1;
  const amount=(drag.y-e.clientY)*.032*speed,velocityLimit=65*speed;
  drag.travel+=Math.abs(drag.y-e.clientY);
  if(surface!==canvas&&drag.travel>6){surface.setPointerCapture(e.pointerId);suppressWishClickUntil=performance.now()+700;}
  move(amount);
  drag.velocity=drag.velocity*.25+Math.max(-velocityLimit,Math.min(velocityLimit,amount*1000/elapsed))*.75;
  drag.y=e.clientY;drag.time=now;
});
surface.addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  inertia=drag.touch&&!reduced.matches&&performance.now()-drag.time<100?drag.velocity:0;
  drag=null;
});
for(const event of ['pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{if(event==='lostpointercapture'&&e.target!==surface)return;if(drag)inertia=0;drag=null;});
}
for(const panel of [wishPanel,promptPanel])panel.addEventListener('click',e=>{if(performance.now()<suppressWishClickUntil){e.preventDefault();e.stopPropagation();}},true);
addEventListener('keydown',e=>{
  inertia=0;
  if(e.target instanceof HTMLButtonElement||e.target instanceof HTMLAnchorElement)return;
  stopDrone();
  const steps={ArrowUp:2.4,ArrowDown:-2.4,PageDown:12,PageUp:-12,' ':6};
  if(e.key in steps){e.preventDefault();move(steps[e.key]);}
  if(e.key==='Home'){e.preventDefault();state.target=0;}
  if(e.key==='End'){e.preventDefault();state.target=state.length;}
});
document.querySelector('#reset').onclick=()=>{stopDrone();inertia=0;state.target=0;};
const wishesButton=document.querySelector('#wishes');
let wishesVisible=true;
try{wishesVisible=sessionStorage.getItem('flop-shrine-wishes')!=='off';}catch{}
function syncWishes(){
  document.body.classList.toggle('wishes-off',!wishesVisible);
  wishesButton.setAttribute('aria-pressed',String(wishesVisible));
  wishesButton.querySelector('span').textContent=wishesVisible?'ON':'OFF';
}
syncWishes();
wishesButton.onclick=()=>{wishesVisible=!wishesVisible;syncWishes();try{sessionStorage.setItem('flop-shrine-wishes',wishesVisible?'on':'off');}catch{}};
const jumpEnd=document.querySelector('#jump-end');
jumpEnd.hidden=!['localhost','127.0.0.1','[::1]'].includes(location.hostname);
jumpEnd.onclick=()=>{state.target=state.length;state.distance=state.length;};
const agentPrompt=fetch('./agent-prompt.txt').then(response=>response.ok?response.text():null).catch(()=>null);
document.querySelector('#copy-prompt').onclick=async()=>{
  try{
    const message=await agentPrompt;
    if(!message)throw new Error('Prompt unavailable');
    await navigator.clipboard.writeText(message);
    document.querySelector('#copy-status').textContent='Copied with instructions. Your agent will ask you to review the wish.';
  }
  catch{document.querySelector('#copy-status').textContent='Could not copy. Open “Read full prompt” and copy the text there.';}
};
document.querySelector('#effects').onclick=e=>{
  state.effects=!state.effects;screenMaterial.uniforms.crt.value=Number(state.effects);
  e.currentTarget.setAttribute('aria-pressed',String(state.effects));
  e.currentTarget.querySelector('span').textContent=state.effects?'ON':'OFF';
};
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.hidden=false;status.textContent='The 3D display was interrupted. Reload this page to resume.';});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let last=performance.now();
const eyeOffset=new THREE.Vector3(0,2.1,0);
const eye=new THREE.Vector3(),look=new THREE.Vector3(),direction=new THREE.Vector3();
function pointAtDistance(distance,out){
  return routePoint(distance,out);
}
function frame(now){
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(dronePhase==='walk'){
    const remaining=state.length-state.target;
    droneSpeed+=(Math.min(6,Math.max(.7,remaining*.8))-droneSpeed)*(1-Math.exp(-dt*1.5));
    move(droneSpeed*dt);
    if(state.distance>=state.length-.15){state.target=state.distance=state.length;dronePhase='rise';}
  }
  if(dronePhase==='rise'){lift=Math.min(1,lift+dt/10);if(lift===1){dronePhase='hold';droneLabel();}}
  if(dronePhase==='return'){lift=Math.max(0,lift-dt/3);if(lift===0)dronePhase='off';}
  const aerial=lift*lift*(3-2*lift);
  state.dronePhase=dronePhase;
  if(inertia){
    if(reduced.matches)inertia=0;
    move(inertia*(1-Math.exp(-2.4*dt))/2.4);
    inertia*=Math.exp(-2.4*dt);
    if(Math.abs(inertia)<.1||state.target===0||state.target===state.length)inertia=0;
  }
  const difference=state.target-state.distance;
  state.distance=reduced.matches?state.target:state.distance+difference*(1-Math.exp(-dt*7));
  if(Math.abs(state.target-state.distance)<.001)state.distance=state.target;
  state.activeWishSeq=wishDisplay.update(state.distance,wishesVisible&&lift===0);
  pointAtDistance(state.distance,eye).add(eyeOffset);
  pointAtDistance(state.distance+4,look).add(eyeOffset);
  const arrival=THREE.MathUtils.smoothstep(state.distance,state.length-22,state.length);
  look.lerp(hallFocus,arrival);
  // Open the portrait framing enough to keep both roof tips visible at arrival.
  const viewFov=innerWidth<650?THREE.MathUtils.lerp(74,80,arrival):THREE.MathUtils.lerp(62,58,arrival);
  if(Math.abs(camera.fov-viewFov)>.001){camera.fov=viewFov;camera.updateProjectionMatrix();}
  const farPlane=lift>0?3000:650;if(camera.far!==farPlane){camera.far=farPlane;camera.updateProjectionMatrix();}
  const tanV=Math.tan(THREE.MathUtils.degToRad(viewFov/2)),tanH=tanV*camera.aspect;
  const overviewDistance=Math.max(...overviewCorners.map(p=>p.dot(overviewDirection)+Math.max(Math.abs(p.dot(overviewRight))/tanH,Math.abs(p.dot(overviewUp))/tanV)))*1.2;
  const overviewEye=overviewCenter.clone().addScaledVector(overviewDirection,overviewDistance);
  eye.lerp(overviewEye,aerial);look.lerp(overviewCenter,aerial);
  scene.fog.density=THREE.MathUtils.lerp(.024,.0006,aerial);
  camera.position.copy(eye);
  camera.lookAt(look);
  // The hall alone ignores the shared fog. It emerges over a short distance band.
  const hallDistance=camera.position.distanceTo(hall.position);
  const reveal=Math.max(aerial,1-THREE.MathUtils.smoothstep(hallDistance,84,94));
  hall.visible=reveal>.001;
  for(const entry of hallMaterials)entry.material.color.copy(scene.background).lerp(entry.color,reveal);
  // Surface illumination follows body visibility only; lamp strength stays constant.
  hallLightReveal.value=reveal;
  state.hondenLightIntensity=1;
  state.hondenReveal=reveal;
  fireMaterial.uniforms.time.value=now/1000;
  fireMaterial.uniforms.still.value=Number(reduced.matches);
  for(const fire of torchFlames)fire.quaternion.copy(camera.quaternion);
  camera.updateMatrixWorld();
  const arrived=state.distance>state.length-1&&lift===0&&dronePhase==='off';
  document.querySelector('#participate').hidden=!arrived;
  document.body.classList.toggle('arrived',arrived);
  if(arrived){
    promptScreen.copy(promptAnchor).project(camera);
    document.querySelector('#participate').style.left=(promptScreen.x*.5+.5)*100+'%';
    const card=document.querySelector('#participate');
    if(innerWidth<650){
      const wish=document.querySelector('#gate-wish');
      const lowerEdge=(wish.hidden?document.querySelector('footer'):wish).getBoundingClientRect().top;
      card.style.top=Math.min(innerHeight*.74,lowerEdge-18-card.offsetHeight/2)+'px';
    }else{
      card.style.top=THREE.MathUtils.clamp((.5-promptScreen.y*.5)*100,40,43)+'%';
    }
  }
  state.cameraPosition=camera.position.toArray();
  state.cameraDirection=camera.getWorldDirection(direction).toArray();
  renderer.setRenderTarget(target);renderer.render(scene,camera);
  const background=scene.background;scene.background=null;
  renderer.setRenderTarget(flameTarget);renderer.setClearColor(0x000000,0);renderer.clear();
  renderer.autoClear=false;scene.overrideMaterial=occlusionMaterial;renderer.render(scene,camera);
  scene.overrideMaterial=null;camera.layers.set(1);renderer.render(scene,camera);
  camera.layers.set(0);renderer.autoClear=true;scene.background=background;renderer.setClearColor(palette.background,1);
  renderer.setRenderTarget(null);renderer.render(screenScene,screenCamera);
  const percentage=100*state.distance/state.length;
  document.querySelector('#distance').textContent=String(Math.round(state.distance)).padStart(3,'0')+' / '+Math.round(state.length)+' m';
  document.querySelector('#progress>div').style.width=percentage+'%';
  document.querySelector('#progress').setAttribute('aria-valuenow',String(Math.round(percentage)));
  document.body.classList.toggle('moving',state.distance>1);
  if(!state.ready){state.ready=true;status.hidden=true;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
} catch(error){console.error(error);status.hidden=false;status.textContent='Unable to start the 3D view. Please use a browser with WebGL 2 enabled.';}




