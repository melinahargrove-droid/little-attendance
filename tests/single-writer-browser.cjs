// Native Web Locks and localStorage in two same-origin pages in ONE browser
// storage partition. Separate Playwright BrowserContexts would not share either.
const assert=require('node:assert/strict'),path=require('node:path');
const KEY='littleAttendanceCleanV4';
const fixture=()=>({schemaVersion:1,className:'QA Native Lock Class',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:['qa-a'],history:['qa-a'],selectedTheme:'school-bus',ownedThemes:['school-bus','apple-orchard']});
module.exports=async({scenario,seed,state,out})=>{
 const held=page=>page.waitForFunction(()=>editingLockHeld);
 const settled=page=>page.waitForFunction(()=>!['pending','requesting'].includes(editingLockState));
 const raw=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
 async function second(page,context){const other=await context.newPage();await other.goto(page.url());await settled(other);await other.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});return other;}
 await scenario('native lock: concurrent requests and broadcast-triggered edit attempts have exactly one writer',async(page,context)=>{
  await seed(page,fixture());const url=page.url();await page.goto('about:blank');const other=await context.newPage();await Promise.all([page.goto(url),other.goto(url)]);await Promise.all([settled(page),settled(other)]);
  const owns=await Promise.all([page.evaluate(()=>editingLockHeld),other.evaluate(()=>editingLockHeld)]);assert.equal(owns.filter(Boolean).length,1);const owner=owns[0]?page:other,reader=owns[0]?other:page,beforeReader=await state(reader);
  await Promise.all([owner,reader].map(p=>p.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();window.qaRace=new BroadcastChannel('qa-native-write-race');window.qaAttempts=[];window.qaRace.onmessage=event=>{const owner=editingLockHeld;const result=setChildPresent(owner?'qa-b':'qa-a',owner?event.data:false);window.qaAttempts.push({owner,result,present:[...data.present]});};})));
  for(let i=0;i<12;i++){
   await owner.evaluate(value=>{const signal=new BroadcastChannel('qa-native-write-race');signal.postMessage(value);signal.close();},i%2===0);
   await Promise.all([owner,reader].map(p=>p.waitForFunction(count=>window.qaAttempts.length===count,i+1)));
   assert.deepEqual(JSON.parse(await raw(owner)).present,i%2===0?['qa-a','qa-b']:['qa-a']);assert.deepEqual(await state(reader),beforeReader);
  }
  const attempts=await Promise.all([owner,reader].map(p=>p.evaluate(()=>qaAttempts)));assert.ok(attempts[0].every(a=>a.owner&&a.result===true));assert.ok(attempts[1].every(a=>!a.owner&&a.result===null));assert.notEqual(await reader.locator('#autosaveText').textContent(),'Saved automatically');
  const saved=await raw(owner);await reader.evaluate(()=>{setChildPresent('qa-a',false);autosaveClassroom();save();});assert.equal(await raw(owner),saved);
  await owner.reload();await held(owner);assert.deepEqual((await state(owner)).present,['qa-a']);assert.equal(await reader.evaluate(()=>editingLockHeld),false);
  await reader.screenshot({path:path.join(out,'single-writer-readonly.png')});
 });
 await scenario('native lock: owner close releases ownership; refresh and current-snapshot retry keep saved data',async(page,context)=>{
  await seed(page,fixture());const other=await second(page,context),before=await state(other);assert.equal(await other.evaluate(()=>editingLockHeld),false);await page.close();await other.locator('#retrySave').click();await held(other);assert.deepEqual(await state(other),before);
  await other.evaluate(()=>setChildPresent('qa-b',true));const saved=await raw(other);await other.reload();await held(other);assert.equal(await raw(other),saved);assert.deepEqual((await state(other)).present,['qa-a','qa-b']);
 });
 await scenario('native lock: stale reader cannot become writer after owner closes; draft survives retry until explicit reload',async(page,context)=>{
  await seed(page,fixture());const other=await second(page,context);await other.locator('#classHotspot').click();await other.locator('#pasteListBtn').click();await other.locator('#pastedNames').fill('QA Pending Draft');const before=await state(other);
  await page.evaluate(()=>setChildPresent('qa-b',true));const saved=await raw(page);await page.close();await other.locator('#pasteListDialog .storage-warning-dialog button').click();await other.waitForFunction(()=>editingLockState==='stale');assert.deepEqual(await state(other),before);assert.equal(await other.locator('#pastedNames').inputValue(),'QA Pending Draft');assert.equal(await raw(other),saved);assert.equal(await other.evaluate(()=>editingLockHeld),false);
  await other.locator('#savePasteList').evaluate(e=>e.click());assert.deepEqual(await state(other),before);await other.reload();await held(other);assert.deepEqual((await state(other)).present,['qa-a','qa-b']);
 });
 await scenario('native lock: dirty owner keeps ownership through failed save and cancelled unload',async(page,context)=>{
  await seed(page,fixture());const other=await second(page,context);await page.locator('#classHotspot').click();await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('Synthetic full storage');};});await page.locator('#className').fill('QA Unsaved Owner');const dirty=await state(page),saved=await raw(page);
  await other.locator('#retrySave').click();await settled(other);assert.equal(await other.evaluate(()=>editingLockHeld),false);await other.evaluate(()=>setChildPresent('qa-b',true));assert.equal(await raw(other),saved);
  const event=page.waitForEvent('dialog'),reload=page.reload({timeout:5000}).catch(()=>{}),dialog=await event;assert.equal(dialog.type(),'beforeunload');await dialog.dismiss();await reload;assert.equal(await page.evaluate(()=>editingLockHeld),true);assert.deepEqual(await state(page),dirty);
  await page.evaluate(()=>{Storage.prototype.setItem=qaSetItem;});await page.locator('#retrySave').click();assert.deepEqual(JSON.parse(await raw(page)),dirty);assert.equal(await page.evaluate(()=>unsavedChanges),false);
 });
 await scenario('native lock: pending acquisition blocks autosave, attendance, history and migration writes',async(page)=>{
  await seed(page,fixture());await page.addInitScript(()=>{const request=navigator.locks.request.bind(navigator.locks);navigator.locks.request=(...args)=>new Promise((resolve,reject)=>{window.qaGrantLock=()=>request(...args).then(resolve,reject);});});await page.reload();const before=await state(page),saved=await raw(page);
  await page.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();setChildPresent('qa-b',true);undoAttendance();resetAttendance();removeFriend('qa-a');moveFriend('qa-a',1);autosaveClassroom();save();document.querySelector('#saveAttendanceHistory').checked=true;document.querySelector('#saveAttendanceHistory').dispatchEvent(new Event('change'));});assert.deepEqual(await state(page),before);assert.equal(await raw(page),saved);assert.equal(await page.evaluate(key=>localStorage.getItem(key+'_beforeAttendanceDays'),KEY),null);assert.equal(await page.locator('#autosaveText').textContent(),'Read only');
  await page.evaluate(()=>{qaGrantLock();});await held(page);await page.evaluate(()=>setChildPresent('qa-b',true));assert.deepEqual(JSON.parse(await raw(page)).present,['qa-a','qa-b']);
 });
 for(const kind of ['unsupported','rejected'])await scenario('native browser: '+kind+' lock API fails closed with readable classroom and no writes',async page=>{
  await seed(page,fixture());await page.addInitScript(kind=>{Object.defineProperty(navigator,'locks',{value:kind==='unsupported'?undefined:{request:()=>Promise.reject(new DOMException('Denied','SecurityError'))}});},kind);await page.reload();await settled(page);const before=await state(page),saved=await raw(page);
  await page.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();setChildPresent('qa-b',true);undoAttendance();resetAttendance();removeFriend('qa-a');moveFriend('qa-a',1);save();});assert.deepEqual(await state(page),before);assert.equal(await raw(page),saved);assert.match(await page.locator('#storageWarning').textContent(),/Read only/);assert.equal(await page.locator('#autosaveText').textContent(),'Read only');assert.equal(await page.evaluate(key=>localStorage.getItem(key+'_beforeAttendanceDays'),KEY),null);
  await page.locator('#classHotspot').click();assert.equal(await page.locator('#friendGrid .friend-card').count(),2);await page.locator('#classroomTeacher').click();assert.equal(await page.locator('#teacherDialog .storage-warning-dialog').isVisible(),true);
 });
 await scenario('native browser: asynchronous theme read cannot commit after page lifecycle releases ownership',async page=>{
  await seed(page,fixture());const before=await state(page),saved=await raw(page);await page.evaluate(()=>{Object.defineProperty(document.querySelector('#themeFile'),'files',{value:[{text:()=>new Promise(resolve=>{window.qaFinishTheme=resolve;})}]});window.qaThemePending=document.querySelector('#themeFile').onchange({target:document.querySelector('#themeFile')});window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
  await page.waitForFunction(()=>!editingLockHeld);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await held(page);await page.evaluate(async()=>{qaFinishTheme(JSON.stringify({themeIds:['penguin-pals']}));await qaThemePending;});assert.deepEqual(await state(page),before);assert.equal(await raw(page),saved);
 });
 await scenario('native browser: read-only saved attendance remains viewable and printable',async(page,context)=>{
  await seed(page,fixture());await page.locator('#teacherHotspot').click();await page.locator('#saveAttendanceHistory').check();const other=await second(page,context),before=await state(other),saved=await raw(other);await other.locator('#teacherHotspot').click();await other.locator('#viewAttendanceHistory').click();assert.equal(await other.locator('#attendanceHistoryRows tr').count(),2);await other.evaluate(()=>{window.print=()=>{window.qaPrints=(window.qaPrints||0)+1;};});await other.locator('#printAttendanceRecord').click();assert.equal(await other.evaluate(()=>qaPrints),1);assert.equal(await other.locator('#attendancePrint td').count(),4);assert.deepEqual(await state(other),before);assert.equal(await raw(other),saved);assert.equal(await other.evaluate(()=>editingLockHeld),false);await other.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await other.locator('#attendanceHistoryDialog').isVisible(),true);
 });
 await scenario('native navigation: back after another tab edits cannot revive a stale writer',async(page,context)=>{
  await seed(page,fixture());const other=await second(page,context),original=await state(page);await page.locator('#classHotspot').click();await page.locator('#pasteListBtn').click();await page.locator('#pastedNames').fill('QA Navigation Draft');await page.evaluate(()=>{window.qaOriginalDocument=true;window.addEventListener('pageshow',event=>{window.qaActualPersisted=event.persisted;});});
  await page.goto(new URL('README.md',page.url()).href);await other.locator('#retrySave').click();await held(other);await other.evaluate(()=>setChildPresent('qa-b',true));const saved=await raw(other);await page.goBack();await settled(page);const restored=await page.evaluate(()=>Boolean(window.qaOriginalDocument)),persisted=await page.evaluate(()=>Boolean(window.qaActualPersisted));
  assert.equal(await page.evaluate(()=>editingLockHeld),false);assert.equal(await raw(page),saved);if(restored){assert.deepEqual(await state(page),original);assert.equal(await page.locator('#pastedNames').inputValue(),'QA Navigation Draft');}else assert.deepEqual((await state(page)).present,['qa-a','qa-b']);
  await page.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();setChildPresent('qa-a',false);save();});assert.equal(await raw(page),saved);require('node:fs').writeFileSync(path.join(out,'single-writer-navigation.json'),JSON.stringify({engine:process.env.BROWSER||'chromium',actualNavigateBack:true,restoredDocument:restored,persisted,bfcacheClaim:persisted?'Actual BFCache restore exercised':'Fresh-load back navigation; BFCache restoration not established'},null,2));
 });
 for(const theme of ['school-bus','apple-orchard','fall-leaves'])await scenario('native readonly navigation: '+theme+' Close and history stay physically reachable',async(page,context)=>{
  await seed(page,{...fixture(),selectedTheme:theme});const other=await second(page,context),measurements=[],saved=await raw(page);
  for(const viewport of [{width:1280,height:720},{width:1024,height:768}]){
   await other.setViewportSize(viewport);await other.locator('#takeHotspot').click();const close=other.locator(theme==='school-bus'?'#busClose':theme==='apple-orchard'?'#appleClose':'#fallLeavesClose');await close.waitFor();await other.locator('#storageWarning').waitFor();
   const geometry=await close.evaluate(button=>{const box=button.getBoundingClientRect(),warning=document.querySelector('#storageWarning').getBoundingClientRect(),hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return {close:{x:box.x,y:box.y,width:box.width,height:box.height},warning:{x:warning.x,y:warning.y,width:warning.width,height:warning.height},centerHitsClose:hit===button||button.contains(hit),hitElement:hit?.id||hit?.className||hit?.tagName};});measurements.push({viewport,...geometry});require('node:fs').writeFileSync(path.join(out,'readonly-close-'+theme+'.json'),JSON.stringify(measurements,null,2));await other.screenshot({path:path.join(out,'readonly-close-'+theme+'-'+viewport.width+'.png')});
   assert.equal(geometry.centerHitsClose,true,'Persistent readonly warning must not cover Close');await close.click({timeout:5000});await other.locator('#dashboard.active').waitFor();await other.locator('#classHotspot').click();await other.locator('#classroomTeacher').click();await other.locator('#viewAttendanceHistory').click();await other.locator('#attendanceHistoryDialog').waitFor();await other.locator('#closeAttendanceHistory').click();await other.locator('#closeTeacher').click();await other.locator('#classroomHome').click();assert.equal(await raw(other),saved);
  }
 });
 if(process.env.BROWSER!=='webkit')await scenario('native Chromium: actual renderer crash releases the lock to an unchanged reader',async(page,context)=>{
  await seed(page,fixture());const other=await second(page,context),before=await state(other),saved=await raw(other),session=await context.newCDPSession(page);
  const proof={cdp:{status:'pending'},crashEvent:false,route:'Page.crash'};
  const record=()=>require('node:fs').writeFileSync(path.join(out,'single-writer-crash.json'),JSON.stringify(proof,null,2));
  page.on('crash',()=>{proof.crashEvent=true;record();});
  await page.evaluate(()=>{localStorage.removeItem('qa-owner-pagehide');window.addEventListener('pagehide',()=>localStorage.setItem('qa-owner-pagehide','yes'));});
  await page.bringToFront();record();
  try{
   const cdpCrash=page.waitForEvent('crash',{timeout:5000}).then(()=>true,error=>{proof.cdpEventWait=error.message;record();return false;});
   session.send('Page.crash').then(result=>{proof.cdp={status:'resolved',result};record();},error=>{proof.cdp={status:'rejected',error:error.message};record();});
   if(!await cdpCrash){
    // Playwright's own v1.58.2 page-event-crash.spec.ts uses this Chromium route.
    // It crashes this isolated fictional owner, without ordinary close/pagehide.
    proof.route='chrome://crash';record();const actualCrash=page.waitForEvent('crash',{timeout:10000});
    page.goto('chrome://crash',{timeout:10000}).then(()=>{proof.navigation='resolved';record();},error=>{proof.navigation=error.message;record();});await actualCrash;
   }
   assert.equal(proof.crashEvent,true);assert.equal(await other.evaluate(()=>localStorage.getItem('qa-owner-pagehide')),null,'Crash release must not be a graceful pagehide release');assert.equal(await raw(other),saved);
   await other.waitForFunction(async()=>!(await navigator.locks.query()).held.some(lock=>lock.name===STORAGE_KEY));proof.ownerLockReleased=true;
   await other.locator('#retrySave').click();await held(other);assert.deepEqual(await state(other),before);await other.evaluate(()=>setChildPresent('qa-b',true));assert.deepEqual(JSON.parse(await raw(other)).present,['qa-a','qa-b']);proof.readerSaved=true;
  }finally{record();}
 });
};
