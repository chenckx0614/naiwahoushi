import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findShotTarget, MILK_RANGE } from '../shot-target.js';

const origin={x:1,y:1.58,z:1};
const enemy={x:1,z:5};
test('the shot follows vertical aim and respects walls',()=>{
  assert.equal(findShotTarget(origin,{x:0,y:0,z:1},Infinity,[enemy]).target,null);
  const aim={x:0,y:-.26,z:.966};
  assert.equal(findShotTarget(origin,aim,Infinity,[enemy]).target,enemy);
  const blocked=findShotTarget(origin,aim,2,[enemy]);
  assert.equal(blocked.target,null);
  assert.equal(blocked.blocked,true);
});

test('a wider cell keeps shot targeting aligned with world geometry',()=>{
  const cellSize=1.65;
  const scaledOrigin={x:cellSize,y:1.32,z:cellSize};
  const nearEnemy={x:1,z:3};
  const aim={x:0,y:-.17,z:.985};
  assert.equal(findShotTarget(scaledOrigin,aim,Infinity,[nearEnemy],cellSize).target,nearEnemy);
  assert.equal(findShotTarget(scaledOrigin,aim,2,[nearEnemy],cellSize).target,null);
  assert.equal(findShotTarget(scaledOrigin,aim,Infinity,[enemy],cellSize).target,null);
});

test('a level shot from the player eye height hits the taller egg body',()=>{
  const target={x:1,z:3};
  const shot=findShotTarget({x:1.65,y:1.18,z:1.65},{x:0,y:0,z:1},Infinity,[target],1.65);
  assert.equal(shot.target,target);
});

test('milk range stays short when the corridor cell is enlarged',()=>{
  const origin={x:2.15,y:1.18,z:2.15};
  const aim={x:0,y:0,z:1};
  assert.equal(MILK_RANGE,4.5);
  assert.equal(findShotTarget(origin,aim,Infinity,[{x:1,z:4}],2.15).target,null);
  assert.ok(findShotTarget(origin,aim,Infinity,[{x:1,z:3}],2.15).target);
});
