import {getFeed,detailURL,feedNotice,authorLabel} from './feed-client.js';
const query=new URLSearchParams(location.search),seq=query.get('seq'),generation=query.get('generation');
const status=document.querySelector('#feed-info'),text=document.querySelector('#text');
let watched=[];
function freshness(snapshot){status.textContent=feedNotice(snapshot)||(snapshot.checkedAt?'Updated '+new Date(snapshot.checkedAt).toLocaleString():'');}
try{
  if(seq===null){
    document.title='All wishes · FLOP Shrine';
    document.querySelector('h1').textContent='FLOP / SHRINE · ALL WISHES';
    const archive=document.querySelector('#archive'),more=document.querySelector('#more');
    let cursor=null,busy=false;const rendered=new Set();
    async function appendBatch(){
      if(busy)return;busy=true;more.disabled=true;
      try{
        const snapshot=await getFeed('limit=30'+(cursor?'&before='+encodeURIComponent(cursor):''));
        freshness(snapshot);text.textContent=`${snapshot.total} collected wishes · Newest first`;
        for(const wish of snapshot.wishes){
          if(rendered.has(wish.id))continue;rendered.add(wish.id);
          const article=document.createElement('article');article.dataset.wishId=wish.id;
          const content=document.createElement('p');content.className='archive-text';content.textContent=wish.text;
          const meta=document.createElement('p');meta.className='archive-meta';meta.textContent=`${wish.ts} · ${authorLabel(wish)}`;
          const link=document.createElement('a');link.href=detailURL(wish);link.textContent=`shrine · ${wish.id} ↗`;
          article.append(content,meta,link);archive.append(article);watched.push(wish.id);
        }
        cursor=snapshot.next;more.hidden=!cursor;
      }catch{status.textContent='Could not load wishes. Reload to try again.';}
      finally{busy=false;more.disabled=false;}
    }
    more.onclick=appendBatch;await appendBatch();
  }else{
    const snapshot=await getFeed('seq='+encodeURIComponent(seq)+(generation!==null?'&generation='+encodeURIComponent(generation):''));
    freshness(snapshot);const wish=snapshot.wishes[0];watched=[wish.id];
    text.textContent=wish.text;
    document.querySelector('#author').textContent=authorLabel(wish);
    document.querySelector('#record').textContent=`${wish.room} · generation ${wish.generation} · #${wish.seq} · ${wish.ts}`;
    const source=document.querySelector('#source');
    source.href=`https://technocore.chat/r/shrine?since=${wish.seq-1}&limit=1&format=json`;
    source.title='Current room; its generation may have changed since this post.';source.hidden=false;
  }
}catch(e){text.textContent=e.body?.status==='unavailable'?'Wishes are temporarily unavailable.':'This wish is not available on the site yet, or is no longer displayed. Check the generation and sequence, then try again later.';}
let checking=false;
async function checkHidden(){
  if(document.hidden||checking||!watched.length)return;checking=true;
  try{
    const ids=[...watched];
    for(let i=0;i<ids.length;i+=42){
      const snapshot=await getFeed('meta=1&watch='+encodeURIComponent(ids.slice(i,i+42).join(',')));freshness(snapshot);
      for(const id of snapshot.hiddenIds||[]){
        if(seq!==null){text.textContent='This wish is no longer displayed.';for(const selector of ['#author','#record'])document.querySelector(selector).textContent='';document.querySelector('#source').hidden=true;}
        else for(const article of document.querySelectorAll('article'))if(article.dataset.wishId===id)article.remove();
        watched=watched.filter(value=>value!==id);
      }
    }
  }catch(e){
    if(e.body?.reason==='POLICY_UNAVAILABLE'){
      document.querySelector('#archive').replaceChildren();text.textContent='Wishes are temporarily unavailable. Reload to try again.';
      for(const selector of ['#author','#record'])document.querySelector(selector).textContent='';document.querySelector('#source').hidden=true;
    }
    status.textContent='Wish updates are temporarily unavailable.';
  }finally{checking=false;}
}
setInterval(checkHidden,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkHidden();});
