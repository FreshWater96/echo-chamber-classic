import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ROOMS,RADIO} from './logic.js';

export const echo={origin:{value:new THREE.Vector3()},age:{value:100},color:{value:new THREE.Color('#66aeb4')}};
const assets='./assets/';
const texLoader=new THREE.TextureLoader();
const geom=new Map();
const seeded=n=>{let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function geo(key,make){if(!geom.has(key))geom.set(key,make());return geom.get(key);}
function echoMaterial(m){
 if(!m.isMeshStandardMaterial)return m;
 m.onBeforeCompile=shader=>{
  shader.uniforms.echoOrigin=echo.origin;shader.uniforms.echoAge=echo.age;shader.uniforms.echoColor=echo.color;
  shader.vertexShader='varying vec3 echoWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nechoWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 echoWorld; uniform vec3 echoOrigin; uniform float echoAge; uniform vec3 echoColor;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat ed=distance(echoWorld.xz,echoOrigin.xz);float er=echoAge*6.8;float ef=max(0.0,1.0-echoAge/4.0);float ew=exp(-pow((ed-er)*2.2,2.0));float ei=1.0-smoothstep(er-.35,er+.35,ed);totalEmissiveRadiance+=echoColor*(ew*.7+ei*.055)*ef;');
 };
 m.customProgramCacheKey=()=> 'echo-material-2';
 return m;
}
function material(color,props={}){return echoMaterial(new THREE.MeshStandardMaterial({color,roughness:.85,...props}));}
function canvasTexture(w,h,draw){
 const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function repeat(t,x,y){if(!t)return null;const c=t.clone();c.wrapS=c.wrapT=THREE.RepeatWrapping;c.repeat.set(x,y);c.needsUpdate=true;return c;}
export async function loadMaterials(progress=()=>{}){
 const names=['wall-diff.jpg','wall-normal.jpg','wall-rough.jpg','floor-diff.jpg','floor-normal.jpg','floor-rough.jpg'];
 const result=await Promise.all(names.map(async(name,i)=>{
  try{const t=await texLoader.loadAsync(assets+name);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(name.includes('diff'))t.colorSpace=THREE.SRGBColorSpace;progress(i+1,names.length);return t;}catch{progress(i+1,names.length);return null;}
 }));
 const [wall,wallN,wallR,floor,floorN,floorR]=result;
 const tile=canvasTexture(512,512,(c,w,h)=>{
  c.fillStyle='#666b60';c.fillRect(0,0,w,h);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){let a=85+seeded(x+y*4)*23;c.fillStyle='rgb('+a+','+(a+5)+','+(a-3)+')';c.fillRect(x*128+2,y*128+2,124,124);}
  for(let i=0;i<7000;i++){let x=seeded(i)*w,y=seeded(i+10000)*h;c.fillStyle='rgba(8,16,11,'+(seeded(i+20000)*.12)+')';c.fillRect(x,y,1+seeded(i+30000)*5,1);}
 });
 const paper=canvasTexture(512,512,(c,w,h)=>{
  c.fillStyle='#a69b78';c.fillRect(0,0,w,h);c.strokeStyle='#4e584b';c.lineWidth=1;
  for(let x=30;x<480;x+=21){c.beginPath();c.moveTo(x,70);c.lineTo(x,450);c.stroke();}
  for(let y=70;y<451;y+=21){c.beginPath();c.moveTo(30,y);c.lineTo(480,y);c.stroke();}
  c.fillStyle='#37443d';c.font='bold 20px serif';c.fillText('BLACKWELL RESEARCH',35,36);c.font='12px monospace';c.fillText('EC-01 / ACOUSTIC RESPONSE',35,57);
  c.strokeStyle='#613c31';c.lineWidth=3;c.beginPath();c.moveTo(30,275);
  for(let x=30;x<480;x+=2)c.lineTo(x,270+Math.sin(x*.065)*Math.sin(x*.009)*70+seeded(x)*15);c.stroke();
  c.strokeStyle='#726d51';c.lineWidth=1;c.strokeRect(20,20,472,470);c.font='10px monospace';c.fillText('DO NOT TRANSMIT BEYOND 75 Hz',35,478);
  for(let i=0;i<300;i++){c.fillStyle='rgba(47,40,23,'+(seeded(i+6)*.12)+')';c.beginPath();c.arc(seeded(i)*512,seeded(i+7)*512,seeded(i+8)*7,0,Math.PI*2);c.fill();}
 });
 const stain=canvasTexture(256,512,(c,w,h)=>{
  for(let i=0;i<75;i++){let x=seeded(i)*w,l=100+seeded(i+70)*h;c.fillStyle='rgba(20,26,18,'+(.05+seeded(i+5)*.09)+')';c.fillRect(x,0,1+seeded(i+9)*11,l);}
 });
 return {wall,wallN,wallR,floor,floorN,floorR,tile,paper,stain};
}
export function makePalette(t,theme,width){
 const cool=theme==='cryo'||theme==='airlock';
 const p={
  wall:material(cool?'#858f88':'#a0a18a',{map:repeat(t.wall,width/3.3,1.3),normalMap:repeat(t.wallN,width/3.3,1.3),normalScale:new THREE.Vector2(.5,.5),roughnessMap:repeat(t.wallR,width/3.3,1.3)}),
  wood:material('#65523c',{map:repeat(t.floor,2,1.2),normalMap:repeat(t.floorN,2,1.2),normalScale:new THREE.Vector2(.35,.35),roughnessMap:repeat(t.floorR,2,1.2)}),
  floor:material('#b7ac8c',{map:repeat(t.floor,width/3.4,2),normalMap:repeat(t.floorN,width/3.4,2),normalScale:new THREE.Vector2(.65,.65),roughnessMap:repeat(t.floorR,width/3.4,2),roughness:.68}),
  tile:material('#8c9384',{map:repeat(t.tile,width/4,1.7),roughness:.63,metalness:.07}),
  green:material(cool?'#485955':'#4b5549',{map:repeat(t.wall,1,1),normalMap:t.wallN,normalScale:new THREE.Vector2(.15,.15),roughness:.72,metalness:.25}),
  iron:material('#293331',{roughness:.55,metalness:.72}),
  dark:material('#151d1d',{roughness:.9}),
  brass:material('#a78d50',{metalness:.76,roughness:.4}),
  cloth:material('#a9aa93',{roughness:1,map:t.wall}),
  pale:material('#b4b4a0',{roughness:.89}),
  red:material('#57342d',{roughness:.85}),
  glass:new THREE.MeshStandardMaterial({color:'#79918c',transparent:true,opacity:.15,roughness:.17,metalness:.1,depthWrite:false}),
  liquid:material('#46594b',{roughness:.3,metalness:.2}),
  paper:material('#d7c69f',{map:t.paper,side:THREE.DoubleSide,roughness:1}),
  glow:new THREE.MeshStandardMaterial({color:'#d5c397',emissive:'#e8b36a',emissiveIntensity:1.7,roughness:.4}),
  coolGlow:new THREE.MeshStandardMaterial({color:'#9eb6af',emissive:'#81c5d2',emissiveIntensity:1.4,roughness:.4}),
  stain:new THREE.MeshBasicMaterial({map:t.stain,transparent:true,depthWrite:false,side:THREE.DoubleSide})
 };
 return p;
}
function mesh(parent,g,m,x=0,y=0,z=0){
 const a=new THREE.Mesh(g,m);a.position.set(x,y,z);a.castShadow=!m.transparent;a.receiveShadow=true;parent.add(a);return a;
}
function box(p,m,x,y,z,w,h,d,r=.015){
 return mesh(p,geo('b'+[w,h,d,r].join(','),()=>r?new RoundedBoxGeometry(w,h,d,1,r):new THREE.BoxGeometry(w,h,d)),m,x,y,z);
}
function cylinder(p,m,x,y,z,rt,rb,h,segments=12){
 return mesh(p,geo('c'+[rt,rb,h,segments].join(','),()=>new THREE.CylinderGeometry(rt,rb,h,segments)),m,x,y,z);
}
function sphere(p,m,x,y,z,r,sx=1,sy=1,sz=1){
 const a=mesh(p,geo('s'+r,()=>new THREE.SphereGeometry(r,16,12)),m,x,y,z);a.scale.set(sx,sy,sz);return a;
}
function tube(p,m,pts,r=.035){
 const curve=new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v)));
 return mesh(p,new THREE.TubeGeometry(curve,Math.max(6,pts.length*6),r,8,false),m);
}
function rod(p,m,a,b,r=.025){
 const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);
 const o=cylinder(p,m,...av.clone().add(bv).multiplyScalar(.5).toArray(),r,r,v.length(),8);
 o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;
}
function torus(p,m,x,y,z,r,t=.025){
 return mesh(p,geo('t'+r+','+t,()=>new THREE.TorusGeometry(r,t,8,24)),m,x,y,z);
}
function group(p,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g;}
function sign(p,text,x,y,z,width=1.7){
 const texture=canvasTexture(512,128,(c,w,h)=>{
  c.fillStyle='#272f29';c.fillRect(0,0,w,h);c.strokeStyle='#9c8f69';c.lineWidth=3;c.strokeRect(8,8,w-16,h-16);
  c.fillStyle='#bdb79e';c.font=(text.length>22?'21':'26')+'px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(text.toUpperCase(),w/2,h/2);
 });
 box(p,material('#313b32'),x,y,z-.015,width+.08,.46,.05,.01);
 const s=mesh(p,new THREE.PlaneGeometry(width,.37),new THREE.MeshBasicMaterial({map:texture,color:'#b8b4a3'}),x,y,z+.018);s.castShadow=false;
}
function bottle(p,m,x,y,z,scale=1,seed=0){
 const g=group(p,x,y,z);g.scale.setScalar(scale);
 const points=[[0,.03],[.12,.03],[.14,.10],[.14,.39],[.08,.47],[.055,.50],[.055,.58],[0,.58]].map(v=>new THREE.Vector2(v[0],v[1]));
 mesh(g,geo('bottle',()=>new THREE.LatheGeometry(points,12)),m.glass);
 cylinder(g,seed%3?m.liquid:m.red,0,.23,0,.115,.115,.34);cylinder(g,m.brass,0,.59,0,.065,.065,.055);
 box(g,m.paper,0,.31,.122,.12,.14,.006,.001);return g;
}
function books(p,m,x,y,z,w=1.4,seed=1){
 for(let i=0;i<Math.floor(w/.16);i++){
  const h=.32+seeded(i+seed)*.23,c=[m.wood,m.green,m.dark,m.red][Math.floor(seeded(i+seed+2)*4)];
  const b=box(p,c,x+i*.16,y+h/2,z,.13,h,.24,.006);b.rotation.z=(seeded(i+3)*.06-.03);
  box(p,m.brass,x+i*.16,y+h*.25,z+.126,.075,.008,.005,.001);
 }
}
function cabinet(p,m,x,z,w=1.65,h=2.5,seed=0){
 const g=group(p,x,0,z);
 box(g,m.wood,0,h/2,0,w,h,.6,.025);box(g,m.dark,0,h*.60,.315,w-.17,h*.59,.035,.002);
 for(const xx of [-w/2+.075,w/2-.075,0])box(g,m.wood,xx,h*.62,.39,.055,h*.67,.09,.012);
 for(const yy of [h*.29,h*.55,h*.78,h*.96])box(g,m.wood,0,yy,.29,w-.09,.048,.66,.01);
 for(let i=0;i<2;i++){
  const xx=(i?1:-1)*w*.25;
  box(g,m.green,xx,h*.14,.34,w*.46,h*.24,.05,.008);
  torus(g,m.brass,xx,h*.22,.39,.035,.009);
  mesh(g,new THREE.PlaneGeometry(w*.45,h*.60),m.glass,xx,h*.63,.438);
 }
 box(g,m.wood,0,h+.035,.01,w+.14,.10,.75,.02);box(g,m.wood,0,.08,.01,w+.1,.14,.7,.02);
 for(const y of [h*.31,h*.57]){
  books(g,m,-w*.4,y,.18,w*.52,seed+y*10);
  bottle(g,m,w*.27,y,.15,.52+seeded(seed+y)*.25,seed);
 }
 for(const xx of [-w*.4,w*.4]){const leg=box(g,m.wood,xx,.08,.08,.085,.3,.085,.025);leg.rotation.z=xx>0?-.09:.09;}
 return g;
}
function labDesk(p,m,x,z,w=2.7){
 const g=group(p,x,0,z);box(g,m.wood,0,.9,0,w,.14,.9,.025);
 for(const xx of [-w*.42,w*.42])for(const zz of [-.33,.33])rod(g,m.iron,[xx,0,zz],[xx,.84,zz],.035);
 for(const xx of [-w*.26,w*.26]){box(g,m.green,xx,.72,-.01,w*.40,.21,.78,.02);tube(g,m.brass,[[xx-.13,.74,.4],[xx-.13,.68,.45],[xx+.13,.68,.45],[xx+.13,.74,.4]],.015);}
 for(let i=0;i<3;i++)bottle(g,m,-w*.25+i*.25,.99,-.1,.55,i);
 const paper=mesh(g,new THREE.PlaneGeometry(.55,.4),m.paper,.3,.982,.06);paper.rotation.x=-Math.PI/2;paper.rotation.z=.13;
 return g;
}
function stool(p,m,x,z){
 const g=group(p,x,0,z);cylinder(g,m.wood,0,.53,0,.27,.27,.08,16);
 for(let i=0;i<3;i++){let a=i*Math.PI*2/3;rod(g,m.iron,[Math.sin(a)*.27,0,Math.cos(a)*.27],[Math.sin(a)*.17,.5,Math.cos(a)*.17],.022);}
 return g;
}
function locker(p,m,x,z){
 const g=group(p,x,0,z);box(g,m.green,0,1.2,0,1.2,2.4,.7,.03);box(g,m.iron,0,.09,0,1.3,.14,.78,.02);
 for(const xx of [-.3,.3]){
  box(g,m.green,xx,1.25,.37,.55,2.18,.035,.015);
  for(let j=0;j<5;j++)box(g,m.dark,xx,2.02-j*.07,.396,.31,.018,.008,.003);
  box(g,m.brass,xx+.17,1.17,.42,.025,.16,.035,.009);
  box(g,m.pale,xx,1.78,.398,.15,.07,.006,.001);
 }
 return g;
}
function bed(p,m,x,z,covered=false){
 const g=group(p,x,0,z);
 for(const xx of [-1.05,1.05])for(const zz of [-.39,.39]){
  cylinder(g,m.iron,xx,.38,zz,.027,.027,.58,10);
  const wheel=torus(g,m.dark,xx,.12,zz,.10,.035);wheel.rotation.y=Math.PI/2;
 }
 box(g,m.iron,0,.57,0,2.36,.09,.97,.02);box(g,m.cloth,0,.72,0,2.25,.22,.88,.065);
 box(g,m.cloth,-.78,.86,0,.45,.13,.70,.055);
 for(const xx of [-1.15,1.15])tube(g,m.iron,[[xx,.63,-.46],[xx,1.18,-.46],[xx,1.25,.46],[xx,.63,.46]],.028);
 if(covered){
  const cloth=new THREE.PlaneGeometry(1.7,1.7,12,12);const a=cloth.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);a.setZ(i,.26*Math.exp(-x*x*2-y*y*4)+Math.sin(x*12+y*4)*.035);}
  cloth.computeVertexNormals();const sheet=mesh(g,cloth,m.cloth,.15,.88,0);sheet.rotation.x=-Math.PI/2;
 }
 return g;
}
function bench(p,m,x,z,w=2.8){
 const g=group(p,x,0,z);
 for(let i=0;i<4;i++)box(g,m.wood,0,.48,-.23+i*.15,w,.08,.10,.013);
 for(const xx of [-w*.38,w*.38]){
  rod(g,m.iron,[xx,.05,-.25],[xx,.55,-.25],.025);rod(g,m.iron,[xx,.05,.25],[xx,.55,.25],.025);
  rod(g,m.iron,[xx,.4,-.29],[xx,1.14,-.43],.025);
 }
 for(let i=0;i<3;i++)box(g,m.wood,0,.73+i*.15,-.37,w,.105,.06,.01);
 return g;
}
function radiator(p,m,x,z){
 const g=group(p,x,0,z);
 for(let i=0;i<10;i++){const xx=(i-4.5)*.105;box(g,m.green,xx,.48,0,.075,.69,.17,.035);}
 for(const y of [.19,.74])rod(g,m.iron,[-.56,y,0],[.56,y,0],.045);
 rod(g,m.iron,[.55,.19,0],[.65,.19,-.15],.03);const v=torus(g,m.brass,.66,.19,-.13,.075,.015);v.rotation.y=Math.PI/2;
}
function hangingLamp(p,m,x,y,z,cool=false){
 const g=group(p,x,y,z);
 rod(g,m.iron,[0,.7,0],[0,0,0],.015);cylinder(g,m.iron,0,-.08,0,.09,.28,.18,20);
 cylinder(g,cool?m.coolGlow:m.glow,0,-.19,0,.19,.19,.012,20);
 const light=new THREE.PointLight(cool?'#94c6cb':'#f2bb76',cool?16:19,11,2);light.position.set(0,-.30,.1);g.add(light);
 const cone=mesh(g,new THREE.ConeGeometry(1.2,2.8,28,1,true),new THREE.MeshBasicMaterial({color:cool?'#9cc9c8':'#dcc391',transparent:true,opacity:.016,side:THREE.DoubleSide,depthWrite:false}),0,-1.6,.05);
 cone.castShadow=false;cone.receiveShadow=false;
 return light;
}
function door(p,m,d){
 const x=d.x,z=-2.48;
 box(p,m.dark,x,1.35,z+.04,1.55,2.7,.13,.015);
 for(const xx of [-.83,.83])box(p,m.wood,x+xx,1.4,z+.20,.15,2.8,.18,.018);
 box(p,m.wood,x,2.85,z+.2,1.86,.17,.20,.02);
 box(p,m.green,x,1.37,z+.17,1.43,2.58,.08,.02);
 for(const yy of [.55,1.6]){box(p,m.wood,x,yy,z+.235,1.12,.7,.035,.015);box(p,m.green,x,yy,z+.26,1.00,.58,.02,.01);}
 const window=mesh(p,new THREE.CircleGeometry(.19,28),m.glass,x,2.17,z+.29);const rim=torus(p,m.brass,x,2.17,z+.30,.21,.025);
 box(p,m.brass,x+.49,1.16,z+.32,.055,.19,.055,.012);rod(p,m.brass,[x+.49,1.19,z+.35],[x+.29,1.19,z+.35],.017);
 sign(p,ROOMS[d.to].name,x,3.12,z+.2,1.82);
 for(const yy of [.30,2.40])box(p,m.iron,x-.68,yy,z+.3,.12,.18,.04,.01);
 return {window,rim};
}
function clock(p,m,x,y,z){
 cylinder(p,m.wood,x,y,z,.31,.31,.09,32).rotation.x=Math.PI/2;
 const face=mesh(p,new THREE.CircleGeometry(.27,32),m.pale,x,y,z+.052);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;rod(p,m.dark,[x+Math.sin(a)*.21,y+Math.cos(a)*.21,z+.061],[x+Math.sin(a)*.24,y+Math.cos(a)*.24,z+.061],.006);}
 rod(p,m.dark,[x,y,z+.067],[x-.04,y+.16,z+.067],.008);rod(p,m.dark,[x,y,z+.069],[x+.16,y-.07,z+.069],.005);
}
function chart(p,m,x,y,z,w=1.1,h=1.5){
 box(p,m.wood,x,y,z,w+.13,h+.13,.06,.02);
 mesh(p,new THREE.PlaneGeometry(w,h),m.paper,x,y,z+.034);
}
function valve(p,m,x,y,z){
 rod(p,m.iron,[x,y-1,z],[x,y+1,z],.08);
 const v=torus(p,m.red,x,y,z+.12,.22,.023);
 for(let i=0;i<4;i++){const a=i*Math.PI/2;rod(p,m.red,[x,y,z+.12],[x+Math.sin(a)*.2,y+Math.cos(a)*.2,z+.12],.015);}
 cylinder(p,m.iron,x,y,z+.03,.12,.12,.14).rotation.x=Math.PI/2;
 return v;
}
function tank(p,m,x,z){
 const g=group(p,x,0,z);
 cylinder(g,m.iron,0,.2,0,.7,.78,.25,28);cylinder(g,m.iron,0,2.65,0,.73,.67,.25,28);
 cylinder(g,m.glass,0,1.4,0,.65,.65,2.3,32);
 for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])rod(g,m.iron,[Math.sin(a)*.67,.3,Math.cos(a)*.67],[Math.sin(a)*.67,2.6,Math.cos(a)*.67],.045);
 sphere(g,m.liquid,0,1.45,0,.36,.8,1.6,.8);
 for(let i=0;i<5;i++){const a=i*1.4;tube(g,m.liquid,[[0,1.2,0],[Math.sin(a)*.3,.8,Math.cos(a)*.3],[Math.sin(a)*.4,.5,Math.cos(a)*.4]],.045);}
 for(const y of [.4,2.4]){const r=torus(g,m.iron,0,y,0,.67,.035);r.rotation.x=Math.PI/2;}
 tube(g,m.iron,[[.65,.3,0],[.95,.3,0],[1.1,.8,-.4],[1.1,2.8,-.7]],.06);
 const light=new THREE.PointLight('#81a8a3',3,3,2);light.position.set(0,1.3,.1);g.add(light);
}
function curtain(p,m,x,z){
 const g=group(p,x,0,z),geo=new THREE.PlaneGeometry(2.7,2.75,32,12),a=geo.attributes.position;
 for(let i=0;i<a.count;i++){const xx=a.getX(i),yy=a.getY(i);a.setZ(i,Math.sin(xx*13)*.065+Math.sin(xx*5)*.035);a.setY(i,yy-(1-Math.abs(xx)/1.35)*.07);}
 geo.computeVertexNormals();const c=mesh(g,geo,m.cloth,0,1.88,0);c.material=c.material.clone();c.material.side=THREE.DoubleSide;
 rod(g,m.iron,[-1.5,3.35,0],[1.5,3.35,0],.022);
 for(let i=0;i<12;i++){const ring=torus(g,m.brass,-1.22+i*.222,3.3,0,.037,.008);ring.rotation.y=Math.PI/2;}
 return g;
}
function surgicalLamp(p,m,x,z){
 const g=group(p,x,0,z);cylinder(g,m.iron,0,.15,0,.4,.48,.12,20);
 tube(g,m.iron,[[0,.2,0],[0,2.7,0],[.3,3.1,0],[1.3,2.9,0]],.045);
 const head=cylinder(g,m.green,1.3,2.72,0,.22,.53,.22,24);
 cylinder(g,m.coolGlow,1.3,2.59,0,.44,.44,.025,24);
 const light=new THREE.SpotLight('#9bc9c2',18,7,Math.PI/4,.65,2);light.position.set(1.3,2.55,0);light.target.position.set(1.3,0,0);g.add(light,light.target);
}
function dust(p,width){
 const count=130,positions=new Float32Array(count*3);
 for(let i=0;i<count;i++){positions[i*3]=(seeded(i+20)-.5)*width;positions[i*3+1]=seeded(i+200)*4;positions[i*3+2]=(seeded(i+400)-.5)*5;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const d=new THREE.Points(g,new THREE.PointsMaterial({color:'#c8c9ac',size:.018,transparent:true,opacity:.23,depthWrite:false,sizeAttenuation:true}));p.add(d);return d;
}
function batchStatics(root){
 const buckets=new Map(),originals=[];
 root.updateMatrixWorld(true);
 root.traverse(o=>{
  if(!o.isMesh||Array.isArray(o.material)||o.material.transparent)return;
  let current=o;while(current){if(current.userData.dynamic)return;current=current.parent;}
  const key=o.material.uuid;
  if(!buckets.has(key))buckets.set(key,{material:o.material,geometries:[]});
  let g=o.geometry.clone();if(g.index)g=g.toNonIndexed();g.applyMatrix4(o.matrixWorld);
  // All generated environment meshes use the same normal/UV attribute set.
  for(const attr of Object.keys(g.attributes))if(!['position','normal','uv'].includes(attr))g.deleteAttribute(attr);
  buckets.get(key).geometries.push(g);originals.push(o);
 });
 for(const o of originals)o.removeFromParent();
 const edgeMaterial=new THREE.ShaderMaterial({
  uniforms:{echoOrigin:echo.origin,echoAge:echo.age,echoColor:echo.color},
  vertexShader:'varying vec3 wpos;void main(){vec4 w=modelMatrix*vec4(position,1.0);wpos=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:'varying vec3 wpos;uniform vec3 echoOrigin;uniform float echoAge;uniform vec3 echoColor;void main(){float d=distance(wpos.xz,echoOrigin.xz);float r=echoAge*6.8;float f=max(0.0,1.0-echoAge/4.0);float front=exp(-pow((d-r)*2.8,2.0));float inside=1.0-smoothstep(r-.3,r+.3,d);float a=(front*1.6+inside*.35)*f;if(a<.012)discard;gl_FragColor=vec4(echoColor,a);}',
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false
 });
 for(const b of buckets.values()){
  const merged=mergeGeometries(b.geometries,false);if(!merged)continue;
  const mesh=new THREE.Mesh(merged,b.material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  if(b.material.isMeshStandardMaterial){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(merged,48),edgeMaterial);root.add(edges);}
  b.geometries.forEach(g=>g.dispose());
 }
}
export function buildRoom(id,textures){
 const config=ROOMS[id],w=config.width,m=makePalette(textures,config.theme,w),root=new THREE.Group();root.name='room-'+id;
 const floorMat=['cryo','containment','airlock'].includes(id)?m.tile:m.floor;
 box(root,m.dark,0,-.22,0,w+.6,.4,6.2,.015);
 const floor=mesh(root,new THREE.PlaneGeometry(w,6),floorMat,0,.002,0);floor.rotation.x=-Math.PI/2;
 box(root,m.wall,0,2.12,-2.84,w,4.24,.23,.005);
 box(root,m.wood,0,.58,-2.66,w,1.12,.15,.01);
 for(const y of [.12,1.12,1.19,3.95,4.05])box(root,m.wood,0,y,-2.5,w,.055,.19,.01);
 for(let x=-w/2+.7;x<w/2;x+=1.6){
  box(root,m.wood,x,.6,-2.55,.035,.95,.04,.006);
  box(root,m.wood,x+.72,.63,-2.535,1.25,.035,.04,.004);
 }
 for(const side of [-1,1]){
  box(root,m.wall,side*w/2,2.1,-1.5,.28,4.2,2.5,.01);
  box(root,m.dark,side*(w/2-.1),2.0,2.4,.46,4.1,.42,.015);
  box(root,m.wood,side*(w/2-.1),.15,2.4,.64,.3,.6,.02);
 }
 box(root,m.dark,0,4.2,-1,w,.3,3.9,.01);
 for(let i=0;i<3;i++){
  const yy=3.46+i*.15;rod(root,i===2?m.brass:m.iron,[-w/2,yy,-2.26],[w/2,yy,-2.26],i===2?.025:.055);
 }
 for(const x of [-w*.35,w*.35]){
  rod(root,m.iron,[x,0,-2.35],[x,3.8,-2.35],.07);valve(root,m,x,.85,-2.26);
 }
 config.doors.forEach(d=>door(root,m,d));
 config.lockers.forEach(l=>locker(root,m,l.x,-1.85));
 const lamps=[hangingLamp(root,m,-w*.28,3.75,-.65,id==='cryo'),hangingLamp(root,m,w*.27,3.75,-.65,id==='cryo'||id==='airlock')];
 const middle=new THREE.SpotLight(id==='cryo'?'#a9d5d6':'#ead5b5',28,12,Math.PI/3,.85,2);middle.position.set(0,3.8,1.6);middle.target.position.set(0,.1,-1);middle.castShadow=true;middle.shadow.mapSize.set(1024,1024);middle.shadow.bias=-.0002;middle.shadow.normalBias=.025;root.add(middle,middle.target);lamps.push(middle);
 clock(root,m,1.5,2.65,-2.51);
 sign(root,id==='containment'?'EC-01 / SILENCE PROTOCOL':'BLACKWELL / SECTOR IV',-1.5,3.57,-2.49,2.9);
 for(let i=0;i<4;i++){
  const x=(seeded(i+id.length*7)-.5)*(w-3);
  mesh(root,new THREE.PlaneGeometry(.7+seeded(i+40)*1.5,2.4),m.stain,x,2.1,-2.48);
 }
 for(let i=0;i<12;i++){
  const x=(seeded(i+11)-.5)*(w-2),z=(seeded(i+23)-.5)*4.4;
  const paper=mesh(root,new THREE.PlaneGeometry(.23+seeded(i+40)*.28,.32),m.paper,x,.012,z);paper.rotation.x=-Math.PI/2;paper.rotation.z=seeded(i+45)*5;
 }
 for(let i=0;i<3;i++){
  const puddle=mesh(root,new THREE.CircleGeometry(.55+seeded(i+53)*.5,24),new THREE.MeshStandardMaterial({color:'#1e2d2b',roughness:.12,metalness:.65,transparent:true,opacity:.4,depthWrite:false}),(seeded(i+60)-.5)*(w-3),.011,(seeded(i+80)-.5)*2);
  puddle.rotation.x=-Math.PI/2;puddle.scale.y=.3+seeded(i+90)*.3;
 }
 if(id==='intake'){
  bench(root,m,-7,-1.8,2.8);labDesk(root,m,4.4,-1.9,3);stool(root,m,3.8,-.95);cabinet(root,m,7.6,-2.1,1.6,2.4,1);
  radiator(root,m,-1,-2.3);bed(root,m,-7.7,.9,true);chart(root,m,2.8,2.5,-2.46);chart(root,m,-6.6,2.5,-2.46,.9,1.25);
 }else if(id==='cryo'){
  for(const x of [-7.3,-3.7,0,.0+2.4])if(x!==-7.3)locker(root,m,x,-2.05);
  labDesk(root,m,-6.1,-1.15,2.5);tank(root,m,-1.8,-1.7);bed(root,m,2.1,.6,true);radiator(root,m,7,-2.3);chart(root,m,-5.5,2.5,-2.48);
  const mist=mesh(root,new THREE.PlaneGeometry(w,1.2),new THREE.MeshBasicMaterial({color:'#6d8c8a',transparent:true,opacity:.04,depthWrite:false}),0,.55,-.3);mist.rotation.x=-.1;
 }else if(id==='gallery'){
  bench(root,m,-7.5,-1.8,3.5);bench(root,m,8.9,-1.8,2.8);cabinet(root,m,-3.8,-2.1,1.8,2.7,2);
  for(const x of [-9.7,-6,-2.1,3.6,8.5])chart(root,m,x,2.5,-2.46,.8,1.3);
  radiator(root,m,4,-2.3);bed(root,m,-8.3,1.2,false);curtain(root,m,9.2,-1.35);
 }else if(id==='archive'){
  for(const x of [-7.5,-4.8,3.3,7.4])cabinet(root,m,x,-2.05,2.1,2.95,Math.floor(x*3));
  labDesk(root,m,6.1,-1.15,2.7);stool(root,m,5.7,-.2);labDesk(root,m,-5.8,-1.1,2.3);
  for(let i=0;i<5;i++)books(root,m,-2.7+i*.3,.08,1.4,.42,i+9);
  radiator(root,m,-1.7,-2.3);chart(root,m,1.6,2.65,-2.47,.8,1.25);
 }else if(id==='containment'){
  bed(root,m,0,-.2,true);surgicalLamp(root,m,-2.2,-1.45);tank(root,m,5.8,-1.95);tank(root,m,8.6,-1.95);
  labDesk(root,m,6.3,-1.1,2.2);curtain(root,m,-7,-1.5);chart(root,m,-3,2.4,-2.46);chart(root,m,3.1,2.5,-2.46);
  for(let i=0;i<13;i++)rod(root,m.iron,[-1.9+i*.32,.2,-2.3],[-1.9+i*.32,3.1,-2.3],.025);
  rod(root,m.iron,[-2,3.1,-2.3],[2,3.1,-2.3],.045);
  const emergency=new THREE.PointLight('#aa3d2d',8,9,2);emergency.position.set(6,3.15,-1.2);root.add(emergency);lamps.push(emergency);
 }else if(id==='airlock'){
  for(const x of [-4,-1,2])valve(root,m,x,1.65,-2.45);
  locker(root,m,-5.3,-1.9);labDesk(root,m,1,-1.9,2);
  const doorGroup=group(root,5.7,0,-2.25);
  box(doorGroup,m.iron,0,1.65,0,2.45,3.25,.24,.07);box(doorGroup,m.green,0,1.62,.15,2.12,2.94,.09,.04);
  for(const x of [-.7,.7])for(const y of [.4,2.8])cylinder(doorGroup,m.brass,x,y,.25,.07,.07,.05,8).rotation.x=Math.PI/2;
  torus(doorGroup,m.brass,0,1.62,.28,.4,.045);for(let i=0;i<6;i++){const a=i*Math.PI/3;rod(doorGroup,m.brass,[0,1.62,.28],[Math.sin(a)*.37,1.62+Math.cos(a)*.37,.28],.018);}
  sign(root,'EXTRACTION / LOCKED',5.7,3.55,-2.1,2.3);
 }
 // Foreground dressing moves faster than the distant wall under the perspective camera.
 for(const x of [-w*.37,w*.37]){
  box(root,m.dark,x,2.25,2.55,.24,4.5,.32,.035);
  tube(root,m.dark,[[x+.3,4.4,1.9],[x+.8,3.75,2.05],[x+.55,3,2.1],[x+.9,2.65,2.1]],.028);
 }
 if(config.key){
  const k=config.key;const tableIsPresent=['cryo','archive','containment'].includes(id);
  const kg=group(root,k.x,1.04,k.z);kg.userData.dynamic=true;
  const card=box(kg,material('#bda15c',{emissive:'#b8994e',emissiveIntensity:.45,metalness:.45,roughness:.36}),0,0,0,.24,.015,.15,.008);card.rotation.y=.25;
  box(kg,m.brass,.07,.012,0,.035,.008,.05,.001);
  const light=new THREE.PointLight('#d6a652',.65,1.6,2);light.position.y=.18;kg.add(light);root.userData.key=kg;
 }
 let radioLight=null;
 if(id===RADIO.room){
  const rg=group(root,RADIO.x,1.02,RADIO.z);rg.userData.dynamic=true;
  box(rg,m.green,0,.15,0,.55,.30,.22,.025);box(rg,m.dark,-.1,.15,.12,.25,.20,.012,.008);
  for(let i=0;i<5;i++)box(rg,m.brass,-.1,.08+i*.035,.13,.21,.005,.006,.002);
  cylinder(rg,m.brass,.16,.11,.13,.035,.035,.035).rotation.x=Math.PI/2;
  rod(rg,m.iron,[.19,.29,0],[.25,.69,-.02],.008);
  radioLight=new THREE.PointLight('#c8a55a',0,2,2);radioLight.position.set(0,.3,.2);rg.add(radioLight);
 }
 const dustPoints=dust(root,w);root.updateMatrixWorld(true);batchStatics(root);
 root.userData.materials=m;root.userData.lamps=lamps;root.userData.radioLight=radioLight;root.userData.dust=dustPoints;
 return root;
}
export function updateRoom(root,state,dt){
 const t=state.time||performance.now()/1000,active=state.playing;
 const lamps=root.userData.lamps||[];
 lamps.forEach((l,i)=>{if(!l.userData.base)l.userData.base=l.intensity;l.intensity=l.userData.base*(.97+Math.sin(t*2.7+i)*.017+Math.sin(t*19+i*5)*.013);});
 if(root.userData.key){root.userData.key.visible=!state.cards.has(ROOMS[state.room].key.id);root.userData.key.rotation.y=Math.sin(t*1.4)*.1;}
 if(root.userData.radioLight)root.userData.radioLight.intensity=state.time<state.radioUntil?2+Math.sin(t*35):0;
 if(root.userData.dust){const a=root.userData.dust.geometry.attributes.position;for(let i=0;i<a.count;i++){let y=a.getY(i)+dt*(.018+seeded(i)*.012);if(y>4)y=0;a.setY(i,y);}a.needsUpdate=true;}
}
export function createSonarRing(){
 const mat=new THREE.MeshBasicMaterial({color:'#75d1d7',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
 const ring=new THREE.Mesh(new THREE.RingGeometry(.99,1.012,96),mat);ring.rotation.x=-Math.PI/2;ring.position.y=.024;return ring;
}
