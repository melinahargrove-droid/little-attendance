// Targeted native BFCache probe. The normal browser suite stays unchanged.
// No request interception: report browser reasons rather than an instrumentation
// veto. Only Playwright's BFCache-disabling default switch is removed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results'),KEY='littleAttendanceCleanV4';
const fixture=()=>({schemaVersion:2,attendanceDay:null,attendanceRecordId:'undated',saveAttendanceHistory:false,attendanceRecords:[],undoActions:[],className:'QA BFCache Class',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:[],history:[],selectedTheme:'school-bus',ownedThemes:['school-bus','apple-orchard']});
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'' )||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=process.env.TARGET_URL||('http://127.0.0.1:'+server.address().port+'/');if(process.env.TARGET_URL)assert.equal(url,'https://melinahargrove-droid.github.io/little-attendance/');
 const browser=await chromium.launch({headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
 const report={browser:await browser.version(),url,removedDefaultArgs:['--disable-back-forward-cache'],requestInterception:false,cases:[]};
 const record=()=>fs.writeFileSync(path.join(out,'bfcache-probe.json'),JSON.stringify(report,null,2));
 const state=p=>p.evaluate(()=>JSON.parse(JSON.stringify(data))),raw=p=>p.evaluate(k=>localStorage.getItem(k),KEY);
 const settled=p=>p.waitForFunction(()=>!['pending','requesting'].includes(editingLockState));
 async function seed(p){await p.goto(url);await p.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:KEY,value:fixture()});await p.reload();await p.waitForFunction(()=>editingLockHeld);}
 async function draft(p){await p.locator('#classHotspot').click();await p.locator('#addFriendBtn').click();await p.locator('#friendName').fill('QA Unsubmitted Draft');await p.evaluate(()=>{window.qaOriginalDocument=true;});}
 try{
  for(const kind of ['owner-unchanged','owner-stale','readonly-stale']){
   const context=await browser.newContext({viewport:{width:1280,height:720}}),errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   await context.addInitScript(()=>{window.addEventListener('pageshow',event=>{window.qaNativePageshow={persisted:event.persisted};});});
   const result={kind,notRestoredEvents:[]};report.cases.push(result);record();
   try{
    let owner=await context.newPage();await seed(owner);let returning=owner;
    if(kind==='readonly-stale'){returning=await context.newPage();await returning.goto(url);await settled(returning);assert.equal(await returning.evaluate(()=>editingLockHeld),false);}
    const session=await context.newCDPSession(returning);await session.send('Page.enable');session.on('Page.backForwardCacheNotUsed',event=>{result.notRestoredEvents.push(event);record();});
    await draft(returning);const before=await state(returning),initial=await raw(returning);await returning.goto(new URL('README.md',url).href);
    if(kind==='owner-stale'){owner=await context.newPage();await owner.goto(url);await owner.waitForFunction(()=>editingLockHeld);}
    let saved=initial;
    if(kind!=='owner-unchanged'){
     await owner.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();setChildPresent('qa-b',true);});saved=await raw(owner);assert.notEqual(saved,initial);await owner.close();
    }
    await returning.goBack();await settled(returning);await returning.waitForFunction(()=>window.qaNativePageshow!==undefined);
    const detail=await returning.evaluate(()=>({persisted:qaNativePageshow.persisted,restoredDocument:Boolean(window.qaOriginalDocument),notRestoredReasons:performance.getEntriesByType('navigation')[0]?.notRestoredReasons?.toJSON?.()||null,held:editingLockHeld,lockState:editingLockState}));Object.assign(result,detail);record();assert.equal(detail.persisted,detail.restoredDocument);
    assert.equal(await raw(returning),saved);
    if(detail.persisted){
     assert.deepEqual(await state(returning),before);assert.equal(await returning.locator('#friendName').inputValue(),'QA Unsubmitted Draft');assert.equal(await returning.locator('#friendDialog').isVisible(),true);
     if(kind==='owner-unchanged')assert.equal(detail.held,true);
     else{
      assert.equal(detail.held,false);assert.equal(detail.lockState,'stale');await returning.evaluate(()=>{setChildPresent('qa-a',true);save();});assert.equal(await raw(returning),saved);assert.deepEqual(await state(returning),before);
     }
     result.cachedDraftPreserved=true;
    }else{
     assert.ok(result.notRestoredEvents.length||detail.notRestoredReasons,'A non-restored return must expose a native reason');assert.equal(detail.held,true);assert.deepEqual((await state(returning)).present,kind==='owner-unchanged'?[]:['qa-b']);result.cachedDraftPreserved='Not applicable: browser reloaded the document';
    }
    result.savedBytesPreserved=true;result.safeOwnership=true;assert.deepEqual(errors,[]);await returning.screenshot({path:path.join(out,'bfcache-'+kind+'.png')});result.pass=true;record();console.log('PASS BFCache '+kind+' persisted='+detail.persisted+' lock='+detail.lockState);
   }catch(error){result.error=error.message;record();throw error;}finally{await context.close();}
  }
 }finally{record();await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
