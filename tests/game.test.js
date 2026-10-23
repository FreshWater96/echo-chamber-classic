import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS,createGame,start,route,interact,pulse,radio,throwBottle,update,context} from '../src/logic.js';
test('all keycards and the exit have traversable room routes',()=>{
 for(const id of Object.keys(ROOMS))assert.ok(route('intake',id).length>0,id);
 for(const [id,r] of Object.entries(ROOMS))for(const d of r.doors)assert.ok(ROOMS[d.to].doors.some(x=>x.to===id),'return route '+id);
});
test('three separate card pickups release the airlock; incomplete cards do not',()=>{
 const s=createGame();start(s);s.room='airlock';Object.assign(s.player,ROOMS.airlock.exit);assert.equal(interact(s),false);assert.equal(s.ended,false);
 for(const [id,r] of Object.entries(ROOMS))if(r.key){s.room=id;Object.assign(s.player,r.key);assert.equal(context(s).type,'card');interact(s);}
 assert.equal(s.cards.size,3);s.room='airlock';Object.assign(s.player,ROOMS.airlock.exit);assert.equal(interact(s),true);assert.equal(s.won,true);
});
test('sonar exposes its source, has a cooldown, and accumulates resonance',()=>{
 const s=createGame();start(s);assert.equal(pulse(s),true);assert.equal(s.noise,31);assert.equal(s.monster.targetRoom,'intake');
 assert.equal(pulse(s),false);assert.equal(s.pulses,1);
 for(let i=0;i<90;i++)update(s,.05,{});assert.equal(pulse(s),true);assert.equal(s.pulses,2);
});
test('the radio redirects sound investigation and throwables consume finite inventory',()=>{
 const s=createGame();start(s);assert.equal(radio(s),true);assert.equal(s.monster.targetRoom,'archive');assert.equal(s.radios,1);
 throwBottle(s);assert.equal(s.bottles,2);for(let i=0;i<13;i++)update(s,.05,{});assert.ok(s.events.some(e=>e.type==='glass'));
});
test('a distant creature cannot capture a player inside a locker',()=>{
 const s=createGame();start(s);Object.assign(s.player,ROOMS.intake.lockers[0]);assert.equal(interact(s),true);assert.equal(s.player.hidden,true);
 s.monster.room='intake';s.monster.x=s.player.x;s.monster.z=s.player.z;s.monster.mode='search';s.monster.memoryUntil=10;
 update(s,.05,{});assert.equal(s.ended,false);interact(s);assert.equal(s.player.hidden,false);
});
