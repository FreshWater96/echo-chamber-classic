export const ROOMS={
 intake:{name:"Intake Hall",subtitle:"Blackwell Research · Sublevel 04",width:24,theme:"intake",
  doors:[{x:-10.7,z:.1,to:"cryo",label:"Cryogenic Ward",spawn:{x:7.5,z:.2}},{x:10.7,z:.1,to:"gallery",label:"Observation Gallery",spawn:{x:-10.3,z:.2}}],
  lockers:[{x:-4.6,z:-.75}],key:null},
 cryo:{name:"Cryogenic Ward",subtitle:"Temperature systems offline",width:20,theme:"cryo",
  doors:[{x:8.7,z:.1,to:"intake",label:"Intake Hall",spawn:{x:-9.5,z:.2}}],
  lockers:[{x:5.5,z:-.75}],key:{id:"cryo",label:"Cryogenic access card",x:-6.1,z:-.6}},
 gallery:{name:"Observation Gallery",subtitle:"Listen before you move",width:26,theme:"gallery",
  doors:[{x:-11.7,z:.1,to:"intake",label:"Intake Hall",spawn:{x:9.5,z:.2}},{x:11.7,z:.1,to:"containment",label:"Containment Theatre",spawn:{x:-9.8,z:.25}},{x:0,z:-1.05,to:"archive",label:"Records Archive",spawn:{x:0,z:.4},rear:true}],
  lockers:[{x:6.6,z:-.75}],key:null},
 archive:{name:"Records Archive",subtitle:"Something is broadcasting",width:20,theme:"archive",
  doors:[{x:0,z:-1.05,to:"gallery",label:"Observation Gallery",spawn:{x:0,z:.4},rear:true}],
  lockers:[],key:{id:"archive",label:"Archive access card",x:6.1,z:-.65}},
 containment:{name:"Containment Theatre",subtitle:"Subject EC-01 · Do not transmit",width:24,theme:"containment",
  doors:[{x:-10.7,z:.1,to:"gallery",label:"Observation Gallery",spawn:{x:10.5,z:.2}},{x:10.7,z:.1,to:"airlock",label:"Extraction Airlock",spawn:{x:-6.8,z:.2}}],
  lockers:[{x:-5.5,z:-.75}],key:{id:"containment",label:"Containment access card",x:6.3,z:-.7}},
 airlock:{name:"Extraction Airlock",subtitle:"Three authorizations required",width:18,theme:"airlock",
  doors:[{x:-7.7,z:.1,to:"containment",label:"Containment Theatre",spawn:{x:9.5,z:.2}}],
  lockers:[],key:null,exit:{x:5.7,z:-.55}}
};
export const RADIO={room:"archive",x:-5.8,z:-.7};
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function route(from,to){
 const q=[[from]],seen=new Set([from]);
 for(let i=0;i<q.length;i++){
  const p=q[i],id=p[p.length-1];if(id===to)return p;
  for(const d of ROOMS[id].doors)if(!seen.has(d.to)){seen.add(d.to);q.push([...p,d.to]);}
 }
 return [];
}
export function createGame(){
 return {time:0,playing:false,ended:false,won:false,paused:false,room:"intake",visited:new Set(["intake"]),cards:new Set(),
  player:{x:-1.3,z:.5,facing:1,hidden:false,hidingAt:null,moving:false,sneaking:false,sprinting:false,stamina:100},
  monster:{room:"containment",x:7.3,z:.3,facing:-1,mode:"roam",targetRoom:"containment",target:{x:0,z:.3},memoryUntil:0,lockUntil:0,travel:0,patrol:1},
  noise:0,pulse:null,pulses:0,nextPulse:0,bottles:3,radios:2,radioUntil:0,transition:0,nextStepNoise:0,pending:[],events:[],
  hideUntil:0,doorUntil:0,lastContext:"",survived:0};
}
export function emit(s,type,data={}){s.events.push({type,...data});}
export function start(s){s.playing=true;s.ended=false;emit(s,"start");emit(s,"toast",{text:"Find three access cards. The airlock is in the eastern wing."});}
export function noiseEvent(s,source){
 const m=s.monster,path=route(m.room,source.room),hops=path.length-1;
 emit(s,"noise",source);
 if(hops<0||hops>source.reach)return;
 // A close pursuer cannot be instantly erased by a remote radio.
 if(m.mode==="hunt"&&m.room===s.room&&distance(m,s.player)<2&&source.kind==="radio")return;
 m.targetRoom=source.room;m.target={x:source.x,z:source.z};m.memoryUntil=s.time+(source.kind==="radio"?15:11);
 m.travel=0;m.mode="investigate";
 if(source.kind==="sonar"&&m.room===s.room&&distance(m,s.player)<6.5){
  m.mode="lockon";m.lockUntil=s.time+.75;emit(s,"lockon");
 }
}
export function pulse(s){
 if(!s.playing||s.ended||s.paused)return false;
 if(s.time<s.nextPulse){emit(s,"toast",{text:"The scanner is recharging."});return false;}
 if(s.player.hidden){emit(s,"toast",{text:"Leave the hiding place before transmitting."});return false;}
 s.pulse={x:s.player.x,z:s.player.z,room:s.room,time:s.time};s.nextPulse=s.time+4.2;s.pulses++;s.noise=clamp(s.noise+31,0,100);
 emit(s,"pulse",s.pulse);
 noiseEvent(s,{kind:"sonar",room:s.room,x:s.player.x,z:s.player.z,reach:s.noise>75?5:3});
 return true;
}
export function radio(s){
 if(!s.playing||s.ended||s.paused)return false;
 if(s.radios<=0){emit(s,"toast",{text:"The remote radio has no charge remaining."});return false;}
 s.radios--;s.radioUntil=s.time+8;
 noiseEvent(s,{...RADIO,kind:"radio",reach:5});emit(s,"radio",{...RADIO});
 emit(s,"toast",{text:"A radio crackles to life in the Records Archive."});return true;
}
export function throwBottle(s){
 if(!s.playing||s.ended||s.paused||s.player.hidden)return false;
 if(s.bottles<=0){emit(s,"toast",{text:"No specimen vials remaining."});return false;}
 const w=ROOMS[s.room].width/2-1.2;
 const target={room:s.room,x:clamp(s.player.x+s.player.facing*5.4,-w,w),z:clamp(s.player.z-.15,-.95,1.25)};
 s.bottles--;s.pending.push({at:s.time+.55,source:{...target,kind:"glass",reach:1}});
 emit(s,"throw",{from:{x:s.player.x,z:s.player.z},target});return true;
}
export function context(s){
 if(s.player.hidden)return {type:"leave",label:"Leave hiding place",x:s.player.x,z:s.player.z};
 const p=s.player,r=ROOMS[s.room],options=[];
 if(r.key&&!s.cards.has(r.key.id))options.push({...r.key,type:"card",label:"Take "+r.key.label});
 for(const d of r.doors)options.push({...d,type:"door",label:"Enter "+d.label});
 for(const l of r.lockers)options.push({...l,type:"hide",label:"Hide in locker"});
 if(s.room===RADIO.room)options.push({...RADIO,type:"radio",label:"Activate radio"});
 if(r.exit)options.push({...r.exit,type:"exit",label:s.cards.size===3?"Unlock airlock and escape":"Airlock · "+s.cards.size+" / 3 access cards"});
 options.sort((a,b)=>distance(a,p)-distance(b,p));
 return options.length&&distance(options[0],p)<1.45?options[0]:null;
}
export function interact(s){
 if(!s.playing||s.ended||s.paused)return false;
 const c=context(s);if(!c)return false;
 const p=s.player,m=s.monster;
 if(c.type==="leave"){p.hidden=false;p.hidingAt=null;emit(s,"hide",{hidden:false});return true;}
 if(c.type==="card"){
  s.cards.add(c.id);emit(s,"card",{id:c.id,label:c.label});
  emit(s,"toast",{text:c.label+" recovered. "+s.cards.size+" of 3 authorizations."});
  if(s.cards.size===3)emit(s,"toast",{text:"All access cards recovered. Reach the eastern airlock."});
  return true;
 }
 if(c.type==="hide"){
  if(m.room===s.room&&["hunt","lockon"].includes(m.mode)&&distance(m,p)<3){
   emit(s,"toast",{text:"It is watching. Break away before you hide."});return false;
  }
  p.hidden=true;p.hidingAt={x:c.x,z:c.z};p.x=c.x;p.z=c.z;s.hideUntil=s.time+8;
  if(m.room===s.room){m.mode="search";m.memoryUntil=s.time+5.5;}
  emit(s,"hide",{hidden:true});emit(s,"toast",{text:"Hidden. Stay silent. E to leave."});return true;
 }
 if(c.type==="radio")return radio(s);
 if(c.type==="exit"){
  if(s.cards.size!==3){emit(s,"toast",{text:"Three access cards are required to release the airlock."});emit(s,"locked");return false;}
  s.won=true;s.ended=true;s.playing=false;s.survived=s.time;emit(s,"win");return true;
 }
 if(c.type==="door"){
  if(s.time<s.doorUntil)return false;
  const from=s.room;s.room=c.to;p.x=c.spawn.x;p.z=c.spawn.z;p.hidden=false;p.hidingAt=null;s.visited.add(s.room);
  s.transition=.42;s.doorUntil=s.time+.8;emit(s,"room",{from,to:s.room});
  if(m.room===from&&["hunt","lockon"].includes(m.mode)){m.targetRoom=s.room;m.mode="investigate";m.target={x:p.x,z:p.z};m.memoryUntil=s.time+13;m.travel=0;}
  return true;
 }
 return false;
}
function blocked(room,x,z){
 if(room==="containment"&&x>-1.65&&x<1.65&&z>-.9&&z<.18)return true;
 return false;
}
function movePlayer(s,dt,input){
 const p=s.player,r=ROOMS[s.room];p.moving=false;p.sneaking=!!input.sneak;p.sprinting=false;
 if(p.hidden||s.transition>0)return;
 let x=input.x||0,z=input.z||0,n=Math.hypot(x,z);
 if(n>.01){
  x/=Math.max(1,n);z/=Math.max(1,n);
  const sprint=!!input.sprint&&!p.sneaking&&p.stamina>3;
  const speed=p.sneaking?1.35:sprint?3.65:2.5;
  const nx=clamp(p.x+x*speed*dt,-r.width/2+1.1,r.width/2-1.1),nz=clamp(p.z+z*speed*dt,-1.05,1.5);
  if(!blocked(s.room,nx,p.z))p.x=nx;
  if(!blocked(s.room,p.x,nz))p.z=nz;
  if(Math.abs(x)>.1)p.facing=x>0?1:-1;
  p.moving=true;p.sprinting=sprint;
  p.stamina=clamp(p.stamina+(sprint?-24:7)*dt,0,100);
  if(sprint&&s.time>s.nextStepNoise){
   s.nextStepNoise=s.time+.95;s.noise=clamp(s.noise+7,0,100);
   noiseEvent(s,{kind:"running",room:s.room,x:p.x,z:p.z,reach:1});
  }
 }else p.stamina=clamp(p.stamina+15*dt,0,100);
}
function updateMonster(s,dt){
 const m=s.monster,p=s.player,same=m.room===s.room;
 const detection=p.sneaking?1.8:p.sprinting?6:3.7;
 const d=same?distance(m,p):Infinity;
 if(same&&!p.hidden&&d<detection){
  if(!["hunt","lockon"].includes(m.mode)){m.mode="lockon";m.lockUntil=s.time+.75;emit(s,"lockon");}
  m.targetRoom=s.room;m.target={x:p.x,z:p.z};m.memoryUntil=s.time+5.2;
 }
 if(m.mode==="lockon"&&s.time>=m.lockUntil){m.mode="hunt";emit(s,"hunt");}
 if(["investigate","hunt","search"].includes(m.mode)&&s.time>m.memoryUntil){m.mode="roam";m.targetRoom=m.room;m.travel=0;}
 if(m.targetRoom!==m.room&&m.mode!=="roam"){
  m.travel+=dt;
  if(m.travel>4.5){
   const path=route(m.room,m.targetRoom);
   if(path.length>1){
    const previous=m.room;m.room=path[1];const entry=ROOMS[m.room].doors.find(d=>d.to===previous);
    m.x=entry?clamp(entry.x,-ROOMS[m.room].width/2+1.3,ROOMS[m.room].width/2-1.3):0;
    m.z=.15;m.travel=0;emit(s,"monster-room",{room:m.room});
   }
  }
  return;
 }
 if(m.mode==="lockon")return;
 let target=m.target,speed=m.mode==="hunt"?2.85:m.mode==="investigate"?1.65:m.mode==="search"?.55:.72;
 if(m.mode==="roam"){target={x:Math.sin(s.time*.15+m.patrol)*ROOMS[m.room].width*.27,z:.3};}
 if(m.mode==="hunt"&&same&&!p.hidden){target={x:p.x,z:p.z};m.target=target;}
 if(m.mode==="search"){target={x:m.target.x+Math.sin(s.time*1.1)*1.2,z:.3};}
 let dx=target.x-m.x,dz=target.z-m.z,n=Math.hypot(dx,dz);
 if(n>.1){m.x+=dx/n*speed*dt;m.z+=dz/n*speed*dt;if(Math.abs(dx)>.1)m.facing=dx>0?1:-1;}
 if(same&&!p.hidden&&distance(m,p)<.68&&m.mode==="hunt"){
  s.ended=true;s.playing=false;s.won=false;s.survived=s.time;emit(s,"caught");
 }
}
export function update(s,dt,input={}){
 if(!s.playing||s.ended||s.paused)return;
 dt=clamp(dt,0,.05);s.time+=dt;s.transition=Math.max(0,s.transition-dt);s.noise=Math.max(0,s.noise-dt*3.3);
 if(s.player.hidden&&s.time>s.hideUntil){s.player.hidden=false;s.player.hidingAt=null;emit(s,"hide",{hidden:false});emit(s,"toast",{text:"You cannot hold your breath any longer."});}
 movePlayer(s,dt,input);
 for(let i=s.pending.length-1;i>=0;i--)if(s.time>=s.pending[i].at){noiseEvent(s,s.pending[i].source);emit(s,"glass",s.pending[i].source);s.pending.splice(i,1);}
 updateMonster(s,dt);
}
