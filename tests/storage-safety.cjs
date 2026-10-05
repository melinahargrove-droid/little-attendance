// Multi-document fixtures here intentionally model sequential reloads or
// non-cooperating external/legacy writers with isolated mock lock managers.
// Native cooperating-tab serialization is covered in single-writer-browser.cjs.
// Synthetic save/conflict regressions. No deployed classroom is read.
const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const ROOT=path.resolve(__dirname,'..'),KEY='littleAttendanceCleanV4';
const windows=[];afterEach(()=>windows.splice(0).forEach(w=>w.close()));
const fixture=(theme='school-bus')=>({schemaVersion:1,className:'QA Fictional Safety Class',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:['qa-a'],history:['qa-a'],selectedTheme:theme,ownedThemes:['school-bus','apple-orchard','fall-leaves']});
function create(state=fixture(),options={}){
 const dom=new JSDOM(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),{url:'https://attendance.test/',runScripts:'outside-only'}),w=dom.window;windows.push(w);
 const store=options.store||new Map([[KEY,JSON.stringify(state)]]);let failWrite=!!options.failWrite,failRead=!!options.failRead;
 Object.defineProperty(w,'localStorage',{value:{getItem:key=>{if(failRead)throw Error('Synthetic read failure');return store.get(key)??null},setItem:(key,value)=>{if(failWrite)throw Error('Synthetic quota failure');store.set(key,value)}}});
 require('./lock-helper.cjs').installSingleDocumentLocks(w);
 w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(ROOT,'themes/apple-orchard/theme-config.json'),'utf8'))});
 const run=s=>vm.runInContext(s,dom.getInternalVMContext());
 for(const file of ['app.js','apple-adapter.js','bus-adapter.js'])run(fs.readFileSync(path.join(ROOT,file),'utf8'));
 run("acknowledgedAttendanceDay=localAttendanceDate()");
 return {w,run,store,node:s=>w.document.querySelector(s),state:()=>JSON.parse(run('JSON.stringify(data)')),failWrite:v=>failWrite=v,failRead:v=>failRead=v};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

function unloadIsGuarded(a){const event=new a.w.Event('beforeunload',{cancelable:true});a.w.dispatchEvent(event);return event.defaultPrevented;}
function notifyStorage(a,oldValue,newValue,key=KEY){a.w.dispatchEvent(new a.w.StorageEvent('storage',{key,oldValue,newValue,url:'https://attendance.test/'}));}
function assertNotSaved(a){assert.equal(a.node('#storageWarning').hidden,false);assert.equal(a.node('#autosaveText').textContent,'Not saved');assert.equal(unloadIsGuarded(a),true);}
function retryAndVerify(a,raw,before){
 assert.equal(a.store.get(KEY),raw);assert.deepEqual(a.state(),before);a.node('#retrySave').click();assert.equal(a.store.get(KEY),raw);assert.deepEqual(a.state(),before);assertNotSaved(a);
 a.failWrite(false);a.node('#retrySave').click();assert.equal(a.node('#storageWarning').hidden,true);assert.equal(a.node('#retrySave').hidden,true);assert.equal(a.node('#autosaveText').textContent,'Saved automatically');assert.equal(unloadIsGuarded(a),false);assert.deepEqual(create(null,{store:a.store}).state(),before);
 const saved=a.store.get(KEY);a.node('#retrySave').click();assert.equal(a.store.get(KEY),saved);assert.deepEqual(a.state(),before);assert.equal(unloadIsGuarded(a),false);
}
for(const theme of ['school-bus','apple-orchard','fall-leaves','pumpkin-patch']){
 test(`${theme}: failed Reset is truthful, guarded and retryable without losing saved or session state`,async()=>{
  const a=create(fixture(theme),{failWrite:true}),raw=a.store.get(KEY);a.run('openAttendance()');await settle();a.node('#resetBtn').click();await settle();
  assert.deepEqual(a.state().present,[]);assert.deepEqual(a.state().history,[]);assert.match(a.node('#toast').textContent,/Not saved/);assertNotSaved(a);assert.deepEqual(create(null,{store:a.store}).state().present,['qa-a']);
  retryAndVerify(a,raw,a.state());
 });
 test(`${theme}: failed Undo is truthful, guarded and retryable`,async()=>{
  const a=create(fixture(theme),{failWrite:true}),raw=a.store.get(KEY);a.run('openAttendance()');await settle();a.node('#undoBtn').click();await settle();
  assert.deepEqual(a.state().present,[]);assert.match(a.node('#toast').textContent,/Not saved/);assertNotSaved(a);retryAndVerify(a,raw,a.state());
 });
 test(`${theme}: failed check-in stays in session and safely retries once`,async()=>{
  const a=create(fixture(theme),{failWrite:true}),raw=a.store.get(KEY);a.run('openAttendance()');await settle();
  const selector=theme==='school-bus'?'#busWaitingLayer [data-child-id="qa-b"]':theme==='apple-orchard'?'#appleWaitLayer button':theme==='fall-leaves'?'#fallLeavesZone button:not(.here)':'#studentGrid button:not(.present)';
  a.node(selector).click();await settle();assert.deepEqual(a.state().present,['qa-a','qa-b']);assertNotSaved(a);retryAndVerify(a,raw,a.state());
 });
}
for(const operation of ['add','rename','remove','move','class name','paste','theme selection']){
 test(`${operation}: failure preserves exact stored bytes and session edits, retry never repeats mutation`,()=>{
  const a=create(fixture(),{failWrite:true}),raw=a.store.get(KEY);
  if(operation==='add'||operation==='rename'){
   a.run(`openFriendDialog(${operation==='rename'?'"qa-a"':'null'})`);a.node('#friendName').value='QA Changed';a.node('#friendForm').dispatchEvent(new a.w.Event('submit',{cancelable:true}));assert.match(a.node('#toast').textContent,/Not saved/);
  }else if(operation==='remove'){a.run('removeFriend("qa-a")');assert.match(a.node('#toast').textContent,/Not saved/);}
  else if(operation==='move')a.run('moveFriend("qa-a",1)');
  else if(operation==='class name'){a.node('#className').value='QA Changed Class';a.node('#className').dispatchEvent(new a.w.Event('input'));}
  else if(operation==='paste'){a.node('#pasteListBtn').click();a.node('#pastedNames').value='QA New One\nQA New Two';a.node('#pastedNames').dispatchEvent(new a.w.Event('input'));a.node('#pasteListForm').dispatchEvent(new a.w.Event('submit',{cancelable:true}));assert.match(a.node('#toast').textContent,/Not saved/);}
  else {a.run('renderThemeGrid()');const cards=[...a.w.document.querySelectorAll('.theme-card')];const card=cards.find(c=>c.textContent.includes('Apple Orchard'));card.click();assert.match(a.node('#toast').textContent,/Not saved/);}
  assertNotSaved(a);retryAndVerify(a,raw,a.state());
 });
}
test('clean loads, successful saves and cancelled Reset/removal do not warn before leaving',()=>{
 const a=create();assert.equal(unloadIsGuarded(a),false);a.w.confirm=()=>false;const before=a.state();a.node('#resetBtn').click();a.run('removeFriend("qa-a")');assert.deepEqual(a.state(),before);assert.equal(unloadIsGuarded(a),false);
 a.run('setChildPresent("qa-b",true)');assert.equal(unloadIsGuarded(a),false);assert.equal(a.node('#storageWarning').hidden,true);
});
test('another tab immediately marks a clean board out of date without changing data or blocking exit',()=>{
 const a=create(),b=create(null,{store:a.store}),before=b.state(),old=a.store.get(KEY);a.run('setChildPresent("qa-b",true)');const latest=a.store.get(KEY);notifyStorage(b,old,latest);
 assert.deepEqual(b.state(),before);assert.equal(a.store.get(KEY),latest);assert.match(b.node('#storageWarning').textContent,/out of date/);assert.equal(b.node('#autosaveText').textContent,'Not saved');assert.equal(b.node('#retrySave').hidden,true);assert.equal(unloadIsGuarded(b),false);
 b.run('setChildPresent("qa-a",false)');assertNotSaved(b);assert.match(b.node('#storageWarning').textContent,/reloading would discard/);const unsaved=b.state();b.node('#retrySave').click();assert.deepEqual(b.state(),unsaved);assert.equal(a.store.get(KEY),latest);
});
test('dirty-tab notification and retry preserve both divergent states and never overwrite the newer classroom',()=>{
 const a=create(),b=create(null,{store:a.store,failWrite:true}),old=a.store.get(KEY);b.run('setChildPresent("qa-a",false)');const dirty=b.state();a.run('setChildPresent("qa-b",true)');const latest=a.store.get(KEY);notifyStorage(b,old,latest);
 assert.deepEqual(b.state(),dirty);assert.match(b.node('#storageWarning').textContent,/reloading would discard/);assertNotSaved(b);b.failWrite(false);b.node('#retrySave').click();b.node('#retrySave').click();assert.equal(a.store.get(KEY),latest);assert.deepEqual(b.state(),dirty);assertNotSaved(b);
});
test('retry checks current saved bytes even without a storage event',()=>{
 const a=create(),b=create(null,{store:a.store,failWrite:true});b.run('setChildPresent("qa-a",false)');const dirty=b.state();a.run('setChildPresent("qa-b",true)');const latest=a.store.get(KEY);b.failWrite(false);b.node('#retrySave').click();
 assert.equal(a.store.get(KEY),latest);assert.deepEqual(b.state(),dirty);assert.equal(b.run('storageBlocked'),true);assert.equal(b.node('#retrySave').hidden,true);assertNotSaved(b);
});
test('focus and visible-page checks detect missed changes; unrelated/stale events are harmless',()=>{
 const a=create(),b=create(null,{store:a.store});const old=a.store.get(KEY);notifyStorage(b,null,'unrelated','another-key');assert.equal(b.node('#storageWarning').hidden,true);
 a.run('setChildPresent("qa-b",true)');notifyStorage(a,old,a.store.get(KEY));assert.equal(a.node('#storageWarning').hidden,true);b.w.dispatchEvent(new b.w.Event('focus'));assert.equal(b.run('storageBlocked'),true);
 const c=create(null,{store:a.store});a.run('setChildPresent("qa-a",false)');Object.defineProperty(c.w.document,'visibilityState',{value:'visible'});c.w.document.dispatchEvent(new c.w.Event('visibilitychange'));assert.equal(c.run('storageBlocked'),true);
});
test('cleared storage is treated as a conflict rather than silently repopulated',()=>{
 const a=create(),before=a.state();a.store.delete(KEY);notifyStorage(a,null,null,null);assert.equal(a.run('storageBlocked'),true);assert.equal(a.node('#retrySave').hidden,true);a.node('#retrySave').click();assert.equal(a.store.has(KEY),false);assert.deepEqual(a.state(),before);
});
test('unreadable initial storage remains protected; unvalidated session cannot edit or retry writes',async()=>{
 const a=create(fixture(),{failRead:true}),raw=a.store.get(KEY),before=a.state();assert.equal(unloadIsGuarded(a),false);await settle();a.failRead(false);a.node('#retrySave').click();await settle();assert.equal(a.store.get(KEY),raw);assert.equal(a.node('#retrySave').hidden,true);
 a.run('openFriendDialog()');a.node('#friendName').value='QA Unsaved';a.node('#friendForm').dispatchEvent(new a.w.Event('submit',{cancelable:true}));assert.deepEqual(a.state(),before);assert.equal(a.node('#friendName').value,'QA Unsaved');assert.equal(a.node('#friendDialog').open,true);assert.equal(a.run('editingLockHeld'),false);assert.equal(unloadIsGuarded(a),false);a.node('#retrySave').click();assert.equal(a.store.get(KEY),raw);
});
test('failed migration retries retain original backup and stable identities',()=>{
 const legacy={className:'QA Legacy',roster:['QA Alpha','QA Beta'],present:[0],history:[0],selectedTheme:'school-bus'},a=create(legacy,{failWrite:true}),raw=a.store.get(KEY);a.run('setChildPresent(data.roster[1].id,true)');const before=a.state();retryAndVerify(a,raw,before);assert.equal(a.store.get(KEY+'_beforeStableIds'),raw);
});
test('failed Undo and external conflicts remain visible and actionable inside an open dialog',()=>{
 const a=create(fixture(),{failWrite:true});a.run('openAttendance()');a.node('#busTeacher').click();a.node('#undoBtn').click();assert.equal(a.node('#teacherDialog').open,true);
 const warning=a.node('#teacherDialog .storage-warning-dialog');assert.equal(warning.hidden,false);assert.match(warning.textContent,/only kept in this session/);assert.equal(warning.querySelector('button').hidden,false);
 a.failWrite(false);warning.querySelector('button').click();assert.equal(a.node('#teacherDialog').open,true);assert.equal(warning.hidden,true);assert.equal(unloadIsGuarded(a),false);
 const b=create(null,{store:a.store}),old=a.store.get(KEY);b.run('setChildPresent("qa-b",true)');notifyStorage(a,old,a.store.get(KEY));assert.equal(warning.hidden,false);assert.match(warning.textContent,/out of date/);assert.equal(warning.querySelector('button').hidden,true);
 for(const id of ['friendDialog','pasteListDialog']){assert.equal(a.node('#'+id+' .storage-warning-dialog').hidden,false);assert.match(a.node('#'+id+' .storage-warning-dialog').textContent,/out of date/);}
});
test('startup Apple ownership normalization is clean; reversing failed edits removes the unload guard',()=>{
 const saved=fixture();saved.ownedThemes=['school-bus'];const a=create(saved,{failWrite:true}),original=a.state();assert.equal(unloadIsGuarded(a),false);a.run('setChildPresent("qa-b",true)');assert.equal(unloadIsGuarded(a),true);a.run('setChildPresent("qa-b",false)');assert.deepEqual(a.state(),original);assert.equal(unloadIsGuarded(a),false);
 const empty={schemaVersion:1,className:'',roster:[],present:[],history:[],selectedTheme:'school-bus',ownedThemes:['school-bus']},b=create(empty,{failWrite:true});b.node('#className').value='QA Changed';b.node('#className').dispatchEvent(new b.w.Event('input'));assert.equal(unloadIsGuarded(b),true);b.node('#className').value='';b.node('#className').dispatchEvent(new b.w.Event('input'));assert.equal(unloadIsGuarded(b),false);
});
test('theme-pack save failure has truthful feedback and safely retries the already-added themes',async()=>{
 const a=create(fixture(),{failWrite:true}),raw=a.store.get(KEY);Object.defineProperty(a.node('#themeFile'),'files',{value:[{text:async()=>JSON.stringify({themeIds:['penguin-pals']})}]});await a.node('#themeFile').onchange({target:a.node('#themeFile')});assert.ok(a.state().ownedThemes.includes('penguin-pals'));assert.match(a.node('#toast').textContent,/Not saved/);assertNotSaved(a);retryAndVerify(a,raw,a.state());
});
test('save read errors can retry safely, while read-only focus checks never mutate classroom state',()=>{
 const a=create(),original=a.state(),raw=a.store.get(KEY);a.failRead(true);a.w.dispatchEvent(new a.w.Event('focus'));assert.deepEqual(a.state(),original);assert.equal(a.store.get(KEY),raw);assert.equal(unloadIsGuarded(a),false);assert.equal(a.node('#retrySave').hidden,false);
 a.run('setChildPresent("qa-b",true)');const changed=a.state();assertNotSaved(a);a.failRead(false);a.node('#retrySave').click();assert.deepEqual(create(null,{store:a.store}).state(),changed);assert.equal(unloadIsGuarded(a),false);
});
