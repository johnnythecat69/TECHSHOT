import { test } from 'node:test';
import assert from 'node:assert/strict';
import { END, TILES, act, newRun, visibleRun } from '../src/game.js';

const first=()=>0;
test('a run follows the board, keeps pending challenges and hides solutions',()=>{
  assert.equal(TILES.length,END+1);
  const start=newRun('tracker');
  const run=act(start,'tracker','roll',{},1000,first);
  assert.equal(start.pos,0);
  assert.equal(run.pos,1);
  assert.equal(run.pending.kind,'trial');
  assert.throws(()=>act(run,'tracker','roll'));
  assert.throws(()=>act(run,'tracker','sigil',{pick:0},2000));
  assert.deepEqual(visibleRun(run,1000).pending.sequence,[0,1,2]);
  assert.equal(visibleRun(run,10000).pending.sequence,undefined);
  const expired=act(run,'tracker','expire',{},30000);
  assert.equal(expired.hp,3);
  assert.equal(expired.guard,false);
  assert.equal(expired.pending,null);
});
test('a six curses the next ritual and a talisman spends one careful throw',()=>{
  const rolled=act(newRun('scholar'),'scholar','roll',{},0,n=>n===6?5:0);
  assert.equal(rolled.die,6);
  assert.equal(rolled.curse,1);
  const safe=act(rolled,'scholar','choice',{pick:1},0,first);
  const next=act({...safe,charm:1},'scholar','roll',{careful:true},1000,first);
  assert.equal(next.charm,0);
  assert.equal(next.pending.sequence.length,4);
  assert.equal(next.curse,0);
});
test('the final gate requires three seals and a completed ritual',()=>{
  const start={...newRun('warden'),pos:END-1,seals:2};
  const rejected=act(start,'warden','roll',{},0,first);
  assert.equal(rejected.pos,END-6);
  assert.equal(rejected.seals,3);
  let run=act({...start,seals:3},'warden','roll',{},0,first);
  for(const pick of [0,1,2,3])run=act(run,'warden','sigil',{pick},8000);
  assert.equal(run.phase,'won');
  assert.equal(run.wins,1);
  assert.equal(act(run,'warden','restart').wins,1);
});
