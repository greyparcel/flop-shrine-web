const {chromium}=require(process.env.SHRINE_PLAYWRIGHT_PATH);
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4177');await page.waitForFunction(()=>window.shrineWalk?.ready);
   const panel=page.locator('#gate-wish');assert.equal(await panel.isVisible(),false);
   assert.equal(await page.evaluate(()=>window.shrineWalk.activeWishSeq),null);
   await page.keyboard.press('PageDown');
   await page.waitForFunction(()=>Math.abs(window.shrineWalk.distance-12)<.01);
   assert.equal(await page.evaluate(()=>window.shrineWalk.activeWishSeq),3);
   const initial=await panel.boundingBox();
   await page.screenshot({path:`art/gate-wish-${name}.png`});
   const full=await page.locator('.wish-text').textContent();
   const [detail]=await Promise.all([page.waitForEvent('popup'),page.locator('.wish-source').click()]);
   await detail.waitForFunction(()=>document.querySelector('#text')?.textContent.startsWith('May something I share'));
   assert.equal(await detail.locator('#text').textContent(),full);await detail.close();await page.locator('#scene').focus();
   await page.keyboard.press('ArrowUp');
   await page.waitForFunction(()=>window.shrineWalk.activeWishSeq===2);
   await page.waitForTimeout(400);
   assert.equal(await page.locator('.wish-previous').count(),0);
   assert.deepEqual(await panel.boundingBox(),initial);
   await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>window.shrineWalk.activeWishSeq===3);
   await page.keyboard.press('PageDown');await page.waitForFunction(()=>window.shrineWalk.activeWishSeq===null);await panel.waitFor({state:'hidden'});
   await page.keyboard.press('PageUp');await page.waitForFunction(()=>window.shrineWalk.activeWishSeq===3);assert.equal(await panel.isVisible(),true);
   await page.keyboard.press('End');await page.locator('#participate').waitFor({state:'visible'});
   assert.equal(await panel.isVisible(),false);
   assert.equal(await page.evaluate(()=>window.shrineWalk.activeWishSeq),null);
   if(width<650){const prompt=await page.locator('#participate').boundingBox();assert.ok(prompt.y>=0&&prompt.y+prompt.height<(await page.locator('footer').boundingBox()).y);}
   await page.screenshot({path:`art/wish-arrival-${name}.png`});
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Persistent panel, interval mapping, fixed bounds, reverse, full text and arrival passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});