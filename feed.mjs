import {createHash,createPublicKey,verify} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';

const BASE='https://technocore.chat/r/shrine';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const recordId=(generation,seq)=>`${generation}:${seq}`;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
// Node 24 preserves the original nonce token even when it exceeds Number's precision.
export function parseRecords(text){return JSON.parse(text,(key,value,context)=>key==='nonce'&&typeof value==='number'?context.source:value);}
export function verified(record){
  try{
    if(!integer(record.seq)||record.seq<1||typeof record.ts!=='string'||!Number.isFinite(Date.parse(record.ts))||
      typeof record.text!=='string'||!record.text.length||[...record.text].length>4096||
      typeof record.from!=='string'||!/^did:key:z[1-9A-HJ-NP-Za-km-z]{47}$/.test(record.from)||
      !/^\d{1,19}$/.test(String(record.nonce))||
      (typeof record.nonce==='number'&&!integer(record.nonce))||
      typeof record.sig!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(record.sig))return false;
    let n=0n;for(const c of record.from.slice(9))n=n*58n+BigInt(alphabet.indexOf(c));
    const bytes=Buffer.from(n.toString(16).padStart(68,'0'),'hex');
    if(bytes.length!==34||bytes[0]!==0xed||bytes[1]!==1)return false;
    const sig=Buffer.from(record.sig,'base64url');if(sig.toString('base64url')!==record.sig)return false;
    const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),bytes.subarray(2)]),format:'der',type:'spki'});
    return verify(null,Buffer.from(`shrine|${record.nonce}|${record.text}`),key,sig);
  }catch{return false;}
}
export function accepted(record,generation){
  if(!record||!integer(record.seq)||record.seq<1||typeof record.ts!=='string'||!Number.isFinite(Date.parse(record.ts))||
    typeof record.text!=='string'||!record.text.trim()||[...record.text].length>4096||typeof record.from!=='string'||!record.from.length)return null;
  const signatureVerified=verified(record);
  return {id:recordId(generation,record.seq),room:'shrine',generation,seq:record.seq,ts:record.ts,from:record.from,
    text:record.text,rawText:record.text,nonce:record.nonce===undefined?undefined:String(record.nonce),sig:record.sig,signatureVerified,
    fingerprint:hash(signatureVerified?`${record.from}|${record.nonce}|${record.text}`:`unsigned|${generation}|${record.seq}|${record.from}|${record.text}`)};
}
async function boundedText(response,maxBytes){
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new Error('UPSTREAM_TOO_LARGE');chunks.push(value);}}
  catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
}
export function createFeed({dataDir,policyPath,fetchImpl=fetch,now=Date.now}){
  let db={schema:2,generation:null,lastSeq:0,checkedAt:null,historyIncomplete:false,wishes:[]};
  let loaded=false,pending=null,nextCheck=0,failures=0,issue=null,nextExport=0;
  const dbPath=path.join(dataDir,'feed.json');
  async function initialize(){
    if(loaded)return;
    try{
      const saved=JSON.parse(await readFile(dbPath,'utf8'));if(![1,2].includes(saved.schema)||!Array.isArray(saved.wishes))throw new Error('INVALID_STORE');
      db=saved;
      if(saved.schema===1){
        // Re-read retained room history to collect posts excluded by the old rules.
        db={...saved,schema:2,lastSeq:0,wishes:saved.wishes.map(w=>{
          const post=accepted({...w,text:w.rawText??w.text},w.generation);
          return post?{...post,observedAt:w.observedAt}:null;
        }).filter(Boolean)};
      }
    }
    catch(e){if(e.code!=='ENOENT')throw e;}
    loaded=true;
  }
  async function request(url,maxBytes){
    const response=await fetchImpl(url,{signal:AbortSignal.timeout(6000),redirect:'error',headers:{Accept:'application/json, application/x-ndjson'}});
    if(!response.ok){const e=new Error(`UPSTREAM_${response.status}`);e.retryAfter=Math.min(300,Math.max(0,Number(response.headers.get('retry-after'))||0))*1000;await response.body?.cancel();throw e;}
    return {text:await boundedText(response,maxBytes),headers:response.headers};
  }
  async function synchronize(){
    await initialize();
    const reply=await request(`${BASE}?format=json&limit=200${db.lastSeq?`&since=${db.lastSeq}`:''}`,4*1024*1024);
    let room=parseRecords(reply.text);
    if(room.room!=='shrine'||!integer(room.generation)||!integer(room.last_seq)||!Array.isArray(room.messages)||room.messages.length>200)throw new Error('INVALID_ROOM');
    // A changed generation invalidates the old cursor: read the current tail again.
    if(db.generation!==null&&room.generation!==db.generation){
      room=parseRecords((await request(`${BASE}?format=json&limit=200`,4*1024*1024)).text);
      if(room.room!=='shrine'||!integer(room.generation)||!integer(room.last_seq)||!Array.isArray(room.messages)||room.messages.length>200)throw new Error('INVALID_ROOM');
    }
    const rows=[...room.messages];
    const cursor=room.generation===db.generation?db.lastSeq:0;
    const fresh=rows.filter(r=>integer(r.seq)&&r.seq>cursor).sort((a,b)=>a.seq-b.seq);
    let gap=room.last_seq>cursor&&(fresh.length===0||fresh[0].seq>cursor+1||fresh.at(-1).seq<room.last_seq||fresh.some((r,i)=>i>0&&r.seq!==fresh[i-1].seq+1));
    let incomplete=db.historyIncomplete;
    if((gap||incomplete)&&now()>=nextExport){
      nextExport=now()+300000;
      try{
        const exported=await request(`${BASE}/export`,12*1024*1024);
        if(Number(exported.headers.get('x-room-generation'))!==room.generation)throw new Error('EXPORT_GENERATION_CHANGED');
        const lines=exported.text.trim()?exported.text.trim().split('\n'):[];
        if(lines.length>100000)throw new Error('EXPORT_TOO_MANY_RECORDS');
        const records=lines.map(parseRecords);rows.push(...records);
        const seen=new Set(records.filter(r=>integer(r.seq)).map(r=>r.seq));
        gap=room.last_seq-cursor>100000;
        if(!gap)for(let n=cursor+1;n<=room.last_seq;n++)if(!seen.has(n)){gap=true;break;}
        // Preserve evidence of earlier lost history; a later tail cannot repair it.
      }catch{gap=true;}
    }
    const all=new Map(db.wishes.map(w=>[w.id,w]));const fingerprints=new Set(db.wishes.map(w=>w.fingerprint));
    rows.sort((a,b)=>a.seq-b.seq);
    for(const row of rows){
      const wish=accepted(row,room.generation);
      if(!wish||all.has(wish.id)||fingerprints.has(wish.fingerprint))continue;
      all.set(wish.id,{...wish,observedAt:new Date(now()).toISOString()});fingerprints.add(wish.fingerprint);
    }
    const updated={...db,generation:room.generation,lastSeq:rows.reduce((last,r)=>integer(r.seq)?Math.max(last,r.seq):last,room.last_seq),
      checkedAt:new Date(now()).toISOString(),historyIncomplete:incomplete||gap,wishes:[...all.values()]};
    const body=JSON.stringify(updated);
    if(Buffer.byteLength(body)>64*1024*1024)throw new Error('STORE_CAPACITY_REACHED');
    await mkdir(dataDir,{recursive:true});await writeFile(dbPath+'.tmp',body);await rename(dbPath+'.tmp',dbPath);db=updated;
  }
  async function refresh(){
    if(pending)return pending;
    if(now()<nextCheck)return;
    pending=(async()=>{
      try{await synchronize();failures=0;issue=null;nextCheck=now()+15000;}
      catch(e){failures++;issue=e.message;nextCheck=now()+Math.max(Math.min(300000,15000*2**Math.min(failures,5)),e.retryAfter||0);console.warn('Wish feed:',issue);}
    })().finally(()=>{pending=null;});
    return pending;
  }
  async function get(params=new URLSearchParams()){
    await refresh();
    // Policy is re-read on every request, even during upstream backoff.
    let policy;try{policy=JSON.parse(await readFile(policyPath,'utf8'));if(!Array.isArray(policy.hiddenIds)||!Array.isArray(policy.hiddenDids))throw new Error();}
    catch{return {status:503,body:{status:'unavailable',reason:'POLICY_UNAVAILABLE',wishes:[]}};}
    const blocked=w=>policy.hiddenIds.includes(w.id)||(w.signatureVerified&&policy.hiddenDids.includes(w.from));
    const all=[...db.wishes].sort((a,b)=>(Date.parse(b.ts)-Date.parse(a.ts))||(b.generation-a.generation)||(b.seq-a.seq));
    const visible=all.filter(w=>!blocked(w));
    const version=hash(visible.map(w=>w.id+':'+w.fingerprint).join('|'));
    const watched=(params.get('watch')||'').split(',').slice(0,42);
    const hiddenIds=all.filter(w=>blocked(w)&&watched.includes(w.id)).map(w=>w.id);
    const meta={room:'shrine',generation:db.generation,checkedAt:db.checkedAt,version,total:visible.length,hiddenIds,
      historyIncomplete:db.historyIncomplete,status:!db.checkedAt?'unavailable':issue?'stale':'fresh',retryAfterMs:Math.max(0,nextCheck-now())};
    if(!db.checkedAt)return {status:503,body:{...meta,wishes:[]}};
    if(params.has('seq')){
      const generation=params.get('generation');
      const matches=visible.filter(w=>String(w.seq)===params.get('seq')&&(generation===null||String(w.generation)===generation));
      return {status:matches.length===1?200:matches.length>1?409:404,body:{...meta,wishes:matches.length===1?matches:[]}};
    }
    if(params.get('meta')==='1')return {status:200,body:meta};
    const before=params.get('before');const index=before?all.findIndex(w=>w.id===before):-1;
    if(before&&index<0)return {status:409,body:{...meta,wishes:[]}};
    const count=Math.min(200,Math.max(1,Number(params.get('limit'))||42));
    const available=all.slice(index+1).filter(w=>!blocked(w));const wishes=available.slice(0,count);
    return {status:200,body:{...meta,wishes,next:available.length>wishes.length?wishes.at(-1).id:null}};
  }
  return {get};
}
