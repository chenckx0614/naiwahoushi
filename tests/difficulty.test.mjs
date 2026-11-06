import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, getDifficulty } from '../difficulty.js';

test('normal retains the previous game values and unknown modes fall back to it',()=>{
  assert.equal(getDifficulty('unknown'),'normal');
  assert.equal(getDifficulty('constructor'),'normal');
  assert.equal(DIFFICULTIES.normal.enemies,3);
  assert.equal(DIFFICULTIES.normal.startingMilk,12);
  assert.equal(DIFFICULTIES.normal.damage,20);
  assert.equal(DIFFICULTIES.normal.stun,3);
});

test('difficulty tiers consistently change available resources and enemy pressure',()=>{
  const {easy,normal,hard}=DIFFICULTIES;
  assert.ok(easy.enemies<normal.enemies && normal.enemies<hard.enemies);
  assert.ok(easy.startingMilk>normal.startingMilk && normal.startingMilk>hard.startingMilk);
  assert.ok(easy.damage<normal.damage && normal.damage<hard.damage);
  assert.ok(easy.sight<normal.sight && normal.sight<hard.sight);
  assert.ok(easy.speed<normal.speed && normal.speed<hard.speed);
});
