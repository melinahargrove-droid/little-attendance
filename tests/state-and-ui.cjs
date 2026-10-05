const {test, afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const KEY='littleAttendanceCleanV4', BACKUP=KEY+'_beforeStableIds';
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const adapter=fs.readFileSync(path.join(root,'apple-adapter.js'),'utf8');
const config=JSON.parse(fs.readFileSync(path.join(root,'themes/apple-orchard/theme-config.json')));
const fixture=(extra={})=>({className:'QA Synthetic Class',roster:['QA Alpha','QA Beta','QA Gamma'],present:[0,2],history:[0,2],selectedTheme:'school-bus',ownedThemes:['school-bus','apple-orchard'],...extra});
const windows=[];
afterEach(()=>{for(const w of windows.splice(0))w.close();});
function create(saved=fixture(),options={}){
 const dom=new JSDOM(html,{url:'https://attendance.test/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 windows.push(w);
 const store=options.store||new Map(saved===null?[]:[[KEY,typeof saved==='string'?saved:JSON.stringify(saved)]]);
 let failWrite=options.failWrite,failRead=options.failRead;
 Object.defineProperty(w,'localStorage',{value:{getItem:key=>{if(failRead)throw Error('Storage disabled');return store.get(key)??null},setItem:(key,value)=>{if(failWrite)throw Error('Quota exceeded');store.set(key,value)}}});
 w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=options.fetch|| (async()=>({ok:true,json:async()=>config}));
 const run=source=>vm.runInContext(source,dom.getInternalVMContext());
 run(app);run(adapter);
 return {w,d,run,store,node:selector=>d.querySelector(selector),state:()=>JSON.parse(run('JSON.stringify(data)')),failWrite:value=>{failWrite=value},failRead:value=>{failRead=value}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function edit(a,name,id=null){a.run(`openFriendDialog(${JSON.stringify(id)})`);a.node('#friendName').value=name;a.node('#friendForm').dispatchEvent(new a.w.Event('submit',{cancelable:true}));}
function namesHere(a){const s=a.state();return s.roster.filter(child=>s.present.includes(child.id)).map(child=>child.name).sort();}

test('original approved dashboard image and all three usable targets are preserved',()=>{
 const css=fs.readFileSync(path.join(root,'app.css'),'utf8');
 assert.match(css,/background-image:url\("assets\/home-approved.png"\)/);
 const bytes=fs.readFileSync(path.join(root,'assets/home-approved.png'));
 assert.equal(require('crypto').createHash('sha256').update(bytes).digest('hex'),'74656937c2a43727219a3c9ddaa51738e57ed6871a65db774d3e102b0208c7e2');
 const a=create();a.node('#classHotspot').click();assert.ok(a.node('#classroom').classList.contains('active'));
 a.node('#classroomHome').click();a.node('#takeHotspot').click();assert.ok(a.node('#attendance').classList.contains('active'));
 a.node('#homeBtn').click();a.node('#teacherHotspot').click();assert.ok(a.node('#teacherDialog').open);
});
test('legacy migration preserves classroom, duplicate names, order, attendance, themes, extras and original bytes',()=>{
 const old=fixture({roster:['QA Same','QA Same','QA Third'],ownedThemes:['school-bus','fall-leaves'],extraSetting:'kept'}),raw=JSON.stringify(old);
 const a=create(raw),s=a.state();assert.equal(a.store.get(KEY),raw);assert.equal(a.store.has(BACKUP),false);
 assert.equal(s.schemaVersion,1);assert.equal(new Set(s.roster.map(c=>c.id)).size,3);
 assert.deepEqual(s.roster.map(c=>c.name),old.roster);assert.deepEqual(s.present,[s.roster[0].id,s.roster[2].id]);assert.deepEqual(s.history,s.present);assert.equal(s.extraSetting,'kept');
 a.run('save()');assert.equal(a.store.get(BACKUP),raw);
 const b=create(null,{store:a.store});assert.deepEqual(b.state(),a.state());b.run('save()');assert.equal(a.store.get(BACKUP),raw);
});
test('add, rename, reorder and removal preserve unaffected stable children and undo across reload',()=>{
 const a=create(),[alpha,beta,gamma]=a.state().roster;
 edit(a,'QA New');assert.deepEqual(namesHere(a),['QA Alpha','QA Gamma']);
 edit(a,'QA Alpha Renamed',alpha.id);assert.deepEqual(a.state().history,[alpha.id,gamma.id]);
 a.run(`moveFriend(${JSON.stringify(gamma.id)},-1)`);assert.deepEqual(a.state().history,[alpha.id,gamma.id]);
 a.run(`removeFriend(${JSON.stringify(beta.id)})`);assert.deepEqual(namesHere(a),['QA Alpha Renamed','QA Gamma']);
 const b=create(null,{store:a.store});b.node('#undoBtn').click();assert.deepEqual(namesHere(b),['QA Alpha Renamed']);
 b.run(`removeFriend(${JSON.stringify(alpha.id)})`);assert.deepEqual(b.state().present,[]);assert.deepEqual(b.state().history,[]);
});
test('duplicate names retain separate identities through all roster changes',()=>{
 const a=create(fixture({roster:['QA Same','QA Same'],present:[1],history:[1]})),[first,second]=a.state().roster;
 a.run(`moveFriend(${JSON.stringify(second.id)},-1)`);edit(a,'QA Renamed',first.id);assert.deepEqual(a.state().present,[second.id]);
 a.run(`removeFriend(${JSON.stringify(first.id)})`);assert.deepEqual(a.state().present,[second.id]);a.node('#undoBtn').click();assert.deepEqual(a.state().present,[]);
});
test('add cancellation, repeated submits, stale edits, blank names and class limit are safe',()=>{
 const a=create();a.node('#addFriendBtn').click();a.node('#friendName').value='QA Cancel';a.node('#cancelFriend').click();assert.equal(a.run('saveFriendFromDialog()'),false);assert.equal(a.state().roster.length,3);
 a.node('#addFriendBtn').click();a.node('#friendName').value=' ';assert.equal(a.run('saveFriendFromDialog()'),false);a.node('#friendName').value='QA Once';assert.equal(a.run('saveFriendFromDialog()'),true);assert.equal(a.run('saveFriendFromDialog()'),false);assert.equal(a.state().roster.length,4);a.node('#friendDialog').close();
 const id=a.state().roster[0].id;a.run(`openFriendDialog(${JSON.stringify(id)});removeFriend(${JSON.stringify(id)})`);a.node('#friendName').value='QA Stale';assert.equal(a.run('saveFriendFromDialog()'),false);assert.equal(a.state().roster.some(c=>c.name==='QA Stale'),false);
 const b=create(fixture({roster:Array.from({length:30},(_,i)=>'QA '+i)}));edit(b,'QA 31');assert.equal(b.state().roster.length,30);
});
test('cancelled removal/reset and repeated check-ins preserve correct state',()=>{
 const a=create();a.w.confirm=()=>false;const before=a.state();a.run(`removeFriend(${JSON.stringify(before.roster[0].id)})`);a.node('#resetBtn').click();assert.deepEqual(a.state(),before);
 a.run('renderAttendance()');const button=a.node('#studentGrid').children[1];button.click();button.click();assert.equal(a.state().present.length,3);assert.equal(a.state().history.length,3);a.node('#undoBtn').click();assert.deepEqual(a.state().present,before.present);
});
test('classroom name input is saved before an immediate reload',()=>{
 const a=create();a.node('#className').value='QA Interrupted';a.node('#className').dispatchEvent(new a.w.Event('input'));const b=create(null,{store:a.store});assert.equal(b.state().className,'QA Interrupted');
});
test('invalid or unreadable stored data is not overwritten and produces visible warning',()=>{
 for(const value of ['not-json',JSON.stringify({roster:null}),JSON.stringify({roster:[42]}),JSON.stringify({schemaVersion:99,roster:[]})]){
   const a=create(value);a.run('openAttendance();save()');assert.equal(a.store.get(KEY),value);assert.equal(a.node('#storageWarning').hidden,false);assert.equal(a.node('#autosaveText').textContent,'Not saved');
 }
 const a=create(fixture(),{failRead:true}),raw=a.store.get(KEY);a.run('save()');assert.equal(a.store.get(KEY),raw);
});
test('migration backup or write failure preserves saved bytes, keeps session usable, and retries truthfully',()=>{
 const old=fixture(),raw=JSON.stringify(old),a=create(old,{failWrite:true});edit(a,'QA Unsaved');assert.equal(a.state().roster.length,4);assert.equal(a.store.get(KEY),raw);assert.equal(a.node('#storageWarning').hidden,false);assert.equal(a.node('#autosaveText').textContent,'Not saved');
 a.failWrite(false);assert.equal(a.run('save()'),true);assert.equal(a.store.get(BACKUP),raw);assert.equal(a.node('#storageWarning').hidden,true);assert.equal(a.node('#autosaveText').textContent,'Saved automatically');assert.equal(create(null,{store:a.store}).state().roster.length,4);
});
test('stale tabs cannot silently overwrite newer saved classroom',()=>{
 const a=create(),b=create(null,{store:a.store});edit(a,'QA From A');const newer=a.store.get(KEY);edit(b,'QA From B');assert.equal(a.store.get(KEY),newer);assert.match(b.node('#storageWarning').textContent,/another tab/);
});
test('markup-like names render literally in classroom and every board',async()=>{
 const payload='<img src=x onerror="window.QAInjected=true"> & "QA"';
 for(const selectedTheme of ['school-bus','fall-leaves','apple-orchard']){
   const a=create(fixture({selectedTheme,roster:[payload],present:[],history:[]}));a.run('renderClassroom();openAttendance()');await settle();
   assert.equal(a.node('.friend-card-name').textContent,payload);assert.equal(a.d.querySelectorAll('#friendGrid img').length,0);
   const selector=selectedTheme==='apple-orchard'?'.apple-la-name':selectedTheme==='fall-leaves'?'.fall-la-name':'.student .name';assert.equal(a.node(selector).textContent,payload);
   assert.equal(a.d.querySelectorAll('#studentGrid img, #fallLeavesZone img, #appleWaitLayer img').length,0);assert.equal(a.w.QAInjected,undefined);
 }
});
test('Apple Orchard empty overlay layers pass taps and buttons retain full accessible names',async()=>{
 const css=fs.readFileSync(path.join(root,'apple-adapter.css'),'utf8');assert.match(css,/\.apple-la-wait,\.apple-la-here\{pointer-events:none\}/);assert.match(css,/\.apple-la-piece\{pointer-events:auto\}/);
 const a=create(fixture({selectedTheme:'apple-orchard',present:[],history:[]}));a.run('openAttendance()');await settle();
 let button=a.node('#appleWaitLayer button');assert.equal(button.getAttribute('aria-label'),'Mark here QA Alpha');button.click();await settle();button=a.node('#appleHereLayer button');assert.equal(button.getAttribute('aria-label'),'Return QA Alpha');assert.equal(button.getAttribute('aria-pressed'),'true');button.click();await settle();assert.deepEqual(a.state().present,[]);assert.deepEqual(a.state().history,[]);a.node('#undoBtn').click();assert.deepEqual(a.state().present,[]);
});
test('Apple close/reopen, quick repeated taps, undo and reset remain consistent',async()=>{
 const a=create(fixture({selectedTheme:'apple-orchard',present:[],history:[]}));a.run('openAttendance()');await settle();const button=a.node('#appleWaitLayer button');button.click();button.click();await settle();assert.deepEqual(a.state().present,[]);assert.deepEqual(a.state().history,[]);
 a.node('#appleWaitLayer button').click();await settle();a.node('#appleClose').click();assert.ok(a.node('#dashboard').classList.contains('active'));a.run('openAttendance()');await settle();assert.equal(a.node('#appleHereLayer').children.length,1);a.node('#undoBtn').click();await settle();assert.equal(a.node('#appleHereLayer').children.length,0);
 a.node('#appleWaitLayer button').click();await settle();a.node('#resetBtn').click();await settle();assert.deepEqual(a.state().present,[]);assert.deepEqual(a.state().history,[]);
});
test('late Apple configuration cannot navigate after close, and failed loading has a working fallback',async()=>{
 let resolve;const a=create(fixture({selectedTheme:'apple-orchard'}),{fetch:()=>new Promise(r=>{resolve=r})});a.run('openAttendance()');a.node('#appleClose').click();resolve({ok:true,json:async()=>config});await settle();assert.ok(a.node('#dashboard').classList.contains('active'));
 const b=create(fixture({selectedTheme:'apple-orchard'}),{fetch:async()=>{throw Error('offline')}});b.run('openAttendance()');await settle();assert.ok(b.node('#attendance').classList.contains('active'));assert.equal(b.node('#studentGrid').children.length,3);assert.deepEqual(namesHere(b),['QA Alpha','QA Gamma']);
});
test('all 19 original themes remain available and attendance identity survives theme changes',async()=>{
 const a=create();assert.equal(a.run('themeCatalog.length'),19);const ids=a.run('themeCatalog.map(t=>t.id)');
 for(const id of ids){a.run(`data.selectedTheme=${JSON.stringify(id)};openAttendance()`);await settle();assert.deepEqual(namesHere(a),['QA Alpha','QA Gamma']);}
});

test('legacy repeated Apple returns retain latest check-in undo order',()=>{
 const a=create(fixture({selectedTheme:'apple-orchard',present:[1,0],history:[0,1,0]})),[alpha,beta]=a.state().roster;
 assert.deepEqual(a.state().history,[beta.id,alpha.id]);a.node('#undoBtn').click();assert.deepEqual(a.state().present,[beta.id]);
});
test('failed Apple fallback redraws generic Undo and Reset controls',async()=>{
 const a=create(fixture({selectedTheme:'apple-orchard'}),{fetch:async()=>{throw Error('offline')}});a.run('openAttendance()');await settle();
 assert.equal(a.node('#hereCount').textContent,'2');a.node('#undoBtn').click();await settle();assert.equal(a.node('#hereCount').textContent,'1');assert.equal(a.d.querySelectorAll('#studentGrid .present').length,1);
 a.node('#resetBtn').click();await settle();assert.equal(a.node('#hereCount').textContent,'0');assert.equal(a.d.querySelectorAll('#studentGrid .present').length,0);
});

test('dashboard preserves visible fallback controls until successful image load',()=>{
 const a=create();const stage=a.node('.dashboard-stage');assert.equal(stage.classList.contains('art-ready'),false);a.run('dashboardArt.onload()');assert.equal(stage.classList.contains('art-ready'),true);a.run('dashboardArt.onerror()');assert.equal(stage.classList.contains('art-ready'),false);a.node('#takeHotspot').click();assert.ok(a.node('#attendance').classList.contains('active'));
});
