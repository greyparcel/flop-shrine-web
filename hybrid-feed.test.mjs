import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {accepted} from './feed.mjs';
import {createHybridFeed} from './public/hybrid-feed.js';
import {normalize,parseRecords,mergePosts} from './public/feed-model.js';
const unsigned=(seq,generation=1)=>({seq,generation,ts:`2026-09-10T00:${String(seq%60).padStart(2,'0')}:00Z`,from:'visitor',text:`Wish ${seq}`});
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const bytes=Buffer.concat([Buffer.from([0xed,1]),publicKey.export({type:'spki',format:'der'}).subarray(-32)]);
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
let n=BigInt('0x'+bytes.toString('hex')),encoded='';
while(n){encoded=alphabet[Number(n%58n)]+encoded;n/=58n;}
function signed(seq,nonce=String(seq)){
  const row={...unsigned(seq),from:'did:key:z'+encoded,nonce};
  return {...row,sig:sign(null,Buffer.from(`shrine|${nonce}|${row.text}`),privateKey).toString('base64url')};
}
// Test data is independent of the production archive, which also accepts unsigned posts.
const saved={room:'shrine',checkedAt:'2026-09-10T00:04:00Z',
  wishes:[signed(1),unsigned(2),signed(3,'1234567890123456789'),unsigned(4)].map(row=>accepted(row,1))};
function fixture(){
  let time=100000,policy={hiddenIds:[],hiddenDids:[]},archive=saved,live={room:'shrine',generation:1,messages:[unsigned(5)]},down=false,policyDown=false,reads=0;
  const get=createHybridFeed({now:()=>time,fetchImpl:async url=>{
    if(url==='./feed-policy.json'){if(policyDown)return new Response('',{status:503});return Response.json(policy);}
    if(url==='./archive.json')return Response.json(archive);
    reads++;if(down)return new Response('',{status:429,headers:{'retry-after':'120'}});
    return Response.json(live);
  }});
  return {get,advance:n=>time+=n||31000,policy:p=>policy=p,live:r=>live=r,archive:a=>archive=a,down:()=>down=true,policyDown:()=>policyDown=true,reads:()=>reads};
}
test('WebCrypto agrees with mixed archive fixtures and preserves signed 19-digit nonce tokens',async()=>{
  assert.deepEqual(saved.wishes.map(row=>row.signatureVerified),[true,false,true,false]);
  for(const row of saved.wishes){const checked=await normalize(row,row.generation);assert.equal(checked.signatureVerified,row.signatureVerified);assert.equal(checked.fingerprint,row.fingerprint);}
  const big=signed(3,'1234567890123456789');
  const parsed=parseRecords(JSON.stringify(big).replace('"nonce":"1234567890123456789"','"nonce":1234567890123456789'));
  assert.equal(parsed.nonce,big.nonce);
  assert.equal((await normalize(parsed,1)).signatureVerified,true);
});
test('tampered and invalid signatures remain included but never verify',async()=>{
  const row=signed(6);
  for(const invalid of [{...row,text:'Changed text'},{...row,sig:'A'.repeat(86)},{...row,sig:'invalid'}]){
    const checked=await normalize({...invalid,signatureVerified:true},1);
    assert.equal(checked.text,invalid.text);
    assert.equal(checked.signatureVerified,false);
    assert.equal(checked.fingerprint,accepted(invalid,1).fingerprint);
  }
});
for(const [label,normalizePost] of [['Node',accepted],['WebCrypto',normalize]]){
  test(`${label} keeps same-author, same-text signed posts with distinct nonces`,async()=>{
    const rows=[signed(7,'7001'),{...signed(7,'7002'),seq:8}];
    const posts=await Promise.all(rows.map(row=>normalizePost(row,1)));
    assert.deepEqual(posts.map(post=>post.signatureVerified),[true,true]);
    assert.deepEqual(mergePosts([posts[0]],[posts[1]]).map(post=>post.id),['1:8','1:7']);
    for(const [i,post] of posts.entries()){
      // Check the signed identity contract independently of either implementation.
      const expected=createHash('sha256').update(`${rows[i].from}|${rows[i].nonce}|${rows[i].text}`).digest('hex');
      assert.equal(post.fingerprint,expected);
    }
  });
  test(`${label} deduplicates the same signed envelope replayed at a different sequence`,async()=>{
    const original=signed(9,'9001'),replay={...original,seq:10};
    const posts=await Promise.all([original,replay].map(row=>normalizePost(row,1)));
    assert.deepEqual(posts.map(post=>post.signatureVerified),[true,true]);
    assert.equal(posts[0].fingerprint,posts[1].fingerprint);
    assert.deepEqual(mergePosts([posts[0]],[posts[1]]).map(post=>post.id),['1:9']);
  });
}
test('static archive plus live posts, shared fetch, persistence across generation changes and pagination',async()=>{
  const f=fixture();const [a,b]=await Promise.all([f.get(),f.get()]);assert.equal(f.reads(),1);assert.equal(a.version,b.version);assert.equal(a.total,5);
  assert.deepEqual(a.wishes.map(w=>[w.id,w.signatureVerified]),[['1:5',false],['1:4',false],['1:3',true],['1:2',false],['1:1',true]]);
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

