import * as THREE from 'three';
import {echo} from './world.js';
const loader=new THREE.TextureLoader();
function normalizeAtlas(image){
 const size=512,out=document.createElement('canvas');out.width=size*4;out.height=size*2;
 const outCtx=out.getContext('2d'),cell=document.createElement('canvas');cell.width=cell.height=size;const c=cell.getContext('2d',{willReadFrequently:true});
 const cw=image.width/4,ch=image.height/2;
 for(let f=0;f<8;f++){
  c.clearRect(0,0,size,size);c.drawImage(image,(f%4)*cw,Math.floor(f/4)*ch,cw,ch,0,0,size,size);
  const data=c.getImageData(0,0,size,size).data;let minX=size,minY=size,maxX=0,maxY=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data[(y*size+x)*4+3]>28){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  if(maxX<=minX)continue;
  const w=maxX-minX+1,h=maxY-minY+1,scale=Math.min(480/h,490/w);
  const dw=w*scale,dh=h*scale,dx=f%4*size+(size-dw)/2,dy=Math.floor(f/4)*size+size-dh-5;
  outCtx.drawImage(cell,minX,minY,w,h,dx,dy,dw,dh);
 }
 const t=new THREE.CanvasTexture(out);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=8;
 t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.repeat.set(.25,.5);return t;
}
export async function loadActors(){
 const [drifter,listener]=await Promise.all([loader.loadAsync('./assets/drifter-atlas.png'),loader.loadAsync('./assets/listener-atlas.png')]);
 return {drifter:normalizeAtlas(drifter.image),listener:normalizeAtlas(listener.image)};
}
function contactShadow(){
 const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,32,1,64,32,32);
 g.addColorStop(0,'rgba(0,0,0,.6)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.scale(2,1);ctx.fillStyle=g;ctx.fillRect(0,0,128,64);
 const t=new THREE.CanvasTexture(c),m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,opacity:.8});
 const s=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.65),m);s.rotation.x=-Math.PI/2;s.position.y=.025;return s;
}
export function createActor(texture,kind){
 const isMonster=kind==='listener',root=new THREE.Group(),height=isMonster?2.55:1.95;
 const map=texture.clone();map.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({map,color:isMonster?'#a1a99b':'#dad7c7',roughness:1,alphaTest:.16,side:THREE.DoubleSide,emissiveMap:map,emissive:'#5e6257',emissiveIntensity:isMonster?.12:.18,alphaToCoverage:true});
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(height,height),material);plane.position.y=height/2+.025;plane.castShadow=true;root.add(plane);
 plane.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map,alphaTest:.16});
 const shadow=contactShadow();if(isMonster)shadow.scale.set(1.6,1.2,1);root.add(shadow);
 const outlineMaterial=new THREE.ShaderMaterial({
  uniforms:{atlas:{value:map},frame:{value:new THREE.Vector2()},shade:{value:0},echoColor:echo.color},
  vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform sampler2D atlas;uniform vec2 frame;uniform float shade;uniform vec3 echoColor;varying vec2 uv0;void main(){vec2 uv=uv0*vec2(.25,.5)+frame;vec2 d=vec2(1.8/2048.0,1.8/1024.0);float a=texture2D(atlas,uv).a;float n=0.0;n=max(n,texture2D(atlas,uv+vec2(d.x,0.0)).a);n=max(n,texture2D(atlas,uv-vec2(d.x,0.0)).a);n=max(n,texture2D(atlas,uv+vec2(0.0,d.y)).a);n=max(n,texture2D(atlas,uv-vec2(0.0,d.y)).a);float edge=max(0.0,n-a);float v=(edge*.9+a*.04)*shade;if(v<.01)discard;gl_FragColor=vec4(echoColor,v);}',
  transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false
 });
 const outline=new THREE.Mesh(plane.geometry,outlineMaterial);outline.position.copy(plane.position);outline.position.z=.012;root.add(outline);
 root.userData={kind,height,map,plane,outline,frame:-1};return root;
}
export function updateActor(root,entity,time,moving,pulse,room,sneaking=false){
 const d=root.userData;root.position.set(entity.x,0,entity.z);root.visible=!entity.hidden;
 const frame=moving?Math.floor(time*(d.kind==='listener'?(entity.mode==='hunt'?10:6.5):sneaking?5.5:8.5))%8:0;
 if(frame!==d.frame){d.map.offset.set((frame%4)*.25,(1-Math.floor(frame/4))*.5);d.outline.material.uniforms.frame.value.copy(d.map.offset);d.frame=frame;}
 d.plane.scale.x=entity.facing||1;d.outline.scale.x=entity.facing||1;
 const crouch=sneaking?.87:1;d.plane.scale.y=THREE.MathUtils.lerp(d.plane.scale.y,crouch,.14);d.outline.scale.y=d.plane.scale.y;d.plane.position.y=d.height/2*d.plane.scale.y+.025;d.outline.position.y=d.plane.position.y;
 const breath=!moving?Math.sin(time*2.2)*.006:0;d.plane.position.y+=breath;d.outline.position.y+=breath;
 let reveal=0;
 if(pulse&&pulse.room===room){const age=time-pulse.time,dis=Math.hypot(entity.x-pulse.x,entity.z-pulse.z);if(age>=0&&age<4&&dis<age*6.8)reveal=(1-age/4)*1.1;}
 d.outline.material.uniforms.shade.value=reveal;
}
