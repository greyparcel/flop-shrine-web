import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {createFeed,accepted,parseRecords,verified} from './feed.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const bytes=Buffer.concat([Buffer.from([0xed,1]),publicKey.export({type:'spki',format:'der'}).subarray(-32)]);
let n=BigInt('0x'+bytes.toString('hex')),encoded='';const abc='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
while(n){encoded=abc[Number(n%58n)]+encoded;n/=58n;}const did='did:key:z'+encoded;
function row(seq,text=`WISH: Test wish ${seq}`,nonce=String(seq)){
  return {seq,ts:new Date(Date.UTC(2026,8,9,0,seq)).toISOString(),from:did,text,nonce,
    sig:sign(null,Buffer.from(`shrine|${nonce}|${text}`),privateKey).toString('base64url')};
}
const legacy={generation:1,wishes:[]};
async function fixture(){
  await mkdir('.cache',{recursive:true});const dir=await mkdtemp('.cache/feed-test-');
  const policyPath=dir+'/policy.json';await writeFile(policyPath,JSON.stringify({hiddenIds:[],hiddenDids:[]}));
  let time=100000,records=[row(1)],generation=1,fail=false,reads=0,exports=0;
  const fetchImpl=async url=>{
    reads++;if(fail)throw new Error('offline');
    if(url.endsWith('/export')){exports++;return new Response(records.map(r=>JSON.stringify(r)).join('\n'),{headers:{'x-room-generation':String(generation)}});}
    const since=Number(new URL(url).searchParams.get('since'))||0;
    return Response.json({room:'shrine',generation,last_seq:records.at(-1)?.seq||0,first_seq:records[0]?.seq||null,messages:records.filter(r=>r.seq>since).slice(-200)});
  };
  const opts={dataDir:dir+'/data',policyPath,legacy,fetchImpl,now:()=>time};
  return {feed:createFeed(opts),opts,policyPath,advance:()=>time+=310000,setRows:r=>records=r,setGeneration:g=>generation=g,fail:()=>fail=true,reads:()=>reads,exports:()=>exports};
}
test('plain text and unsigned posts are included; signature is metadata only',()=>{
  assert.equal(verified(row(1)),true);
  assert.equal(accepted({...row(1),text:'Changed text'},1).signatureVerified,false);
  assert.equal(accepted({...row(1),sig:undefined},1).signatureVerified,false);
  assert.equal(accepted(row(1,'An introduction'),1).text,'An introduction');
  assert.equal(accepted(row(1,'WISH: Original text'),1).text,'WISH: Original text');
  assert.equal(accepted(row(1,'   '),1),null);
  const unsigned={seq:1,ts:row(1).ts,from:'visitor',text:'A wish without a signature'};
  assert.equal(accepted(unsigned,1).signatureVerified,false);
  assert.notEqual(accepted(unsigned,1).fingerprint,accepted({...unsigned,seq:2},1).fingerprint);
  assert.notEqual(accepted(unsigned,1).fingerprint,accepted(unsigned,2).fingerprint);
  const big=row(3,'WISH: precise nonce','1234567890123456789');
  const parsed=parseRecords(JSON.stringify(big).replace('"nonce":"1234567890123456789"','"nonce":1234567890123456789'));
  assert.equal(parsed.nonce,big.nonce);assert.equal(verified(parsed),true);
});

test('old store re-reads skipped history, preserves full text, and includes unsigned posts on every endpoint',async()=>{
  const f=await fixture();const signed=row(2,'WISH: Saved wish');
  await mkdir(f.opts.dataDir,{recursive:true});
  await writeFile(f.opts.dataDir+'/feed.json',JSON.stringify({schema:1,generation:1,lastSeq:2,checkedAt:'2026-09-09T00:00:00Z',historyIncomplete:false,
    wishes:[{...accepted(signed,1),text:'Saved wish'}]}));
  const unsigned={seq:3,ts:row(3).ts,from:'visitor',text:'My ordinary wish'};
  f.setRows([row(1,'Room introduction'),signed,unsigned,{...unsigned,seq:4}]);
  const result=await f.feed.get();assert.equal(result.body.total,4);
  assert.equal(result.body.wishes.find(w=>w.seq===2).text,signed.text);
  const detail=await f.feed.get(new URLSearchParams('generation=1&seq=3'));
  assert.equal(detail.status,200);assert.equal(detail.body.wishes[0].signatureVerified,false);
  assert.equal(detail.body.wishes[0].text,unsigned.text);
  await writeFile(f.policyPath,JSON.stringify({hiddenIds:['1:3'],hiddenDids:[]}));
  assert.equal((await f.feed.get(new URLSearchParams('generation=1&seq=3'))).status,404);
  assert.deepEqual((await f.feed.get(new URLSearchParams('meta=1&watch=1:3'))).body.hiddenIds,['1:3']);
  assert.equal((await createFeed(f.opts).get()).body.total,3);
});
test('one shared refresh, new wishes, persistent records, stale fallback and policy on all endpoints',async()=>{
  const f=await fixture();await Promise.all([f.feed.get(),f.feed.get(),f.feed.get()]);assert.equal(f.reads(),1);
  f.setRows([row(1),row(2)]);assert.equal((await f.feed.get()).body.total,1);
  f.advance();assert.equal((await f.feed.get()).body.wishes[0].seq,2);
  f.fail();f.advance();const stale=await f.feed.get();assert.equal(stale.body.status,'stale');assert.equal(stale.body.total,2);
  await writeFile(f.policyPath,JSON.stringify({hiddenIds:['1:2'],hiddenDids:[]}));
  assert.equal((await f.feed.get()).body.total,1);
  assert.equal((await f.feed.get(new URLSearchParams('generation=1&seq=2'))).status,404);
  assert.deepEqual((await f.feed.get(new URLSearchParams('meta=1&watch=1:2'))).body.hiddenIds,['1:2']);
  const restarted=createFeed(f.opts);assert.equal((await restarted.get()).body.total,1);
  await writeFile(f.policyPath,'broken');assert.equal((await restarted.get()).status,503);
});
test('empty outage, generation reset, replay deduplication and gaps with export',async()=>{
  const offline=await fixture();offline.fail();assert.equal((await offline.feed.get()).status,503);
  const f=await fixture();await f.feed.get();f.setGeneration(2);f.setRows([row(1,'WISH: New generation','99'),row(2)]);f.advance();
  let result=await f.feed.get();assert.equal(result.body.total,3);
  assert.equal((await f.feed.get(new URLSearchParams('seq=1'))).status,409);
  f.setRows([row(1,'WISH: New generation','99'),row(2),{...row(2),seq:3}]);f.advance();assert.equal((await f.feed.get()).body.total,3);
  const many=await fixture();many.setRows(Array.from({length:250},(_,i)=>row(i+1)));result=await many.feed.get();
  assert.equal(many.exports(),1);assert.equal(result.body.total,250);assert.equal(result.body.wishes.length,42);assert.equal(result.body.historyIncomplete,false);
  const page2=await many.feed.get(new URLSearchParams('limit=30&before='+result.body.next));assert.equal(page2.body.wishes[0].seq,208);
  const gap=await fixture();gap.setRows([row(10),row(11)]);assert.equal((await gap.feed.get()).body.historyIncomplete,true);
});
