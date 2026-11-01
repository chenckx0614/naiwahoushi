import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkDistances } from '../walk-distance.js';

test('route distance follows open corridors around walls',()=>{
  const grid=[
    [0,1,0],
    [0,1,0],
    [0,0,0],
  ];
  const steps=walkDistances(grid,0,0);
  assert.equal(steps[0][2],6);
  assert.equal(steps[0][1],-1);
});
