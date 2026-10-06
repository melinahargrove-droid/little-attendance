// Fictional fixtures. These deterministic checks prove gates and transitions;
// native same-origin browser pages, not this shim, establish lock serialization.
const {test,afterEach}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const {createLockManager,installSingleDocumentLocks}=require('./lock-helper.cjs');
const ROOT=path.resolve(__dirname,'..'),KEY='littleAttendanceCleanV4',windows=[];
afterEach(()=>windows.splice(0).forEach(w=>w.close()));
const fixture=()=>({schemaVersion:1,className:'QA Lock Class',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:['qa-a'],history:['qa-a'],selectedTheme:'school-bus',ownedThemes:['school-bus','apple-orchard']});
function create({store=new Map([[KEY,JSON.stringify(fixture())]]),locks=createLockManager(),failWrite=false}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),{url:'https://attendance.test/',runScripts:'outside-only'}),w=dom.window;windows.push(w);
 Object.defineProperty(w,'localStorage',{value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>{if(failWrite)throw Error('Synthetic full storage');store.set(k,v);}}});
 installSingleDocumentLocks(w,locks);w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(ROOT,'themes/apple-orchard/theme-config.json')))});
 const run=s=>vm.runInContext(s,dom.getInternalVMContext());for(const file of ['app.js','apple-adapter.js','bus-adapter.js'])run(fs.readFileSync(path.join(ROOT,file),'utf8'));run('acknowledgedAttendanceDay=localAttendanceDate()');
 return {w,run,store,locks,node:s=>w.document.querySelector(s),state:()=>JSON.parse(run('JSON.stringify(data)')),failWrite:v=>failWrite=v};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const guarded=a=>{const e=new a.w.Event('beforeunload',{cancelable:true});a.w.dispatchEvent(e);return e.defaultPrevented;};
function attemptedEdits(a){
 a.run('setChildPresent("qa-b",true);undoAttendance();resetAttendance();removeFriend("qa-a");moveFriend("qa-a",1);autosaveClassroom();save();');
 a.node('#className').value='QA Blocked';a.node('#className').dispatchEvent(new a.w.Event('input'));
 a.node('#saveAttendanceHistory').checked=true;a.node('#saveAttendanceHistory').dispatchEvent(new a.w.Event('change'));
 a.run('openFriendDialog()');a.node('#friendName').value='QA Draft';a.run('saveFriendFromDialog()');
 a.run('openPasteListDialog()');a.node('#pastedNames').value='QA Draft';a.run('savePastedNames()');
 a.run('ensureAttendanceDay(true);startNewAttendanceDay();');
 a.run('renderThemeGrid()');[...a.w.document.querySelectorAll('.theme-card')].find(e=>e.textContent.includes('Apple Orchard')).click();
}
test('pending lock gates every mutation, autosave and migration backup before acquisition',()=>{
 const locks=createLockManager({deferred:true}),a=create({locks}),before=a.state(),raw=a.store.get(KEY);attemptedEdits(a);
 assert.deepEqual(a.state(),before);assert.equal(a.store.size,1);assert.equal(a.store.get(KEY),raw);assert.equal(guarded(a),false);assert.equal(a.node('#autosaveText').textContent,'Read only');assert.equal(a.node('#friendName').value,'QA Draft');
 locks.flush();assert.equal(a.run('editingLockHeld'),true);assert.deepEqual(a.state(),before);assert.equal(a.node('#friendName').value,'QA Draft');a.run('setChildPresent("qa-b",true)');assert.deepEqual(JSON.parse(a.store.get(KEY)).present,['qa-a','qa-b']);
});
test('one shared lock grants exactly one writer; losing tab cannot mutate or write backups',async()=>{
 const locks=createLockManager({deferred:true}),a=create({locks}),b=create({store:a.store,locks}),before=b.state();locks.flush();assert.equal(a.run('editingLockHeld'),true);assert.equal(b.run('editingLockHeld'),false);assert.match(b.node('#storageWarning').textContent,/another tab/);
 attemptedEdits(b);assert.deepEqual(b.state(),before);assert.equal(a.store.size,1);a.run('setChildPresent("qa-b",true)');const saved=a.store.get(KEY);b.run('save()');assert.equal(a.store.get(KEY),saved);assert.notEqual(b.node('#autosaveText').textContent,'Saved automatically');
 a.w.dispatchEvent(new a.w.Event('pagehide'));await settle();b.node('#retrySave').click();locks.flush();await settle();assert.equal(b.run('editingLockHeld'),false);assert.match(b.node('#storageWarning').textContent,/reload/);assert.equal(locks.held.size,0);assert.equal(b.node('#pastedNames').value,'QA Draft');assert.deepEqual(b.state(),before);
 const c=create({store:a.store,locks});locks.flush();assert.equal(c.run('editingLockHeld'),true);assert.deepEqual(c.state().present,['qa-a','qa-b']);
});
test('acquisition rechecks raw bytes if another writer changes storage while pending',async()=>{
 const locks=createLockManager({deferred:true}),a=create({locks}),before=a.state();a.store.set(KEY,JSON.stringify({...fixture(),className:'QA Newer'}));const raw=a.store.get(KEY);locks.flush();await settle();assert.equal(a.run('editingLockHeld'),false);assert.deepEqual(a.state(),before);assert.equal(a.store.get(KEY),raw);assert.equal(locks.held.size,0);assert.match(a.node('#storageWarning').textContent,/reload/);
});
test('unsupported and rejected Web Locks stay visibly read-only without changing storage',async()=>{
 for(const locks of [undefined,{request(){throw Error('Denied');}},{request(){return Promise.reject(Error('Denied'));}}]){
  const a=create({locks:locks===undefined?null:locks}),before=a.state(),raw=a.store.get(KEY);await settle();attemptedEdits(a);assert.deepEqual(a.state(),before);assert.equal(a.store.get(KEY),raw);assert.equal(a.store.size,1);assert.match(a.node('#storageWarning').textContent,/Read only/);assert.notEqual(a.node('#autosaveText').textContent,'Saved automatically');
 }
});
test('dirty owner retains exclusivity and unload guard; retry saves without replaying edits',async()=>{
 const locks=createLockManager(),a=create({locks,failWrite:true}),b=create({store:a.store,locks});a.run('setChildPresent("qa-b",true)');const dirty=a.state(),raw=a.store.get(KEY);assert.equal(guarded(a),true);assert.equal(a.run('editingLockHeld'),true);b.run('requestEditingLock()');assert.equal(b.run('editingLockHeld'),false);assert.equal(a.store.get(KEY),raw);
 a.failWrite(false);a.node('#retrySave').click();assert.deepEqual(a.state(),dirty);assert.equal(guarded(a),false);assert.deepEqual(JSON.parse(a.store.get(KEY)),dirty);await settle();
});
test('pagehide and pageshow preserve dirty session and form drafts, then revalidate on reacquisition',async()=>{
 const locks=createLockManager(),a=create({locks,failWrite:true});a.run('setChildPresent("qa-b",true);openFriendDialog()');a.node('#friendName').value='QA Pending Draft';const dirty=a.state();a.w.dispatchEvent(new a.w.Event('pagehide'));assert.equal(a.run('editingLockHeld'),false);assert.equal(guarded(a),true);await settle();a.w.dispatchEvent(new a.w.Event('pageshow'));assert.equal(a.run('editingLockHeld'),true);assert.deepEqual(a.state(),dirty);assert.equal(a.node('#friendName').value,'QA Pending Draft');assert.equal(guarded(a),true);
 a.w.dispatchEvent(new a.w.Event('pagehide'));await settle();a.store.set(KEY,JSON.stringify({...fixture(),className:'QA External'}));a.w.dispatchEvent(new a.w.Event('pageshow'));assert.equal(a.run('editingLockHeld'),false);assert.deepEqual(a.state(),dirty);assert.equal(a.node('#friendName').value,'QA Pending Draft');assert.equal(guarded(a),true);
});
test('theme-file read begun by owner cannot mutate after ownership is released or reacquired',async()=>{
 const a=create();let finish;Object.defineProperty(a.node('#themeFile'),'files',{value:[{text:()=>new Promise(resolve=>{finish=resolve;})}]});const before=a.state(),raw=a.store.get(KEY),pending=a.node('#themeFile').onchange({target:a.node('#themeFile')});a.w.dispatchEvent(new a.w.Event('pagehide'));await settle();a.w.dispatchEvent(new a.w.Event('pageshow'));assert.equal(a.run('editingLockHeld'),true);finish(JSON.stringify({themeIds:['penguin-pals']}));await pending;assert.deepEqual(a.state(),before);assert.equal(a.store.get(KEY),raw);
});
test('same-origin copies coordinate by storage key, never page path or a tab-generated ID',()=>{
 const requests=[],locks={request(name,options,callback){requests.push({name,options});callback(null);return Promise.resolve();}},a=create({locks});assert.equal(requests.length,1);assert.equal(requests[0].name,KEY);assert.deepEqual(JSON.parse(JSON.stringify(requests[0].options)),{mode:'exclusive',ifAvailable:true});assert.equal(a.store.size,1);
});
test('read-only classroom can view and print saved attendance without acquiring or writing',()=>{
 const owner=create();owner.node('#saveAttendanceHistory').checked=true;owner.node('#saveAttendanceHistory').dispatchEvent(new owner.w.Event('change'));const a=create({store:owner.store,locks:null}),before=a.state(),raw=a.store.get(KEY);let prints=0;a.w.print=()=>prints++;a.node('#classHotspot').click();a.node('#classroomTeacher').click();a.node('#viewAttendanceHistory').click();assert.equal(a.node('#attendanceHistoryDialog').open,true);assert.equal(a.w.document.querySelectorAll('#attendanceHistoryRows tr').length,2);a.node('#printAttendanceRecord').click();assert.equal(prints,1);assert.equal(a.w.document.querySelectorAll('#attendancePrint td').length,4);assert.deepEqual(a.state(),before);assert.equal(a.store.get(KEY),raw);assert.equal(a.run('editingLockHeld'),false);a.w.dispatchEvent(new a.w.Event('afterprint'));assert.equal(a.node('#attendanceHistoryDialog').open,true);
});
