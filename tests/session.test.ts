import test from 'node:test';
import assert from 'node:assert/strict';
import {renewedSession} from '../src/lib/cloud/session.ts';
const session=(id:string,token='new')=>({data:{session:{user:{id},access_token:token}},error:null});
test('an existing invitation login gets a fresh token for the same account without OAuth',async()=>{
  const order:string[]=[];
  const result=await renewedSession('recipient',{getSession:async()=>{order.push('current');return session('recipient','old');},refreshSession:async()=>{order.push('refresh');return session('recipient');}});
  assert.deepEqual(order,['current','refresh']);assert.equal(result.access_token,'new');assert.equal(result.user.id,'recipient');
});
test('never refresh or accept on behalf of an account different from the rendered recipient',async()=>{
  let refreshed=false;
  await assert.rejects(renewedSession('recipient',{getSession:async()=>session('other'),refreshSession:async()=>{refreshed=true;return session('other');}}),/Innloggingen har endret/);
  assert.equal(refreshed,false);
  await assert.rejects(renewedSession('recipient',{getSession:async()=>session('recipient'),refreshSession:async()=>session('other')}),/Innloggingen har endret/);
});
test('lost sessions and refresh errors remain errors and never fall back to a different identity',async()=>{
  await assert.rejects(renewedSession('recipient',{getSession:async()=>({data:{session:null},error:null}),refreshSession:async()=>session('recipient')}));
  const error=new Error('Network error');
  await assert.rejects(renewedSession('recipient',{getSession:async()=>session('recipient'),refreshSession:async()=>({data:{session:null},error})}),error);
});
