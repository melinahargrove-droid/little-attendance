// Visual repairs and actual public Fall artwork, using fictional data only.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const LIVE='https://melinahargrove-droid.github.io/little-attendance/';
const ASSETS=[
 ['fall-background.png','413f5dcbe44c8a436981ca443473627f2affebb48df2cf758d0360202bd054fb',1672,941],
 ['fall-here-leaf.png','9039ecc7416630d81fa485d5e54f72cd013b228fd4e0687e2db325764100867b',1042,889],
 ['fall-waiting-leaf.png','f5bf84df94389ca880d491ad55d485da34a000e8ef9643be50f70a8b82e3bf53',1032,889]
].map(([file,sha256,width,height])=>({file,sha256,width,height,url:'https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/'+file}));
const fixture=theme=>({schemaVersion:1,className:'QA Visual Class',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:['qa-a'],history:['qa-a'],selectedTheme:theme,ownedThemes:['school-bus','apple-orchard','fall-leaves']});
module.exports=async({scenario,seed,state,out})=>{
 await scenario('sidebar brand is intentional readable text without an invalid image request',async page=>{
  const invalid=[];page.on('request',request=>{if(request.resourceType()==='image'&&new URL(request.url()).pathname.replace(/\/$/,'')===new URL(page.url()).pathname.replace(/\/$/,''))invalid.push(request.url());});
  await seed(page,fixture('apple-orchard'));
  for(const viewport of [{width:1024,height:768},{width:1280,height:720}]){
   await page.setViewportSize(viewport);await page.locator('#classHotspot').click();
   assert.equal(await page.locator('.classroom-sidebar .mini-brand-name').textContent(),'One Little Teacher');
   assert.equal(await page.locator('.classroom-sidebar .mini-brand-name').isVisible(),true);
   await page.screenshot({path:path.join(out,'visual-brand-classroom-'+viewport.width+'.png')});
   await page.locator('#browseThemes').click();
   assert.equal(await page.locator('.themes-sidebar .mini-brand-name').isVisible(),true);
   assert.equal(await page.locator('.real-brand img').count(),0);
   await page.screenshot({path:path.join(out,'visual-brand-themes-'+viewport.width+'.png')});
   await page.locator('#themesHome').click();
  }
  assert.deepEqual(invalid,[]);
 });
 await scenario('Apple Close remains visible, focused and physically usable at computer sizes',async(page,context)=>{
  await seed(page,fixture('apple-orchard'));const reader=await context.newPage();await reader.goto(page.url());await reader.waitForFunction(()=>editingLockState==='blocked');await reader.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});
  const geometry=[];
  for(const viewport of [{width:1024,height:768},{width:1181,height:757},{width:1280,height:720},{width:1440,height:900},{width:1671,height:941}]){
   for(const [mode,target] of [['editing',page],['readonly',reader]]){
    await target.setViewportSize(viewport);const before=await state(target);await target.locator('#takeHotspot').click();await target.locator('.apple-la-bg').evaluate(image=>image.decode());
    const close=target.locator('#appleClose'),label=close.locator('.apple-la-close-label');
    assert.equal(await close.getAttribute('aria-label'),'Close attendance');assert.equal(await label.textContent(),'Close');
    const fallback=viewport.width/viewport.height<1.75||viewport.width/viewport.height>1.8;assert.equal(await label.isVisible(),fallback);
    const metrics=await close.evaluate(button=>{const b=button.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{x:b.x,y:b.y,width:b.width,height:b.height,hit:hit===button||button.contains(hit)};});
    assert.ok(Math.abs(metrics.x-viewport.width*.928)<1);assert.equal(metrics.y,0);assert.ok(Math.abs(metrics.width-viewport.width*.072)<1);assert.ok(Math.abs(metrics.height-viewport.height*.11)<1);assert.equal(metrics.hit,true);
    await close.focus();assert.equal(await close.evaluate(button=>getComputedStyle(button).outlineStyle),'solid');
    await target.screenshot({path:path.join(out,'visual-apple-'+mode+'-'+viewport.width+'.png')});
    await target.keyboard.press('Enter');assert.equal(await target.locator('#dashboard.active').count(),1);assert.deepEqual(await state(target),before);
    await target.locator('#takeHotspot').click();await close.click();assert.equal(await target.locator('#dashboard.active').count(),1);assert.deepEqual(await state(target),before);
    geometry.push({viewport,mode,fallback,...metrics});
   }
  }
  fs.writeFileSync(path.join(out,'visual-apple-close-geometry.json'),JSON.stringify(geometry,null,2));
 });
 // Explicitly permit only the three existing public artwork URLs. This does not
 // loosen the suite's default third-party request block or send classroom data.
 const assetProof=[];
 for(const asset of ASSETS){const response=await fetch(asset.url);assert.equal(response.status,200,asset.file);const bytes=Buffer.from(await response.arrayBuffer());const actual=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(actual,asset.sha256,asset.file+' retains the verified original bytes');assetProof.push({...asset,status:response.status,bytes:bytes.length});}
 fs.writeFileSync(path.join(out,'visual-fall-asset-proof.json'),JSON.stringify(assetProof,null,2));
 for(const published of [false,true])await scenario('Fall Leaves actual external artwork '+(published?'on the published app':'on the candidate'),async(page,context)=>{
  const responses=[];page.on('response',response=>{if(ASSETS.some(asset=>asset.url===response.url()))responses.push({url:response.url(),status:response.status()});});
  for(const asset of ASSETS)await context.route(asset.url,route=>route.continue());
  if(published){
   await context.route(LIVE+'**',route=>route.continue());await page.goto(LIVE);await page.evaluate(value=>localStorage.setItem('littleAttendanceCleanV4',JSON.stringify(value)),fixture('fall-leaves'));await page.reload();await page.waitForFunction(()=>editingLockHeld);await page.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});
  }else await seed(page,fixture('fall-leaves'));
  for(const viewport of [{width:1024,height:768},{width:1280,height:720},{width:1671,height:941}]){
   await page.setViewportSize(viewport);await page.locator('#takeHotspot').click();await page.locator('#fallLeavesAttendance.active').waitFor();
   const decoded=await page.evaluate(async assets=>Promise.all(assets.map(async asset=>{const image=new Image();image.src=asset.url;await image.decode();return{file:asset.file,width:image.naturalWidth,height:image.naturalHeight};})),ASSETS);
   assert.deepEqual(decoded,ASSETS.map(({file,width,height})=>({file,width,height})));
   const actual=await page.locator('.fall-la-board,.fall-la-child.waiting,.fall-la-child.here').evaluateAll(elements=>elements.map(element=>({className:element.className,background:getComputedStyle(element).backgroundImage})));
   assert.equal(actual.length,3);for(const entry of actual)assert.ok(ASSETS.some(asset=>entry.background.includes(asset.url)));
   await page.screenshot({path:path.join(out,'visual-fall-'+(published?'published':'candidate')+'-'+viewport.width+'.png')});
   const before=await state(page);await page.locator('#fallLeavesClose').click();assert.equal(await page.locator('#dashboard.active').count(),1);assert.deepEqual(await state(page),before);
  }
  for(const asset of ASSETS)assert.ok(responses.some(response=>response.url===asset.url&&response.status===200),'Browser loads '+asset.file);
  fs.writeFileSync(path.join(out,'visual-fall-'+(published?'published':'candidate')+'-responses.json'),JSON.stringify(responses,null,2));
 });
};
