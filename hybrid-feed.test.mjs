import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHybridFeed} from './public/hybrid-feed.js';
import {normalize,parseRecords,mergePosts} from './public/feed-model.js';
const saved=JSON.parse(await readFile(new URL('./archive/feed.json',import.meta.url),'utf8'));
const unsigned=(seq,generation=1)=>({seq,generation,ts:`2026-09-10T00:${String(seq%60).padStart(2,'0')}:00Z`,from:'visitor',text:`Wish ${seq}`});
function fixture(){
  let time=100000,policy={hiddenIds:[],hiddenDids:[]},archive={room:'shrine',wishes:saved.wishes,checkedAt:saved.checkedAt},live={room:'shrine',generation:1,messages:[unsigned(5)]},down=false,policyDown=false,reads=0;
  const get=createHybridFeed({now:()=>time,fetchImpl:async url=>{
    if(url==='./feed-policy.json'){if(policyDown)return new Response('',{status:503});return Response.json(policy);}
    if(url==='./archive.json')return Response.json(archive);
    reads++;if(down)return new Response('',{status:429,headers:{'retry-after':'120'}});
    return Response.json(live);
  }});
  return {get,advance:n=>time+=n||31000,policy:p=>policy=p,live:r=>live=r,archive:a=>archive=a,down:()=>down=true,policyDown:()=>policyDown=true,reads:()=>reads};
}
test('WebCrypto agrees with saved signatures and preserves 19-digit nonce tokens',async()=>{
  for(const row of saved.wishes){const checked=await normalize(row,row.generation);assert.equal(checked.signatureVerified,true);assert.equal(checked.fingerprint,row.fingerprint);}
  assert.equal(parseRecords('{"nonce":1234567890123456789}').nonce,'1234567890123456789');
  assert.equal((await normalize(unsigned(5),1)).signatureVerified,false);
});
test('static archive plus live posts, shared fetch, persistence across generation changes and pagination',async()=>{
  const f=fixture();const [a,b]=await Promise.all([f.get(),f.get()]);assert.equal(f.reads(),1);assert.equal(a.version,b.version);assert.equal(a.total,5);
  const detail=await f.get('generation=1&seq=5');assert.equal(detail.wishes[0].from,'visitor');
  f.live({room:'shrine',generation:2,messages:[unsigned(1)]});f.advance();
  assert.equal((await f.get()).total,6);await assert.rejects(f.get('seq=1'),e=>e.status===409);
  const page=await f.get('limit=2');assert.equal(page.wishes.length,2);assert.equal((await f.get('limit=2&before='+page.next)).wishes.length,2);
});
test('hide archived and live posts on list/detail/watch; policy failure blocks all reads',async()=>{
  const f=fixture();await f.get();f.policy({hiddenIds:['1:4','1:5'],hiddenDids:[]});f.advance();
  assert.equal((await f.get()).total,3);await assert.rejects(f.get('generation=1&seq=5'),e=>e.status===404);
  assert.deepEqual((await f.get('meta=1&watch=1:4,1:5')).hiddenIds,['1:4','1:5']);
  f.policyDown();f.advance();await assert.rejects(f.get(),e=>e.body.reason==='POLICY_UNAVAILABLE');
  await assert.rejects(f.get(),e=>e.body.reason==='POLICY_UNAVAILABLE');
});
test('live failure preserves saved content and respects retry-after; repeated unsigned text is not collapsed',async()=>{
  const f=fixture();await f.get();f.down();f.advance();assert.equal((await f.get()).status,'stale');const count=f.reads();
  f.advance();await f.get();assert.equal(f.reads(),count);
  const a=await normalize(unsigned(1),1),b=await normalize({...unsigned(1),seq:2},1);
  assert.equal(mergePosts([a],[a,b]).length,2);
});
