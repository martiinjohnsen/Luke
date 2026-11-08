import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceRefresher} from '../src/lib/cloud/workspace-refresh.ts';
function deferred() {let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};}
test('accepting an invite waits for an older realtime fetch, then loads the newly joined calendar before navigation',async()=>{
  const first=deferred(),second=deferred();
  let member=false,visible=false,calls=0,navigated=false;
  const refresh=workspaceRefresher(async()=>{
    const included=member;
    if(++calls===1) await first.promise;else await second.promise;
    visible=included;
  });
  const background=refresh();
  member=true; // accept_luke_invite commits while an older fetch is in flight.
  const receive=refresh(true).then(()=>{assert.equal(visible,true);navigated=true;});
  assert.equal(calls,1);assert.equal(navigated,false);
  first.resolve();await background;await Promise.resolve();
  assert.equal(navigated,false,'Navigation raced an incomplete snapshot');
  second.resolve();await receive;assert.equal(calls,2);assert.equal(navigated,true);
});
test('required fetch failures prevent navigation but do not leak errors to background observers',async()=>{
  const gate=deferred();let fail=true;
  const refresh=workspaceRefresher(async()=>{await gate.promise;if(fail) throw new Error('Offline');});
  const required=refresh(true),observer=refresh();
  const failure=assert.rejects(required,/Offline/);
  gate.resolve();await failure;await observer;
  fail=false;await refresh(true);
});
test('simultaneous required refreshes serialize their snapshots and allow a retry after an older failure',async()=>{
  const gate=deferred();let calls=0,active=0,peak=0;
  const refresh=workspaceRefresher(async()=>{active++;peak=Math.max(peak,active);const call=++calls;await gate.promise;active--;if(call===1) throw new Error('Transient');});
  const first=refresh(true),second=refresh(true),third=refresh(true);
  const failure=assert.rejects(first,/Transient/);gate.resolve();
  await Promise.all([failure,second,third]);assert.equal(calls,3);assert.equal(peak,1);
});
