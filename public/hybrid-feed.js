import {digest,parseRecords,normalize,mergePosts,selectFeed} from './feed-model.js';
export function createHybridFeed({fetchImpl=fetch,now=Date.now}={}){
  let all=[],policy=null,meta={room:'shrine',status:'unavailable'},pending=null,nextCheck=0,nextLive=0,failures=0;
  const detailChecks=new Map();
  async function json(url,maxBytes){
    const response=await fetchImpl(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!response.ok){await response.body?.cancel();throw Object.assign(new Error('Fetch failed'),{retryAfter:Number(response.headers.get('retry-after'))*1000||0});}
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw Error('Response too large');chunks.push(value);}}
    catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return parseRecords(new TextDecoder().decode(bytes));
  }
  async function refresh(){
    if(pending)return pending;if(now()<nextCheck)return;
    pending=(async()=>{
      nextCheck=now()+30000;
      try{
        policy=await json('./feed-policy.json',1024*1024);
        if(!Array.isArray(policy.hiddenIds)||!Array.isArray(policy.hiddenDids)||!Array.isArray(policy.hiddenFingerprints||[]))throw Error();
      }catch{policy=null;throw Object.assign(new Error('Display policy unavailable'),{body:{status:'unavailable',reason:'POLICY_UNAVAILABLE'}});}
      let archiveAvailable=false,liveOK=false;
      try{
        const archive=await json('./archive.json',16*1024*1024);
        if(archive.room!=='shrine'||!Array.isArray(archive.wishes))throw Error();
        all=mergePosts(all,archive.wishes);archiveAvailable=true;
        meta={...meta,archiveUpdatedAt:archive.checkedAt,historyIncomplete:archive.historyIncomplete};
      }catch{/* Keep previously loaded records during an archive outage. */}
      if(now()>=nextLive){
        try{
          const room=await json('https://technocore.chat/r/shrine?format=json&limit=200',4*1024*1024);
          if(room.room!=='shrine'||!Number.isSafeInteger(room.generation)||!Array.isArray(room.messages)||room.messages.length>200)throw Error();
          const posts=(await Promise.all(room.messages.map(r=>normalize(r,room.generation)))).filter(Boolean);
          all=mergePosts(all,posts);liveOK=true;failures=0;nextLive=now()+30000;
          meta={...meta,generation:room.generation,checkedAt:new Date(now()).toISOString()};
          const seqs=all.filter(w=>w.generation===room.generation).map(w=>w.seq).sort((a,b)=>a-b);
          if(seqs.length&&(seqs[0]>1||seqs.some((seq,i)=>i>0&&seq>seqs[i-1]+1)))meta.historyIncomplete=true;
        }catch(e){failures++;nextLive=now()+Math.max(Math.min(300000,30000*2**Math.min(failures,4)),e.retryAfter||0);}
      }
      meta={...meta,status:liveOK?'fresh':all.length||archiveAvailable?'stale':'unavailable',retryAfterMs:Math.max(0,nextLive-now())};
      const hidden=new Set(policy.hiddenIds),dids=new Set(policy.hiddenDids),fps=new Set(policy.hiddenFingerprints||[]);
      meta.version=await digest(all.filter(w=>!hidden.has(w.id)&&!dids.has(w.from)&&!fps.has(w.fingerprint)).map(w=>w.id+':'+w.fingerprint).join('|'));
    })().finally(()=>{pending=null;});
    return pending;
  }
  return async(query='limit=42')=>{
    await refresh();
    if(!policy||meta.status==='unavailable')throw Object.assign(new Error('Feed unavailable'),{body:{...meta,status:'unavailable',reason:!policy?'POLICY_UNAVAILABLE':undefined}});
    const params=new URLSearchParams(query),id=`${params.get('generation')}:${params.get('seq')}`;
    if(params.has('seq')&&params.has('generation')&&!all.some(w=>w.id===id)&&!policy.hiddenIds.includes(id)&&now()>=(detailChecks.get(id)||0)){
      detailChecks.set(id,now()+60000);
      const seq=Number(params.get('seq')),generation=Number(params.get('generation'));
      if(Number.isSafeInteger(seq)&&seq>0&&Number.isSafeInteger(generation)&&generation>=0){
        try{
          const room=await json(`https://technocore.chat/r/shrine?format=json&since=${seq-1}&limit=1`,65536);
          if(room.room==='shrine'&&room.generation===generation&&Array.isArray(room.messages)){
            const post=room.messages.find(w=>w.seq===seq);
            if(post)all=mergePosts(all,[await normalize(post,generation)]);
          }
        }catch{/* A missing detail never causes a write or guesses another generation. */}
      }
    }
    return selectFeed(all,policy,params,meta);
  };
}
