export class Soundscape{
 constructor(){this.ctx=null;this.enabled=true;this.master=null;this.nextStep=0;this.nextClick=0;this.nextHeart=0;this.nextBreath=0;}
 init(){
  if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=this.enabled?.36:0;this.master.connect(this.ctx.destination);
  const impulse=this.ctx.createBuffer(2,this.ctx.sampleRate*1.5,this.ctx.sampleRate);
  for(let c=0;c<2;c++){const a=impulse.getChannelData(c);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,2.8);}
  this.reverb=this.ctx.createConvolver();this.reverb.buffer=impulse;const wet=this.ctx.createGain();wet.gain.value=.20;this.reverb.connect(wet);wet.connect(this.master);
  const hum=this.ctx.createOscillator(),hg=this.ctx.createGain();hum.type='sine';hum.frequency.value=48;hg.gain.value=.024;hum.connect(hg);hg.connect(this.master);hum.start();
  const buf=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const a=buf.getChannelData(0);let previous=0;
  for(let i=0;i<a.length;i++){const white=Math.random()*2-1;previous=(previous+.02*white)/1.02;a[i]=previous*3.4;}
  this.noiseBuffer=buf;const air=this.ctx.createBufferSource();air.buffer=buf;air.loop=true;const f=this.ctx.createBiquadFilter();f.frequency.value=210;const g=this.ctx.createGain();g.gain.value=.025;air.connect(f);f.connect(g);g.connect(this.master);air.start();
 }
 toggle(){this.enabled=!this.enabled;if(this.ctx)this.master.gain.setTargetAtTime(this.enabled?.36:0,this.ctx.currentTime,.08);return this.enabled;}
 chain(source,vol,duration,pan=0,frequency=1500,delay=0){
  if(!this.ctx||!this.enabled)return;
  const t=this.ctx.currentTime+delay,filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=frequency;
  const p=this.ctx.createStereoPanner();p.pan.value=Math.max(-.85,Math.min(.85,pan));
  const g=this.ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  source.connect(filter);filter.connect(p);p.connect(g);g.connect(this.master);g.connect(this.reverb);source.start(t);source.stop(t+duration+.05);
 }
 tone(f,d=.3,v=.1,type='sine',pan=0,cutoff=2000,delay=0){
  if(!this.ctx)return;const o=this.ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f,this.ctx.currentTime+delay);o.frequency.exponentialRampToValueAtTime(Math.max(20,f*.55),this.ctx.currentTime+delay+d);this.chain(o,v,d,pan,cutoff,delay);
 }
 noise(d=.2,v=.05,pan=0,cutoff=2000,delay=0){if(!this.ctx)return;const n=this.ctx.createBufferSource();n.buffer=this.noiseBuffer;n.playbackRate.value=1.3;this.chain(n,v,d,pan,cutoff,delay);}
 event(e,s){
  if(!this.ctx)return;
  const pan=((e.x??s.player.x)-s.player.x)/9;
  if(e.type==='pulse'){this.tone(135,.9,.23,'sine');this.tone(610,.3,.055,'triangle',0,2300,.04);this.tone(390,.55,.025,'sine',-.2,800,.32);}
  else if(e.type==='card'){this.tone(540,.15,.06);this.tone(810,.4,.05,'sine',0,1500,.15);}
  else if(e.type==='room'){this.noise(.4,.10,0,450);this.tone(82,.5,.07,'triangle');}
  else if(e.type==='throw')this.noise(.17,.07,0,1800);
  else if(e.type==='glass'){this.noise(.4,.3,pan,6200);this.tone(2100,.22,.04,'triangle',pan,6500);}
  else if(e.type==='radio'){for(let i=0;i<5;i++){this.noise(.2,.06,(i-2)*.1,700,i*.3);this.tone(180+i*35,.14,.025,'square',0,700,i*.3);}}
  else if(e.type==='lockon'){this.tone(58,.8,.22,'sine');this.noise(.36,.06,pan,480);}
  else if(e.type==='hunt')this.tone(95,.6,.09,'sawtooth',0,210);
  else if(e.type==='hide'){this.noise(.25,.07,0,650);this.tone(e.hidden?65:110,.2,.07);}
  else if(e.type==='caught'){this.noise(1.4,.30,0,1600);this.tone(48,1.5,.25,'sawtooth',0,300);}
  else if(e.type==='win'){this.tone(330,.6,.06);this.tone(490,.9,.05,'sine',0,2000,.35);}
  else if(e.type==='locked')this.tone(115,.3,.1,'triangle');
 }
 update(s){
  if(!this.ctx||!s.playing||s.paused)return;
  if(s.player.moving&&s.time>this.nextStep){this.nextStep=s.time+(s.player.sprinting?.28:s.player.sneaking?.62:.43);this.noise(.10,s.player.sneaking?.035:.07,0,450);this.tone(85,.06,.05);}
  const same=s.monster.room===s.room,delta=s.monster.x-s.player.x,near=same?Math.hypot(delta,s.monster.z-s.player.z):12;
  if(s.time>this.nextClick){this.nextClick=s.time+2.5+Math.random();if(near<13){this.tone(210,.11,same?.09:.025,'triangle',delta/12,same?1800:280);this.noise(.12,same?.04:.015,delta/12,same?2100:280,.1);}}
  if(same&&near<5&&s.time>this.nextHeart){this.nextHeart=s.time+Math.max(.45,near*.19);this.tone(57,.13,.14*(1-near/8));this.tone(48,.12,.08*(1-near/8),'sine',0,160,.17);}
  if(s.player.hidden&&s.time>this.nextBreath){this.nextBreath=s.time+1.8;this.noise(.65,.055,0,430);}
 }
}
