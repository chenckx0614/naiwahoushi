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

test('a locker breaks sight, but a chasing enemy can inspect a nearby locker',()=>{
  const e=enemy();e.z=3.5;e.state='chase';e.memory=4;
  const hiding={...world,hidden:true,hideSpot:{x:0,z:4}};
  const result=stepEnemy(e,.1,hiding);
  assert.equal(result.found,true);
  assert.equal(result.attacked,false);
});

test('enemy records repeated player movement between cells',()=>{
  const e=enemy();
  stepEnemy(e,.1,{...world,pz:3});
  stepEnemy(e,.1,{...world,pz:4});
  stepEnemy(e,.1,{...world,pz:3});
  stepEnemy(e,.1,{...world,pz:4});
  assert.equal(e.learnedRoutes.get('0,3>0,4'),2);
});
