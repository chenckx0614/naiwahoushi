import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findShotTarget } from '../shot-target.js';

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
