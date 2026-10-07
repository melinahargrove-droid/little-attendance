const {openClassroom,openAttendanceControls}=require('./navigation-helper.cjs');
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
 const url=process.env.TARGET_URL||('http://127.0.0.1:'+server.address().port);
 if(process.env.TARGET_URL){
  assert.equal(url,'https://melinahargrove-droid.github.io/little-attendance/','Only the approved existing app may be live-tested');
  const crypto=require('node:crypto'),proof=[];
  for(const file of ['index.html','app.js','app.css','apple-adapter.js','apple-adapter.css','bus-adapter.js','bus-adapter.css','restored-theme-layouts.js','restored-themes.js','restored-themes.css','themes/school-bus/background.png','themes/school-bus/thumbnail.png','themes/school-bus/bus-approved-layout.json','assets/home-two-actions.png','assets/one-little-teacher-logo.png','themes/apple-orchard/background.png','themes/apple-orchard/basket-apple.png','themes/apple-orchard/waiting-apple.png','themes/apple-orchard/thumbnail.png','themes/apple-orchard/theme-config.json']){
   const response=await fetch(url+file);assert.equal(response.status,200,file);
   const live=Buffer.from(await response.arrayBuffer()),expected=fs.readFileSync(path.join(root,file));
   const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
   assert.equal(hash(live),hash(expected),'Published bytes must match checked-out commit: '+file);proof.push({file,sha256:hash(live),bytes:live.length});
  }
  fs.writeFileSync(path.join(out,'live-byte-proof.json'),JSON.stringify(proof,null,2));
 }
 const browserType=process.env.BROWSER==='webkit'?webkit:chromium;
 const browser=await browserType.launch({headless:true});
 const results=[];
 async function scenario(name,fn){const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));context.on('page',other=>other.on('pageerror',e=>errors.push(e.message)));await context.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());try{await fn(page,context);assert.deepEqual(errors,[],name+' has no page errors');results.push({name,pass:true});console.log('PASS '+name);}finally{await context.close();}}
 const seed=async(page,value)=>{await page.goto(url);await page.evaluate(({KEY,value})=>{localStorage.setItem(KEY,JSON.stringify(value));},{KEY,value});await page.reload();await page.waitForFunction(()=>editingLockHeld);await page.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});};
 const state=page=>page.evaluate(()=>JSON.parse(JSON.stringify(data)));
 const namesHere=async page=>{const s=await state(page);return s.roster.filter(c=>s.present.includes(c.id)).map(c=>c.name).sort();};
 try{
 await require('./restored-themes-browser.cjs')({scenario,seed,state,out});
 await require('./pumpkin-mask-browser.cjs')({scenario,seed,state,out});
 await require('./apple-mask-browser.cjs')({scenario,seed,state,out});
 await require('./review-frame-browser.cjs')({scenario,seed,state,out});
 await require('./home-browser.cjs')({scenario,seed,state,out});
 await require('./theme-preview-browser.cjs')({scenario,seed,state,out});
 await require('./visual-controls-browser.cjs')({scenario,seed,state,out});
 await require('./fall-source-browser.cjs')({scenario,seed,state,out});
 await require('./fall-fullscreen-browser.cjs')({scenario,seed,state,out});
 await require('./bus-browser.cjs')({scenario,seed,state,out});
 await require('./bus-label-review.cjs')({scenario,seed,state,out});
 await require('./storage-browser.cjs')({scenario,seed,state,out});
 await require('./attendance-days-browser.cjs')({scenario,seed,state,out});
 await require('./single-writer-browser.cjs')({scenario,seed,state,out});
 await scenario('migration, real roster controls, cancelled dialogs, stable undo and reload',async(page)=>{
  const old=fixture();await seed(page,old);const original=JSON.stringify(old);await page.locator('#classHotspot').click();
  await page.locator('#addFriendBtn').click();await page.locator('#friendName').fill('QA Cancel');await page.locator('#cancelFriend').click();assert.equal((await state(page)).roster.length,3);
  await page.locator('#addFriendBtn').click();await page.locator('#friendName').fill('QA New');await page.locator('#saveFriend').click();assert.deepEqual(await namesHere(page),['QA Alpha','QA Gamma']);
  await page.getByRole('button',{name:'Edit QA Alpha',exact:true}).click();await page.locator('#friendName').fill('QA Alpha Renamed');await page.locator('#saveFriend').click();
  await page.getByRole('button',{name:'Move QA Gamma up',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove QA Beta',exact:true}).click();assert.deepEqual(await namesHere(page),['QA Alpha Renamed','QA Gamma']);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),BACKUP),original);
  await page.reload();await openAttendanceControls(page);await page.locator('#undoBtn').click();assert.equal((await state(page)).roster.length,4);assert.deepEqual(await namesHere(page),['QA Alpha Renamed','QA Gamma']);await page.locator('#undoBtn').click();assert.equal((await state(page)).roster.length,3);await page.locator('#undoBtn').click();assert.deepEqual(await namesHere(page),['QA Alpha Renamed']);await page.locator('#closeTeacher').click();
  await openClassroom(page);await page.locator('#className').fill('QA Immediate Reload');await page.reload();assert.equal((await state(page)).className,'QA Immediate Reload');
 });
 await scenario('paste list preview, cancel, Escape, append, duplicates, reload and undo',async(page)=>{
  const old=fixture();await seed(page,old);const raw=JSON.stringify(old),before=await state(page);await page.locator('#classHotspot').click();
  await page.getByRole('button',{name:'Paste a list',exact:true}).click();await page.locator('#pastedNames').fill("QA Renée\nQA O’Neil\nQA Anne-Marie");
  assert.equal(await page.locator('#pasteListPreview li').count(),3);assert.deepEqual(await state(page),before);assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),raw);
  await page.locator('#cancelPasteList').click();assert.deepEqual(await state(page),before);assert.equal(await page.locator('#pasteListBtn').evaluate(e=>e===document.activeElement),true);
  await page.locator('#pasteListBtn').click();assert.equal(await page.locator('#pastedNames').inputValue(),'');await page.locator('#pastedNames').fill('QA Escape');await page.keyboard.press('Escape');assert.deepEqual(await state(page),before);
  await page.locator('#pasteListBtn').click();await page.locator('#pastedNames').fill("  QA Renée\n\nQA O’Neil\nQA Anne-Marie  ");await page.keyboard.press('Tab');assert.equal(await page.locator('#cancelPasteList').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.locator('#savePasteList').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');
  const added=await state(page);assert.deepEqual(added.roster.slice(0,3),before.roster);assert.deepEqual(added.present,before.present);assert.deepEqual(added.history,before.history);assert.equal(added.roster.length,6);assert.equal(new Set(added.roster.map(c=>c.id)).size,6);assert.equal(await page.evaluate(key=>localStorage.getItem(key),BACKUP),raw);
  await page.locator('#pasteListBtn').click();await page.locator('#pastedNames').fill('QA Alpha\nQA Same\nQA Same');assert.equal(await page.locator('#savePasteList').isDisabled(),true);assert.equal(await page.locator('#pasteListPreview small').count(),3);
  await page.screenshot({path:path.join(out,'paste-duplicate-review.png')});await page.locator('#confirmDuplicateNames').check();await page.locator('#savePasteList').click();assert.equal((await state(page)).roster.length,9);assert.equal(new Set((await state(page)).roster.map(c=>c.id)).size,9);
  await page.reload();assert.equal((await state(page)).roster.length,9);await openAttendanceControls(page);await page.locator('#undoBtn').click();assert.equal((await state(page)).roster.length,6);await page.locator('#undoBtn').click();assert.equal((await state(page)).roster.length,3);await page.locator('#undoBtn').click();assert.deepEqual(await namesHere(page),['QA Alpha']);
 });
 await scenario('paste list responsive preview, long names, limits and literal text',async(page)=>{
  for(const viewport of [{width:1280,height:720},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:320,height:568}]){
   await page.setViewportSize(viewport);await seed(page,fixture({roster:[],present:[],history:[]}));await page.locator('#classHotspot').click();await page.locator('#pasteListBtn').click();
   assert.equal(await page.locator('#pastedNames').evaluate(e=>e===document.activeElement),true);
   await page.locator('#pastedNames').fill("QA Renée-José\nQA O’Neil\n<b>QA Literal</b>\nQA Last, First\n"+'Q'.repeat(40));
   assert.equal(await page.locator('#pasteListPreview b').count(),0);assert.equal(await page.locator('#pasteListPreview li').count(),5);
   const bounds=await page.locator('#pasteListDialog').evaluate(e=>({w:e.getBoundingClientRect().width,client:e.clientWidth,scroll:e.scrollWidth}));assert.ok(bounds.w<=viewport.width);assert.ok(bounds.scroll<=bounds.client+1,'No horizontal scroll in paste dialog');
   const saveBounds=await page.locator('#savePasteList').boundingBox();assert.ok(saveBounds.y>=0&&saveBounds.y+saveBounds.height<=viewport.height,'Save stays visible while preview content scrolls');await page.screenshot({path:path.join(out,'paste-preview-'+viewport.width+'.png')});await page.locator('#savePasteList').click();assert.equal((await state(page)).roster.length,5);
   await page.locator('#pasteListBtn').click();await page.locator('#pastedNames').fill('Q'.repeat(41));assert.equal(await page.locator('#savePasteList').isDisabled(),true);assert.match(await page.locator('#pasteListError').textContent(),/40 characters/);await page.locator('#cancelPasteList').click();
  }
  await seed(page,fixture({roster:Array.from({length:29},(_,i)=>'QA '+i),present:[],history:[]}));await page.locator('#classHotspot').click();await page.locator('#pasteListBtn').click();await page.locator('#pastedNames').fill('QA Overflow One\nQA Overflow Two');assert.equal(await page.locator('#savePasteList').isDisabled(),true);assert.equal((await state(page)).roster.length,29);
  await page.locator('#pastedNames').fill('QA Final');await page.locator('#savePasteList').click();assert.equal((await state(page)).roster.length,30);
 });
 await scenario('paste list storage failure shows unsaved session state without losing existing data',async(page)=>{
  await seed(page,fixture());const before=await state(page),raw=await page.evaluate(key=>localStorage.getItem(key),KEY);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});await page.locator('#classHotspot').click();await page.locator('#pasteListBtn').click();await page.locator('#pastedNames').fill('QA Unsaved One\nQA Unsaved Two');await page.locator('#savePasteList').click();
  assert.equal(await page.locator('#storageWarning').isVisible(),true);assert.equal(await page.locator('#autosaveText').textContent(),'Not saved');assert.match(await page.locator('#toast').textContent(),/only in this session/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),raw);assert.deepEqual((await state(page)).present,before.present);assert.equal((await state(page)).roster.length,5);
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
   await page.setViewportSize(viewport);await seed(page,fixture({selectedTheme:'apple-orchard',roster:Array.from({length:30},(_,i)=>'QA Tap '+i),present:[],history:[]}));await page.locator('#takeHotspot').click();await page.locator('#appleWaitLayer button').first().waitFor();await page.locator('.apple-la-bg').evaluate(image=>image.decode());await page.evaluate(async()=>{const image=new Image();image.src='themes/apple-orchard/waiting-apple.png';await image.decode();});await page.screenshot({path:path.join(out,'apple-'+viewport.width+'-waiting.png')});
   for(let i=0;i<30;i++){await page.getByRole('button',{name:'Mark here QA Tap '+i,exact:true}).click();await page.getByRole('button',{name:'Return QA Tap '+i,exact:true}).waitFor();assert.equal((await state(page)).present.length,i+1);}
   await page.screenshot({path:path.join(out,'apple-'+viewport.width+'-here.png')});
  }
 });
 await scenario('saved markup-like names are literal across every board',async(page)=>{
  const name='<img src=x onerror="window.QAInjected=true"> & QA';
  for(const selectedTheme of ['school-bus','fall-leaves','apple-orchard']){
   await seed(page,fixture({selectedTheme,roster:[name],present:[],history:[]}));await page.locator('#takeHotspot').click();const selector=selectedTheme==='apple-orchard'?'.apple-la-name':selectedTheme==='fall-leaves'?'.fall-la-name':'.bus-la-child.waiting .bus-la-name';await page.locator(selector).waitFor();assert.equal(await page.locator(selector).textContent(),name);assert.equal(await page.evaluate(()=>window.QAInjected),undefined);assert.equal(await page.locator('#studentGrid img,#fallLeavesZone img,#appleWaitLayer img').count(),0);
  }
 });
 await scenario('blocked storage stays usable and cannot report a successful save',async(page)=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});await page.goto(url);await page.locator('#classHotspot').click();await page.locator('#addFriendBtn').click();await page.locator('#friendName').fill('QA Unsaved');await page.locator('#saveFriend').click();assert.equal(await page.locator('#storageWarning').isVisible(),true);assert.equal(await page.locator('#autosaveText').textContent(),'Not saved');await page.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});await page.locator('#classroomAttendance').click();assert.equal((await state(page)).selectedTheme,'our-friends');assert.equal(await page.locator('#ourFriendsWaiting button').count(),1);
 });
 await scenario('slow Apple config cannot reopen after Close and failed fetch has usable fallback',async(page,context)=>{
  let release,started;const requested=new Promise(resolve=>{started=resolve;});await context.route('**/theme-config.json',async route=>{await new Promise(r=>{release=r;started();});await route.continue();});await seed(page,fixture({selectedTheme:'apple-orchard'}));await page.locator('#takeHotspot').click();await page.waitForFunction(()=>document.querySelector('#appleAttendance.active'));await page.locator('#appleClose').click();await requested;release();await page.waitForLoadState('networkidle');assert.equal(await page.locator('#dashboard.active').count(),1);
  await context.unroute('**/theme-config.json');await context.route('**/theme-config.json',route=>route.abort());await page.reload();await page.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});await page.locator('#takeHotspot').click();await page.locator('#attendance.active').waitFor();assert.equal(await page.locator('#studentGrid button').count(),3);await page.locator('#teacherBtn').click();await page.locator('#undoBtn').click();assert.equal(await page.locator('#hereCount').textContent(),'1');page.once('dialog',d=>d.accept());await page.locator('#resetBtn').click();assert.equal(await page.locator('#hereCount').textContent(),'0');
 });
 }finally{
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({engine:process.env.BROWSER||'chromium',scope:process.env.TARGET_URL?'Published Pages app in fresh isolated browser contexts; fictional QA rosters only':'Isolated localhost plus published Fall artwork check; fictional QA rosters only',results},null,2));await browser.close();server.close();
 }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
