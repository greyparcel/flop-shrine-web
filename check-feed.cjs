const {chromium}=require(process.env.SHRINE_PLAYWRIGHT_PATH);
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
 try{
  const a=await browser.newContext(),b=await browser.newContext();
  const realA=await (await a.request.get('http://127.0.0.1:4177/api/wishes')).json();
  const realB=await (await b.request.get('http://127.0.0.1:4177/api/wishes')).json();
  assert.ok(realA.total>=3);assert.equal(realA.version,realB.version);
  assert.ok(realA.wishes.some(w=>w.generation===1&&w.seq===1));
  const page=await a.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>{const original=window.setInterval;window.testPolls=[];window.setInterval=(fn,ms,...args)=>ms===30000?(window.testPolls.push(fn),0):original(fn,ms,...args);});
  let wishes=Array.from({length:45},(_,i)=>({id:`2:${45-i}`,generation:2,seq:45-i,from:'did:key:test',ts:new Date(Date.UTC(2026,8,9,0,45-i)).toISOString(),text:i===0?'<img src=x onerror="window.injected=1">':`Wish ${45-i}`}));
  let hidden=[],version='a';
  await page.route('**/api/wishes?*',async route=>{
   const params=new URL(route.request().url()).searchParams;
   const visible=wishes.filter(w=>!hidden.includes(w.id));
   const body={room:'shrine',version,total:visible.length,status:'fresh',checkedAt:new Date().toISOString(),hiddenIds:hidden};
   if(params.get('meta')!=='1'){
    const start=params.has('before')?visible.findIndex(w=>w.id===params.get('before'))+1:0;
    body.wishes=params.has('seq')?visible.filter(w=>String(w.seq)===params.get('seq')):visible.slice(start,start+(Number(params.get('limit'))||42));
    body.next=start+body.wishes.length<visible.length?body.wishes.at(-1)?.id:null;
   }
   await route.fulfill({json:body});
  });
  await page.goto('http://127.0.0.1:4177');await page.waitForFunction(()=>window.shrineWalk?.ready);
  assert.equal(await page.evaluate(()=>window.shrineWalk.wishCount),42);
  await page.keyboard.press('PageDown');await page.waitForFunction(()=>window.shrineWalk.activeWishSeq===45);
  assert.equal(await page.locator('#gate-wish img').count(),0);
  assert.equal(await page.locator('.wish-author').textContent(),'Nickname: did:key:test');
  wishes.unshift({...wishes[1],id:'2:46',seq:46,text:'New wish',ts:new Date(Date.UTC(2026,8,9,0,46)).toISOString()});version='b';
  await page.evaluate(()=>Promise.all(window.testPolls.map(fn=>fn())));
  assert.equal(await page.evaluate(()=>window.shrineWalk.activeWishSeq),45);
  assert.equal(await page.locator('#refresh-wishes').isVisible(),true);
  hidden=['2:45'];version='c';await page.evaluate(()=>Promise.all(window.testPolls.map(fn=>fn())));
  await page.waitForFunction(()=>window.shrineWalk.activeWishSeq===null);
  await page.locator('#refresh-wishes').click();await page.waitForFunction(()=>window.shrineWalk?.ready);await page.locator('#scene').focus();await page.keyboard.press('PageDown');
  await page.waitForFunction(()=>window.shrineWalk.activeWishSeq===46);
  await page.goto('http://127.0.0.1:4177/wish.html');await page.locator('article').first().waitFor();
  assert.equal(await page.locator('article').count(),30);await page.locator('#more').click();await page.waitForFunction(()=>document.querySelectorAll('article').length===45);
  await page.screenshot({path:'art/live-feed-archive-mobile.png'});
  assert.ok((await page.locator('article .archive-meta').first().textContent()).includes('Nickname: did:key:test'));
  await page.goto('http://127.0.0.1:4177/wish.html?generation=2&seq=46');
  await page.waitForFunction(()=>document.querySelector('#author').textContent==='Nickname: did:key:test');
  // Real clipboard instructions use the configured site URL, not an unresolved token.
  const real=await b.newPage();await b.grantPermissions(['clipboard-read','clipboard-write']);
  await real.goto('http://127.0.0.1:4177');await real.waitForFunction(()=>window.shrineWalk?.ready);await real.locator('#jump-end').click();await real.locator('#participate').waitFor({state:'visible'});
  await real.locator('#copy-prompt').click();await real.waitForFunction(()=>document.querySelector('#copy-status').textContent.startsWith('Copied with instructions.'));
  const copied=(await real.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');
  const served=(await (await b.request.get('http://127.0.0.1:4177/agent-prompt.txt')).text()).replace(/\r\n/g,'\n');
  assert.equal(copied,served);assert.ok(copied.includes('no special prefix is required'));assert.ok(copied.includes('unsigned nickname posts'));assert.ok(copied.includes('/api/wishes?generation=GENERATION&seq=SEQUENCE'));assert.ok(!copied.includes('{{SHRINE_SITE_URL}}'));
  await real.screenshot({path:'art/live-feed-arrival-desktop.png'});
  console.log('Shared feed across contexts, fixed 42 assignments, update notice, removal, safe text, pagination and clipboard passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
