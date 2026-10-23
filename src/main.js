import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ROOMS,createGame,start,update,pulse,radio,throwBottle,interact,context,clamp} from './logic.js';
import {loadMaterials,buildRoom,updateRoom,echo,createSonarRing} from './world.js';
import {loadActors,createActor,updateActor} from './actors.js';
import {Soundscape} from './audio.js';
const $=id=>document.getElementById(id),held=new Set(),sound=new Soundscape();
let state=createGame(),renderer,scene,camera,composer,bloom,film,hero,listener,light,enemyLight,ring,textures,actorArt;
let currentRoom=null,ready=false,lowQuality=false,lastTime=performance.now(),lastUI=0;
let toastTimer=null,roomTimer=null,gamepadLast=[];
const rooms=new Map();
const filmShader={
 uniforms:{tDiffuse:{value:null},time:{value:0},aspect:{value:1},pulseAge:{value:100},pulseUv:{value:new THREE.Vector2(.5,.5)},hide:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform sampler2D tDiffuse;uniform float time;uniform float aspect;uniform float pulseAge;uniform vec2 pulseUv;uniform float hide;varying vec2 vUv;float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec2 d=vUv-pulseUv;float dis=length(d*vec2(aspect,1.0));float radius=pulseAge*.21;float fade=max(0.0,1.0-pulseAge/4.0);float ring=exp(-pow((dis-radius)*58.0,2.0))*fade;vec2 ripple=normalize(d+vec2(.00001))*sin(dis*155.0-pulseAge*36.0)*ring*.0025;vec3 col=texture2D(tDiffuse,vUv+ripple).rgb;float l=dot(col,vec3(.2126,.7152,.0722));col=mix(col,vec3(l),.09);float vig=1.0-smoothstep(.18,.76,length((vUv-.5)*vec2(1.0,.9)))*(.43+hide*.16);col*=vig;float grain=(hash(vUv*vec2(1536.0,864.0)+floor(time*24.0))-.5)*.015;col+=grain;gl_FragColor=vec4(max(col,vec3(0.0)),1.0);}'
};
function message(text){
 $('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4300);
}
function flashRoom(){
 const r=ROOMS[state.room];$('room-flash').querySelector('h2').textContent=r.name;$('room-flash').classList.add('show');clearTimeout(roomTimer);roomTimer=setTimeout(()=>$('room-flash').classList.remove('show'),3100);
}
function switchRoom(id,fade=true){
 if(!rooms.has(id)){const g=buildRoom(id,textures);rooms.set(id,g);scene.add(g);}
 for(const [key,g] of rooms)g.visible=key===id;
 currentRoom=rooms.get(id);
 $('room-name').textContent=ROOMS[id].name;$('room-subtitle').textContent=ROOMS[id].subtitle;
 if(fade){const overlay=$('transition');overlay.style.transition='none';overlay.style.opacity='1';requestAnimationFrame(()=>{overlay.style.transition='opacity .35s';setTimeout(()=>{overlay.style.opacity='0';},100);});flashRoom();}
 if(camera){const max=Math.max(.5,ROOMS[id].width/2-6);camera.position.x=clamp(state.player.x,-max,max);}
}
function updateMap(){
 const list=$('map-rooms');list.innerHTML='';
 for(const [id,r] of Object.entries(ROOMS)){
  const el=document.createElement('div');el.className='map-room'+(state.visited.has(id)?' visited':'')+(state.room===id?' current':'');
  const known=state.visited.has(id),key=r.key;
  const b=document.createElement('b');b.textContent=known?r.name:'Unsurveyed sector';el.appendChild(b);
  const small=document.createElement('small');small.textContent=state.room===id?'YOU ARE HERE':known?'SURVEYED':'NO SIGNAL';el.appendChild(small);
  if(key&&known){const e=document.createElement('em');e.textContent=state.cards.has(key.id)?'Access card recovered':'Access authorization detected';el.appendChild(e);}
  if(r.exit&&known){const e=document.createElement('em');e.textContent=state.cards.size===3?'Extraction authorized':'Airlock locked';el.appendChild(e);}
  list.appendChild(el);
 }
}
function toggleMap(force){
 if(!ready||state.ended||!state.playing)return;
 const show=typeof force==='boolean'?force:$('map-screen').classList.contains('hidden');
 $('pause-screen').classList.add('hidden');$('map-screen').classList.toggle('hidden',!show);state.paused=show;held.clear();if(show)updateMap();
}
function pauseGame(force){
 if(!ready||state.ended||!state.playing)return;
 if(!$('map-screen').classList.contains('hidden')){toggleMap(false);return;}
 const paused=typeof force==='boolean'?force:!state.paused;state.paused=paused;$('pause-screen').classList.toggle('hidden',!paused);held.clear();
}
function startGame(){
 if(!ready)return;state=createGame();start(state);sound.init();held.clear();
 $('title-screen').classList.add('hidden');$('end-screen').classList.add('hidden');$('pause-screen').classList.add('hidden');$('map-screen').classList.add('hidden');
 $('hud').classList.remove('hidden');$('bottom-hud').classList.remove('hidden');$('mobile-controls').classList.remove('hidden');$('help-line').style.opacity='1';
 echo.age.value=100;ring.material.opacity=0;switchRoom('intake',true);refreshUI();
}
function showEnd(victory){
 $('end-screen').classList.remove('hidden');$('interaction').classList.add('hidden');$('threat').classList.add('hidden');
 $('end-eyebrow').textContent=victory?'EXTRACTION CONFIRMED':'SIGNAL LOST';
 $('end-title').textContent=victory?'The dark stays behind.':'The silence returns.';
 $('end-copy').textContent=victory?'The airlock seals. All three authorizations recovered. For the first time, nothing follows your footsteps.':'The Listener reached the source. Remember the rooms. Leave an echo somewhere else.';
 $('end-time').textContent=formatTime(state.survived);$('end-cards').textContent=state.cards.size+' / 3';$('end-pulses').textContent=String(state.pulses);
}
function formatTime(t){const s=Math.floor(t);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function consumeEvents(){
 const events=state.events.splice(0);
 for(const e of events){
  sound.event(e,state);
  if(e.type==='toast')message(e.text);
  if(e.type==='room')switchRoom(e.to,true);
  if(e.type==='card')refreshUI();
  if(e.type==='caught')showEnd(false);
  if(e.type==='win')showEnd(true);
  if(e.type==='throw')spawnVial(e);
  if(e.type==='pulse'){
   const pad=navigator.getGamepads?.()[0];if(pad?.vibrationActuator)pad.vibrationActuator.playEffect('dual-rumble',{duration:160,weakMagnitude:.35,strongMagnitude:.2}).catch(()=>{});
  }
 }
}
const thrown=[];
function spawnVial(e){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.16,8),new THREE.MeshStandardMaterial({color:'#b7c5b5',metalness:.3,roughness:.3}));
 mesh.position.set(e.from.x,1.1,e.from.z);scene.add(mesh);thrown.push({mesh,from:e.from,to:e.target,start:state.time,room:state.room});
}
function updateThrown(){
 for(let i=thrown.length-1;i>=0;i--){const v=thrown[i],t=(state.time-v.start)/.55;
  if(t>1||v.room!==state.room){scene.remove(v.mesh);v.mesh.geometry.dispose();v.mesh.material.dispose();thrown.splice(i,1);continue;}
  v.mesh.position.set(THREE.MathUtils.lerp(v.from.x,v.to.x,t),1.1*(1-t)+Math.sin(t*Math.PI)*1.1,THREE.MathUtils.lerp(v.from.z,v.to.z,t));v.mesh.rotation.z=t*15;
 }
}
function refreshUI(){
 const p=state.player,c=context(state);
 $('stamina').style.width=p.stamina+'%';
 $('state-label').textContent=p.hidden?'Holding your breath':p.sneaking?'Moving quietly':p.sprinting?'Footsteps carry through the walls':'Keep your footsteps quiet';
 document.querySelectorAll('#cards i').forEach(el=>el.classList.toggle('got',state.cards.has(el.dataset.key)));
 $('card-status').textContent=state.cards.size===3?'Reach the eastern airlock':state.cards.size+' of 3 access cards recovered';
 const remaining=Math.max(0,state.nextPulse-state.time);$('pulse-ready').textContent=remaining>0?remaining.toFixed(1)+' s':'SONAR';$('pulse-btn').classList.toggle('cooldown',remaining>0);
 $('bottle-count').textContent=state.bottles+' VIAL'+(state.bottles===1?'':'S');$('radio-count').textContent=state.radios+' CHARGE'+(state.radios===1?'':'S');
 const n=state.noise;$('resonance-fill').style.width=n+'%';$('resonance-fill').style.background=n>75?'#b5614b':n>40?'#c5a265':'#73aeb3';$('resonance-caption').textContent=n>75?'OVERLOAD · THE SIGNAL CARRIES':n>40?'RESONANCE IS BUILDING':'THE FACILITY IS LISTENING';
 if(c&&state.playing&&!state.paused){$('interaction').classList.remove('hidden');$('interaction').querySelector('span').textContent=c.label;}else $('interaction').classList.add('hidden');
 const same=state.monster.room===state.room,mode=state.monster.mode;
 const danger=same&&['hunt','lockon','search'].includes(mode)&&state.playing;
 $('threat').classList.toggle('hidden',!danger);$('threat').classList.toggle('hunt',mode==='hunt');
 $('threat').querySelector('span').textContent=p.hidden?'Do not breathe':mode==='lockon'?'It heard you':mode==='hunt'?'The Listener is hunting':'It is searching the room';
}
function keyboardInput(){
 return {x:(held.has('d')||held.has('arrowright')?1:0)-(held.has('a')||held.has('arrowleft')?1:0),
  z:(held.has('s')||held.has('arrowdown')?1:0)-(held.has('w')||held.has('arrowup')?1:0),
  sneak:held.has('control')||held.has('c'),sprint:held.has('shift')};
}
function getInput(){
 const input=keyboardInput(),pad=navigator.getGamepads?.()[0];
 if(pad){
  if(Math.abs(pad.axes[0])>.18)input.x=pad.axes[0];if(Math.abs(pad.axes[1])>.18)input.z=pad.axes[1];
  input.sneak=input.sneak||pad.buttons[4]?.pressed;input.sprint=input.sprint||pad.buttons[7]?.pressed;
  const actions={0:()=>interact(state),1:()=>throwBottle(state),2:()=>pulse(state),3:()=>radio(state),9:()=>pauseGame()};
  for(const [idx,action] of Object.entries(actions))if(pad.buttons[idx]?.pressed&&!gamepadLast[idx])action();
  gamepadLast=pad.buttons.map(b=>b.pressed);
 }
 return input;
}
function resize(){
 if(!renderer)return;
 const w=window.innerWidth,h=window.innerHeight;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowQuality?1:1.6));renderer.setSize(w,h);
 camera.aspect=w/h;camera.updateProjectionMatrix();composer?.setPixelRatio(renderer.getPixelRatio());composer?.setSize(w,h);if(film)film.uniforms.aspect.value=w/h;
}
function setQuality(){
 lowQuality=!lowQuality;renderer.shadowMap.enabled=!lowQuality;if(bloom)bloom.enabled=!lowQuality;resize();$('quality-btn').textContent='GRAPHICS: '+(lowQuality?'LOW':'HIGH');
}
function keydown(e){
 const k=e.key.toLowerCase();
 if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k))e.preventDefault();
 if(k==='escape'){pauseGame();return;}if(k==='tab'){if(!e.repeat)toggleMap();return;}
 if(e.repeat){held.add(k);return;}
 if(k===' '||k==='q'){pulse(state);return;}if(k==='e'){interact(state);return;}if(k==='f'){throwBottle(state);return;}if(k==='r'){radio(state);return;}
 if(k==='enter'&&(!state.playing||state.ended)){startGame();return;}held.add(k);
}
window.addEventListener('keydown',keydown);window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{held.clear();if(state.playing&&!state.paused)pauseGame(true);});
window.addEventListener('resize',resize);
$('start-btn').addEventListener('click',startGame);$('restart-btn').addEventListener('click',startGame);$('restart-pause-btn').addEventListener('click',startGame);
$('resume-btn').addEventListener('click',()=>pauseGame(false));$('pause-btn').addEventListener('click',()=>pauseGame());$('map-btn').addEventListener('click',()=>toggleMap());$('close-map').addEventListener('click',()=>toggleMap(false));
$('pulse-btn').addEventListener('click',()=>pulse(state));$('throw-btn').addEventListener('click',()=>throwBottle(state));$('radio-btn').addEventListener('click',()=>radio(state));$('touch-interact').addEventListener('click',()=>interact(state));
$('quality-btn').addEventListener('click',setQuality);$('sound-btn').addEventListener('click',()=>{$('sound-btn').textContent=sound.toggle()?'SOUND ON':'SOUND OFF';});
document.querySelectorAll('[data-move]').forEach(el=>{
 const keys={up:'w',down:'s',left:'a',right:'d'},k=keys[el.dataset.move];
 el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);held.add(k);});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>held.delete(k));
});
function animate(now){
 const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;if(!ready)return;
 const input=getInput();if(state.playing)update(state,dt,input);consumeEvents();
 const title=!$('title-screen').classList.contains('hidden'),time=title?now/1000:state.time;
 if(title){updateActor(hero,{x:2.1,z:.6,facing:1},time,false,null,'intake');listener.visible=false;}
 else{
  updateActor(hero,state.player,state.time,state.player.moving,state.pulse,state.room,state.player.sneaking);
  listener.visible=state.monster.room===state.room;
  if(listener.visible)updateActor(listener,state.monster,state.time,state.monster.mode!=='lockon',state.pulse,state.room);
 }
 updateRoom(currentRoom,state,dt);updateThrown();
 light.position.set(hero.position.x+.2,1.15,hero.position.z+.55);light.intensity=state.player.hidden?0:title?2.1:2.8;
 const same=state.monster.room===state.room;enemyLight.position.set(state.monster.x,1,state.monster.z+.3);enemyLight.intensity=same&&state.playing?(state.monster.mode==='hunt'?1.4:.2):0;
 const room=ROOMS[state.room],desired=title?-.9:state.player.x+state.player.facing*.75;
 const z=state.player.hidden?8.9:10.6,halfView=z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect;
 const max=Math.max(.2,room.width/2-halfView+.8),targetX=clamp(desired,-max,max);
 camera.position.x=THREE.MathUtils.lerp(camera.position.x,targetX,1-Math.exp(-dt*3));camera.position.z=THREE.MathUtils.lerp(camera.position.z,z,1-Math.exp(-dt*2));
 camera.position.y=THREE.MathUtils.lerp(camera.position.y,state.player.hidden?2.9:3.45,1-Math.exp(-dt*2));camera.lookAt(camera.position.x,1.6,-.5);
 const age=state.pulse&&state.pulse.room===state.room?state.time-state.pulse.time:100;
 echo.age.value=age;echo.color.value.set(state.noise>75?'#b77a56':state.noise>40?'#b89e65':'#65aeb7');
 if(state.pulse){echo.origin.value.set(state.pulse.x,.7,state.pulse.z);ring.position.set(state.pulse.x,.022,state.pulse.z);const radius=Math.max(.01,age*6.8);ring.scale.setScalar(radius);ring.material.opacity=age>=0&&age<3?Math.pow(1-age/3,2)*.30:0;ring.material.color.copy(echo.color.value);}
 if(film){
  film.uniforms.time.value=now/1000;film.uniforms.hide.value=state.player.hidden?1:0;film.uniforms.pulseAge.value=age;
  if(state.pulse){const v=new THREE.Vector3(state.pulse.x,1,state.pulse.z).project(camera);film.uniforms.pulseUv.value.set(v.x*.5+.5,v.y*.5+.5);}
 }
 sound.update(state);if(now-lastUI>100){refreshUI();lastUI=now;}composer.render();
}
async function boot(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#0b1010');
  $('viewport').appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color('#0b1010');scene.fog=new THREE.FogExp2('#111a18',.035);
  camera=new THREE.PerspectiveCamera(42,window.innerWidth/window.innerHeight,.1,70);camera.position.set(-.9,3.45,10.6);camera.lookAt(-.9,1.6,-.5);
  scene.add(new THREE.HemisphereLight('#a7b8ab','#292219',.85));scene.add(new THREE.AmbientLight('#929583',.22));
  const fill=new THREE.DirectionalLight('#a8b8b4',.65);fill.position.set(-3,7,5);scene.add(fill);
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  bloom=new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),.23,.35,1.1);composer.addPass(bloom);
  film=new ShaderPass(filmShader);composer.addPass(film);composer.addPass(new OutputPass());
  $('help-line').style.opacity='0';resize();
  [textures,actorArt]=await Promise.all([loadMaterials((n,total)=>{$('loading-status').textContent='Preparing materials · '+Math.round(n/total*100)+'%';}),loadActors()]);
  hero=createActor(actorArt.drifter,'drifter');listener=createActor(actorArt.listener,'listener');scene.add(hero,listener);
  light=new THREE.PointLight('#d7c9a0',2.8,5,2);scene.add(light);enemyLight=new THREE.PointLight('#a24b3f',0,3,2);scene.add(enemyLight);
  ring=createSonarRing();scene.add(ring);switchRoom('intake',false);
  ready=true;$('start-btn').disabled=false;$('loading-status').textContent='FACILITY READY · ORIGINAL 2.5D EDITION';
  renderer.setAnimationLoop(animate);window.__ECHO__={version:'2.0.0',state:()=>state,renderInfo:()=>renderer.info,rooms:()=>rooms.size};
 }catch(error){
  console.error(error);$('loading-status').textContent='The facility could not load. Enable browser hardware acceleration and reload.';
  $('start-btn').querySelector('span').textContent='Reload facility';$('start-btn').disabled=false;$('start-btn').onclick=()=>location.reload();
 }
}
boot();
