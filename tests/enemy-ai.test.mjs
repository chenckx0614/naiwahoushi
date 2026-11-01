import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hearNoise, stunEnemy, stepEnemy } from '../enemy-ai.js';

function enemy() { return {x:0,z:0,faceX:0,faceZ:1,state:'patrol',path:[],attack:0,
  think:0,stun:0,wait:0,memory:0,searchTime:0}; }
const world={px:0,pz:4,lineClear:()=>true,route:()=>[],neighbors:()=>[],
  clearAt:()=>true,random:()=>.5};

test('enemy spots, chases, loses the player, and resumes patrol',()=>{
  const e=enemy();
  assert.equal(stepEnemy(e,.1,world).spotted,true);
  assert.equal(e.state,'alert');
  stepEnemy(e,.4,world);
  assert.equal(e.state,'chase');
  const hidden={...world,lineClear:()=>false};
  stepEnemy(e,4.6,hidden);
  assert.equal(e.state,'search');
  stepEnemy(e,4.1,hidden);
  assert.equal(e.state,'patrol');
});

test('noise draws a patrol, while milk temporarily stuns it',()=>{
  const e=enemy();
  hearNoise(e,1,0,2);
  assert.equal(e.state,'investigate');
  stunEnemy(e);
  assert.equal(e.state,'stunned');
  stepEnemy(e,1,world);
  assert.equal(e.state,'stunned');
  stepEnemy(e,2.1,world);
  assert.equal(e.state,'search');
});

test('walls prevent spotting and distant sounds do not alert enemies',()=>{
  const e=enemy();
  const blocked={...world,lineClear:()=>false};
  assert.equal(stepEnemy(e,.1,blocked).spotted,false);
  hearNoise(e,10,10,3);
  assert.equal(e.state,'patrol');
});

test('a stunned enemy cannot attack, and a chasing enemy attacks once before searching',()=>{
  const e=enemy();e.z=3.6;e.state='chase';e.memory=4;
  stunEnemy(e);
  assert.equal(stepEnemy(e,.1,world).attacked,false);
  e.state='chase';e.stun=0;
  assert.equal(stepEnemy(e,.1,world).attacked,true);
  assert.equal(e.state,'search');
  assert.equal(stepEnemy(e,.1,world).attacked,false);
});

test('enemy records repeated player movement between cells',()=>{
  const e=enemy();
  stepEnemy(e,.1,{...world,pz:3});
  stepEnemy(e,.1,{...world,pz:4});
  stepEnemy(e,.1,{...world,pz:3});
  stepEnemy(e,.1,{...world,pz:4});
  assert.equal(e.learnedRoutes.get('0,3>0,4'),2);
});

test('blackout shortens enemy sight, while its nearby detection still works',()=>{
  const far=enemy();
  assert.equal(stepEnemy(far,.1,{...world,blackout:true}).spotted,false);
  const near=enemy();
  assert.equal(stepEnemy(near,.1,{...world,pz:2,blackout:true}).spotted,true);
});

test('listener hears farther and watcher is more exposed to flashlight',()=>{
  const listener=enemy();listener.kind='listener';
  hearNoise(listener,6,0,4);
  assert.equal(listener.state,'investigate');
  const watcher=enemy();watcher.kind='watcher';
  hearNoise(watcher,6,0,4);
  assert.equal(watcher.state,'patrol');
  assert.equal(stepEnemy(watcher,.1,{...world,px:0,pz:6,flashlight:true}).spotted,true);
});

test('warden moves to its exit post during the final escape',()=>{
  const warden=enemy();warden.kind='warden';
  let goal;
  stepEnemy(warden,.1,{...world,px:15,pz:15,exitReady:true,exit:{x:6,z:6},
    guardPost:{x:6,z:5},route:(sx,sz,tx,tz)=>{goal=[tx,tz];return [];}});
  assert.equal(warden.state,'guard');
  assert.deepEqual(goal,[6,5]);
});
