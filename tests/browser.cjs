// Browser-engine regression suite. Uses only synthetic classroom data on localhost.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results');
fs.mkdirSync(out,{recursive:true});
const KEY='littleAttendanceCleanV4',BACKUP=KEY+'_beforeStableIds';
const fixture=(extra={})=>({className:'QA Synthetic Class',roster:['QA Alpha','QA Beta','QA Gamma'],present:[0,2],history:[0,2],selectedTheme:'school-bus',ownedThemes:['school-bus','apple-orchard','fall-leaves'],...extra});
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(root,rel||'index.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'}[path.extname(file)]||'text/plain';res.writeHead(200,{'Content-Type':mime});res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 const browserType=process.env.BROWSER==='webkit'?webkit:chromium;
 const browser=await browserType.launch({headless:true});
 const results=[];
 async function scenario(name,fn){const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());try{await fn(page,context);assert.deepEqual(errors,[],name+' has no page errors');results.push({name,pass:true});console.log('PASS '+name);}finally{await context.close();}}
 const seed=async(page,value)=>{await page.goto(url);await page.evaluate(({KEY,value})=>{localStorage.setItem(KEY,JSON.stringify(value));},{KEY,value});await page.reload();};
 const state=page=>page.evaluate(()=>JSON.parse(JSON.stringify(data)));
 const namesHere=async page=>{const s=await state(page);return s.roster.filter(c=>s.present.includes(c.id)).map(c=>c.name).sort();};
 try{
 await scenario('approved home art, three controls, keyboard, navigation and resize',async(page)=>{
  await seed(page,fixture());const image=await page.locator('.dashboard-stage').evaluate(async el=>{const css=getComputedStyle(el).backgroundImage;const img=new Image();img.src=css.slice(5,-2);await img.decode();return{width:img.naturalWidth,height:img.naturalHeight};});assert.deepEqual(image,{width:1920,height:1080});
  await page.screenshot({path:path.join(out,'home-desktop.png')});
  await page.getByRole('button',{name:'My Classroom',exact:true}).click();assert.equal(await page.locator('#classroom').evaluate(e=>e.classList.contains('active')),true);
  await page.locator('#classBack').click();await page.locator('#takeHotspot').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#attendance.active').count(),1);
  await page.locator('#homeBtn').click();await page.locator('#teacherHotspot').click();assert.equal(await page.locator('#teacherDialog').evaluate(e=>e.open),true);await page.locator('#closeTeacher').click();
  await page.setViewportSize({width:768,height:1024});await page.screenshot({path:path.join(out,'home-portrait.png')});await page.locator('#classHotspot').click();assert.equal(await page.locator('#classroom.active').count(),1);
 });
 await scenario('home remains visibly usable when approved artwork cannot load',async(page,context)=>{
  await context.route('**/assets/home-approved.png',route=>route.abort());await seed(page,fixture());assert.equal(await page.locator('.dashboard-stage').evaluate(e=>e.classList.contains('art-ready')),false);for(const id of ['takeHotspot','classHotspot','teacherHotspot'])assert.notEqual(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).color),'rgba(0, 0, 0, 0)');await page.screenshot({path:path.join(out,'home-art-fallback.png')});await page.locator('#classHotspot').click();assert.equal(await page.locator('#classroom.active').count(),1);
 });
 await scenario('migration, real roster controls, cancelled dialogs, stable undo and reload',async(page)=>{
  const old=fixture();await seed(page,old);const original=JSON.stringify(old);await page.locator('#classHotspot').click();
  await page.locator('#addFriendBtn').click();await page.locator('#friendName').fill('QA Cancel');await page.locator('#cancelFriend').click();assert.equal((await state(page)).roster.length,3);
  await page.locator('#addFriendBtn').click();await page.locator('#friendName').fill('QA New');await page.locator('#saveFriend').click();assert.deepEqual(await namesHere(page),['QA Alpha','QA Gamma']);
  await page.getByRole('button',{name:'Edit QA Alpha',exact:true}).click();await page.locator('#friendName').fill('QA Alpha Renamed');await page.locator('#saveFriend').click();
  await page.getByRole('button',{name:'Move QA Gamma up',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove QA Beta',exact:true}).click();assert.deepEqual(await namesHere(page),['QA Alpha Renamed','QA Gamma']);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),BACKUP),original);
  await page.reload();await page.locator('#teacherHotspot').click();await page.locator('#undoBtn').click();assert.deepEqual(await namesHere(page),['QA Alpha Renamed']);await page.locator('#closeTeacher').click();
  await page.locator('#classHotspot').click();await page.locator('#className').fill('QA Immediate Reload');await page.reload();assert.equal((await state(page)).className,'QA Immediate Reload');
 });
 await scenario('Apple Orchard full-class physical taps reach every child, with accessible names',async(page)=>{
  for(const size of [10,15,20,25,30]){
   await seed(page,fixture({selectedTheme:'apple-orchard',roster:Array.from({length:size},(_,i)=>'QA Friend '+String(i+1).padStart(2,'0')),present:[],history:[]}));await page.locator('#takeHotspot').click();await page.locator('#appleWaitLayer button').first().waitFor();
   assert.deepEqual(await page.locator('.apple-la-bg').evaluate(async image=>{await image.decode();return [image.naturalWidth,image.naturalHeight];}),[1672,941]);
   for(const name of ['waiting-apple.png','basket-apple.png'])assert.equal(await page.evaluate(async name=>{const image=new Image();image.src='themes/apple-orchard/'+name;await image.decode();return image.naturalWidth>0;},name),true);
   assert.equal(await page.locator('#appleHereLayer').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
   // Each click is hit-tested by the browser. No force clicks or dispatchEvent.
   for(let i=1;i<=size;i++){
    const name='QA Friend '+String(i).padStart(2,'0');await page.getByRole('button',{name:'Mark here '+name,exact:true}).click();await page.getByRole('button',{name:'Return '+name,exact:true}).waitFor();assert.equal((await state(page)).present.length,i);
   }
   assert.equal(await page.locator('#appleHereCount').textContent(),String(size));await page.screenshot({path:path.join(out,'apple-'+size+'-here.png')});
   await page.locator('#appleTeacher').click();await page.locator('#undoBtn').click();await page.locator('#closeTeacher').click();assert.equal((await state(page)).present.length,size-1);
   await page.locator('#appleClose').click();await page.locator('#takeHotspot').click();await page.locator('#appleHereLayer button').first().waitFor();assert.equal((await state(page)).present.length,size-1);
   await page.locator('#appleTeacher').click();page.once('dialog',d=>d.accept());await page.locator('#resetBtn').click();await page.waitForFunction(()=>document.querySelector('#appleHereLayer').children.length===0);assert.equal((await state(page)).history.length,0);
   await page.screenshot({path:path.join(out,'apple-'+size+'-waiting.png')});
  }
 });
 await scenario('Apple Orchard tap coverage at audited and tablet landscape sizes',async(page)=>{
  for(const viewport of [{width:1181,height:757},{width:1024,height:768}]){
   await page.setViewportSize(viewport);await seed(page,fixture({selectedTheme:'apple-orchard',roster:Array.from({length:30},(_,i)=>'QA Tap '+i),present:[],history:[]}));await page.locator('#takeHotspot').click();await page.locator('#appleWaitLayer button').first().waitFor();await page.screenshot({path:path.join(out,'apple-'+viewport.width+'-waiting.png')});
   for(let i=0;i<30;i++){await page.getByRole('button',{name:'Mark here QA Tap '+i,exact:true}).click();await page.getByRole('button',{name:'Return QA Tap '+i,exact:true}).waitFor();assert.equal((await state(page)).present.length,i+1);}
   await page.screenshot({path:path.join(out,'apple-'+viewport.width+'-here.png')});
  }
 });
 await scenario('saved markup-like names are literal across every board',async(page)=>{
  const name='<img src=x onerror="window.QAInjected=true"> & QA';
  for(const selectedTheme of ['school-bus','fall-leaves','apple-orchard']){
   await seed(page,fixture({selectedTheme,roster:[name],present:[],history:[]}));await page.locator('#takeHotspot').click();const selector=selectedTheme==='apple-orchard'?'.apple-la-name':selectedTheme==='fall-leaves'?'.fall-la-name':'.student .name';await page.locator(selector).waitFor();assert.equal(await page.locator(selector).textContent(),name);assert.equal(await page.evaluate(()=>window.QAInjected),undefined);assert.equal(await page.locator('#studentGrid img,#fallLeavesZone img,#appleWaitLayer img').count(),0);
  }
 });
 await scenario('blocked storage stays usable and cannot report a successful save',async(page)=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});await page.goto(url);await page.locator('#classHotspot').click();await page.locator('#addFriendBtn').click();await page.locator('#friendName').fill('QA Unsaved');await page.locator('#saveFriend').click();assert.equal(await page.locator('#storageWarning').isVisible(),true);assert.equal(await page.locator('#autosaveText').textContent(),'Not saved');await page.locator('#classroomAttendance').click();assert.equal(await page.locator('#studentGrid button').count(),1);
 });
 await scenario('slow Apple config cannot reopen after Close and failed fetch has usable fallback',async(page,context)=>{
  let release,started;const requested=new Promise(resolve=>{started=resolve;});await context.route('**/theme-config.json',async route=>{await new Promise(r=>{release=r;started();});await route.continue();});await seed(page,fixture({selectedTheme:'apple-orchard'}));await page.locator('#takeHotspot').click();await page.waitForFunction(()=>document.querySelector('#appleAttendance.active'));await page.locator('#appleClose').click();await requested;release();await page.waitForLoadState('networkidle');assert.equal(await page.locator('#dashboard.active').count(),1);
  await context.unroute('**/theme-config.json');await context.route('**/theme-config.json',route=>route.abort());await page.reload();await page.locator('#takeHotspot').click();await page.locator('#attendance.active').waitFor();assert.equal(await page.locator('#studentGrid button').count(),3);await page.locator('#teacherBtn').click();await page.locator('#undoBtn').click();assert.equal(await page.locator('#hereCount').textContent(),'1');page.once('dialog',d=>d.accept());await page.locator('#resetBtn').click();assert.equal(await page.locator('#hereCount').textContent(),'0');
 });
 }finally{
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({engine:process.env.BROWSER||'chromium',scope:'Isolated localhost; fictional QA rosters only',results},null,2));await browser.close();server.close();
 }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
