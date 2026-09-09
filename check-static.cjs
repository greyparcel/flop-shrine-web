const {chromium}=require(process.env.SHRINE_PLAYWRIGHT_PATH);
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const root=path.resolve('dist'),prefix='/flop-shrine-web/';
 const types={'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.txt':'text/plain','.glb':'model/gltf-binary'};
 const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix))throw Error();const name=url.pathname.slice(prefix.length)||'index.html';const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}${prefix}`;
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.goto(origin);await p.waitForFunction(()=>window.shrineWalk?.ready);
  const feed=await p.evaluate(async()=>{const m=await import('./feed-client.js');return m.getFeed();});
  assert.equal(feed.status,'fresh');assert.ok(feed.total>=4);assert.ok(feed.wishes.some(w=>w.seq===4&&w.signatureVerified));
  assert.ok(!requests.some(u=>u.includes('/api/wishes')));assert.ok(requests.some(u=>u.startsWith('https://technocore.chat/r/shrine')));
  await p.goto(origin+'wish.html?generation=1&seq=4');await p.waitForFunction(()=>document.querySelector('#text').textContent.startsWith('May the things I build'));
  assert.ok((await p.locator('#author').textContent()).startsWith('did:key:'));
  const prompt=await (await p.request.get(origin+'agent-prompt.txt')).text();assert.ok(!prompt.includes('{{'));assert.ok(!prompt.includes('/api/wishes'));
  // A browser-only live post, absent from the saved archive, must appear publicly in this shared flow.
  await p.route('https://technocore.chat/r/shrine?*',r=>r.fulfill({headers:{'access-control-allow-origin':'*'},json:{room:'shrine',generation:1,messages:[{seq:5,ts:'2026-09-10T10:00:00Z',from:'visitor',text:'A new unsigned wish'}]}}));
  await p.goto(origin+'wish.html?generation=1&seq=5');await p.waitForFunction(()=>document.querySelector('#text').textContent==='A new unsigned wish');
  assert.equal(await p.locator('#author').textContent(),'Nickname: visitor');
  await p.route('**/feed-policy.json',r=>r.fulfill({json:{hiddenIds:['1:5'],hiddenDids:[]}}));
  await p.reload();await p.waitForFunction(()=>document.querySelector('#text').textContent.includes('not available'));
  assert.ok(!(await p.locator('#text').textContent()).includes('A new unsigned wish'));
  assert.deepEqual(errors,[]);
  console.log('Static subpath, real CORS, archived signature, new unsigned post, hidden live post and prompt links passed.');
 }finally{await b.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
