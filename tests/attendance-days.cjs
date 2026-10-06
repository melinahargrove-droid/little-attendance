// Multi-document fixtures here intentionally model sequential reloads or
// non-cooperating external/legacy writers with isolated mock lock managers.
// Native cooperating-tab serialization is covered in single-writer-browser.cjs.
// Fictional classroom only. These are DOM/state checks, not browser-engine QA.
const {test,afterEach}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const ROOT=path.resolve(__dirname,'..'),KEY='littleAttendanceCleanV4',windows=[];
afterEach(()=>windows.splice(0).forEach(w=>w.close()));
const fixture=(extra={})=>({schemaVersion:1,className:'QA Fictional Class',roster:[{id:'qa-a',name:'QA Same',photo:'data:image/png;base64,fictional',profile:{color:'blue'}},{id:'qa-b',name:'QA Same'},{id:'qa-c',name:'QA Third'}],present:['qa-a','qa-c'],history:['qa-a','qa-c'],selectedTheme:'school-bus',ownedThemes:['school-bus','apple-orchard'],...extra});
function create(saved=fixture(),options={}){
 const dom=new JSDOM(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),{url:'https://attendance.test',runScripts:'outside-only'}),w=dom.window;windows.push(w);
 const store=options.store||new Map(saved===null?[]:[[KEY,typeof saved==='string'?saved:JSON.stringify(saved)]]);let failWrite=options.failWrite,failRead=options.failRead,clock='2026-10-05T12:00:00';const NativeDate=w.Date;
 w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return new NativeDate(clock).getTime();}};
 Object.defineProperty(w,'localStorage',{value:{getItem:key=>{if(failRead)throw Error('Synthetic read error');return store.get(key)??null;},setItem:(key,value)=>{if(failWrite)throw Error('Synthetic full storage');store.set(key,value);}}});
 require('./lock-helper.cjs').installSingleDocumentLocks(w);
 w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(ROOT,'themes/apple-orchard/theme-config.json')))});
 const run=s=>vm.runInContext(s,dom.getInternalVMContext());for(const file of ['app.js','apple-adapter.js','bus-adapter.js'])run(fs.readFileSync(path.join(ROOT,file),'utf8'));
 return{w,run,store,node:s=>w.document.querySelector(s),state:()=>JSON.parse(run('JSON.stringify(data)')),failWrite:v=>failWrite=v,failRead:v=>failRead=v,time:v=>clock=v};
}
const toggle=(a,on)=>{a.node('#saveAttendanceHistory').checked=on;a.node('#saveAttendanceHistory').dispatchEvent(new a.w.Event('change'));};
const keep=a=>{a.run('ensureAttendanceDay()');a.node('#keepCurrentDay').click();};
const start=a=>{a.run('ensureAttendanceDay(true)');a.node('#startNewDay').click();};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const activeRecord=a=>a.state().attendanceRecords.find(r=>r.id===a.state().attendanceRecordId);

test('migration never writes on load, dates legacy data, or opts in; exact backup and schema 2 persist',()=>{
 const old=fixture(),a=create(old),raw=JSON.stringify(old);assert.equal(a.store.get(KEY),raw);assert.equal(a.state().attendanceDay,null);assert.equal(a.state().saveAttendanceHistory,false);assert.deepEqual(a.state().attendanceRecords,[]);assert.equal(a.node('#newDayDialog').open,false);
 a.run('save()');assert.equal(a.store.get(KEY+'_beforeAttendanceDays'),raw);assert.equal(a.state().schemaVersion,2);const b=create(null,{store:a.store});assert.deepEqual(b.state(),a.state());b.run('save()');assert.equal(b.store.get(KEY+'_beforeAttendanceDays'),raw);
 const legacy={roster:['QA Old'],present:[0],history:[0]},c=create(legacy);c.run('save()');assert.equal(c.store.get(KEY+'_beforeStableIds'),JSON.stringify(legacy));assert.equal(c.store.get(KEY+'_beforeAttendanceDays'),JSON.stringify(legacy));
});
test('fresh and empty legacy classrooms remain undated until an explicit start',()=>{
 for(const saved of [null,fixture({roster:[],present:[],history:[]})]){const a=create(saved),raw=a.store.get(KEY);assert.equal(a.state().attendanceDay,null);a.run('ensureAttendanceDay()');assert.equal(a.store.get(KEY),raw);a.node('#keepCurrentDay').click();assert.equal(a.state().attendanceDay,null);start(a);assert.equal(a.state().attendanceDay,'2026-10-05');}
});
test('legacy prompt, Keep and Escape preserve attendance and prevent repeated prompting in the same session',()=>{
 const a=create(),before=a.state(),raw=a.store.get(KEY);a.run('openAttendance()');assert.equal(a.node('#newDayDialog').open,true);assert.match(a.node('#newDayMessage').textContent,/undated/);a.node('#keepCurrentDay').click();a.run('openAttendance()');assert.equal(a.node('#newDayDialog').open,false);assert.deepEqual(a.state(),before);assert.equal(a.store.get(KEY),raw);
 a.run('ensureAttendanceDay(true)');a.node('#newDayDialog').dispatchEvent(new a.w.Event('cancel'));a.node('#newDayDialog').close();a.run('openAttendance()');assert.equal(a.node('#newDayDialog').open,false);assert.deepEqual(a.state(),before);
});
test('toggle is remembered; undated records are honest and contain only name/id/status',()=>{
 const a=create();toggle(a,true);assert.equal(a.state().attendanceDay,null);assert.deepEqual(activeRecord(a).students[0],{id:'qa-a',name:'QA Same',present:true});assert.equal(activeRecord(a).date,null);assert.equal(JSON.stringify(activeRecord(a)).includes('photo'),false);assert.equal(create(null,{store:a.store}).state().saveAttendanceHistory,true);
 toggle(a,false);assert.equal(create(null,{store:a.store}).state().saveAttendanceHistory,false);
});
test('history off preserves records byte-for-byte through check-ins, reset, removal, undo, roster changes and new day',()=>{
 const a=create();keep(a);toggle(a,true);toggle(a,false);const records=JSON.stringify(a.state().attendanceRecords);
 for(const action of ['setChildPresent("qa-b",true)','resetAttendance()','undoAttendance()','removeFriend("qa-a")','undoAttendance()','data.roster[0].name="QA Renamed";save()','moveFriend("qa-a",1)']){a.run(action);assert.equal(JSON.stringify(a.state().attendanceRecords),records);}
 start(a);assert.equal(JSON.stringify(a.state().attendanceRecords),records);assert.equal(a.state().attendanceDay,'2026-10-05');
});
test('starting today preserves prior record and creates a clear dated record without a daily save question',()=>{
 const a=create();toggle(a,true);const old=activeRecord(a);start(a);assert.equal(a.node('#newDayDialog').open,false);assert.equal(a.state().attendanceDay,'2026-10-05');assert.deepEqual(a.state().present,[]);assert.deepEqual(a.state().attendanceRecords[0],old);assert.equal(activeRecord(a).students.some(c=>c.present),false);const before=a.state();a.node('#startNewDay').click();assert.deepEqual(a.state(),before);
 a.run('setChildPresent("qa-b",true)');assert.equal(activeRecord(a).students[1].present,true);a.run('undoAttendance()');assert.equal(activeRecord(a).students[1].present,false);
});
test('date changes prompt on reload, focus, visible tab, and minute check without silent clearing',()=>{
 const a=create();start(a);a.run('setChildPresent("qa-a",true)');const saved=a.state();a.time('2026-10-06T00:00:01');a.w.dispatchEvent(new a.w.Event('focus'));assert.equal(a.node('#newDayDialog').open,true);assert.deepEqual(a.state(),saved);a.node('#keepCurrentDay').click();a.run('checkAttendanceDate()');assert.equal(a.node('#newDayDialog').open,false);
 const b=create({...saved,attendanceDay:'2026-10-04'});assert.equal(b.node('#newDayDialog').open,true);assert.deepEqual(b.state().present,['qa-a']);
 a.time('2026-10-07T00:00:01');Object.defineProperty(a.w.document,'visibilityState',{value:'visible'});a.w.document.dispatchEvent(new a.w.Event('visibilitychange'));assert.equal(a.node('#newDayDialog').open,true);a.node('#keepCurrentDay').click();a.time('2026-10-08T00:00:01');a.run('checkAttendanceDate()');assert.equal(a.node('#newDayDialog').open,true);
});
test('clock changes while confirming require refreshed date confirmation; same-date revisits keep distinct records',()=>{
 const a=create();toggle(a,true);a.run('ensureAttendanceDay()');a.time('2026-10-06T00:00:01');a.node('#startNewDay').click();assert.equal(a.state().attendanceDay,null);assert.match(a.node('#startNewDay').textContent,/2026-10-06/);a.node('#startNewDay').click();assert.equal(a.state().attendanceDay,'2026-10-06');a.time('2026-10-05T12:00:00');start(a);a.time('2026-10-06T12:00:00');start(a);const same=a.state().attendanceRecords.filter(r=>r.date==='2026-10-06');assert.equal(same.length,2);assert.notEqual(same[0].id,same[1].id);
});
for(const on of [false,true])test(`failed start with history ${on?'on':'off'} retains exact old session/storage, retry does not start twice`,()=>{
 const a=create();toggle(a,on);const before=a.state(),raw=a.store.get(KEY);a.failWrite(true);start(a);assert.deepEqual(a.state(),before);assert.equal(a.store.get(KEY),raw);assert.equal(a.node('#newDayDialog').open,true);assert.match(a.node('#toast').textContent,/did not start/);a.node('#startNewDay').click();assert.deepEqual(a.state(),before);
 a.failWrite(false);a.node('#newDayDialog .storage-warning-dialog button').click();assert.deepEqual(a.state(),before);a.node('#startNewDay').click();assert.equal(a.state().attendanceDay,'2026-10-05');const after=a.state();a.node('#startNewDay').click();assert.deepEqual(a.state(),after);
});
test('failed start preserves previously unsaved changes and unload warning',()=>{
 const a=create();keep(a);a.failWrite(true);a.run('setChildPresent("qa-b",true)');const before=a.state();start(a);assert.deepEqual(a.state(),before);const event=new a.w.Event('beforeunload',{cancelable:true});a.w.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
});
test('detected newer tab, unreadable storage, and backup failure cannot start or overwrite the old board',()=>{
 const a=create(),b=create(null,{store:a.store}),before=b.state();a.run('data.className="QA Newer";save()');const raw=a.store.get(KEY);start(b);assert.deepEqual(b.state(),before);assert.equal(b.store.get(KEY),raw);assert.equal(b.run('storageBlocked'),true);assert.equal(b.node('#newDayDialog .storage-warning-dialog button').hidden,true);
 const c=create();c.failRead(true);const old=c.state();start(c);assert.deepEqual(c.state(),old);
 const d=create(undefined,{failWrite:true}),original=d.store.get(KEY);start(d);assert.equal(d.store.get(KEY),original);assert.equal(d.state().attendanceDay,null);
});
test('completed historical names survive later roster renames, reorder, removal and undo',()=>{
 const a=create();toggle(a,true);start(a);a.run('setChildPresent("qa-a",true)');const day=activeRecord(a);a.time('2026-10-06T12:00:00');start(a);a.run('data.roster[0].name="QA New Name";save();moveFriend("qa-a",1);removeFriend("qa-a");undoAttendance()');assert.deepEqual(a.state().attendanceRecords.find(r=>r.id===day.id),day);assert.equal(activeRecord(a).students.find(c=>c.id==='qa-a').name,'QA New Name');
});
for(const theme of ['school-bus','apple-orchard','fall-leaves','pumpkin-patch'])test(`${theme}: reset Undo restores attendance/order and earlier Undo without reverting roster/settings`,async()=>{
 const a=create(fixture({selectedTheme:theme}));keep(a);a.run('openAttendance()');await settle();const before=a.state();toggle(a,true);a.node('#resetBtn').click();assert.deepEqual(a.state().present,[]);a.run('data.className="QA Changed Class";data.roster[0].name="QA Renamed";moveFriend("qa-a",1);save()');a.node('#undoBtn').click();await settle();assert.deepEqual(a.state().present,before.present);assert.deepEqual(a.state().history,before.history);assert.equal(a.state().className,'QA Changed Class');assert.equal(a.state().roster[1].name,'QA Renamed');assert.equal(activeRecord(a).students.filter(c=>c.present).length,2);a.node('#undoBtn').click();assert.deepEqual(a.state().present,['qa-a']);
});
test('repeated reset does not hide useful recovery; check-in/return after reset preserves earlier Undo',()=>{
 const a=create();keep(a);a.run('resetAttendance();resetAttendance();setChildPresent("qa-b",true);setChildPresent("qa-b",false);undoAttendance()');assert.deepEqual(a.state().present,['qa-a','qa-c']);a.run('undoAttendance()');assert.deepEqual(a.state().present,['qa-a']);
});
test('removal undo retains exact profile/id/status and former position, leaving other edits and duplicate names alone',()=>{
 const a=create();keep(a);const child=a.state().roster[0];a.run('removeFriend("qa-a");data.roster[0].name="QA Other Changed";data.className="QA New Class";moveFriend("qa-c",-1);save()');a.node('#undoBtn').click();assert.deepEqual(a.state().roster[0],child);assert.equal(a.state().roster[2].name,'QA Other Changed');assert.equal(a.state().className,'QA New Class');assert.deepEqual(a.state().present,['qa-a','qa-c']);assert.deepEqual(a.state().history,['qa-a','qa-c']);
});
test('removal Undo survives reload; it cannot replace a reused ID or overflow the class',()=>{
 const a=create();a.run('removeFriend("qa-a")');const b=create(null,{store:a.store});b.run('undoAttendance()');assert.equal(b.state().roster[0].id,'qa-a');
 b.run('removeFriend("qa-a");data.roster.push({id:"qa-a",name:"QA Unrelated"});undoAttendance()');assert.equal(b.state().roster.at(-1).name,'QA Unrelated');assert.equal(b.state().undoActions.at(-1).type,'remove');b.run('data.roster.pop();while(data.roster.length<30)data.roster.push({id:"qa-extra-"+data.roster.length,name:"QA Extra"});undoAttendance()');assert.equal(b.state().roster.length,30);assert.equal(b.state().undoActions.at(-1).type,'remove');
});
test('failed recovery keeps recovered session with truthful retry, and failed toggle keeps prior saved preference',()=>{
 const a=create();keep(a);a.run('removeFriend("qa-a")');const raw=a.store.get(KEY);a.failWrite(true);a.run('undoAttendance()');assert.equal(a.state().roster[0].id,'qa-a');assert.equal(a.store.get(KEY),raw);assert.match(a.node('#toast').textContent,/Not saved/);a.failWrite(false);a.node('#retrySave').click();assert.equal(create(null,{store:a.store}).state().roster[0].id,'qa-a');
 a.failWrite(true);toggle(a,true);assert.equal(a.state().saveAttendanceHistory,true);assert.equal(create(null,{store:a.store}).state().saveAttendanceHistory,false);assert.equal(a.node('#storageWarning').hidden,false);a.failWrite(false);a.node('#retrySave').click();assert.equal(create(null,{store:a.store}).state().saveAttendanceHistory,true);
});
test('corrupt or unsupported new fields are never silently normalized or overwritten',()=>{
 const a=create();toggle(a,true);const good=a.state();for(const change of [{schemaVersion:3},{saveAttendanceHistory:'yes'},{attendanceDay:'2026-02-31'},{attendanceRecords:{}},{attendanceRecords:[{id:'x',date:'2026-10-05',students:[{id:'a',name:'QA A',present:'yes'}]}]},{undoActions:[{type:'erase'}]},{undoActions:[{type:'remove',child:{id:'a',name:'QA A'},index:0,presentIndex:-1,historyIndex:1}]},{schemaVersion:1}]){
  const value={...good,...change},b=create(value),raw=JSON.stringify(value);assert.equal(b.run('storageBlocked'),true);b.run('save()');assert.equal(b.store.get(KEY),raw);
 }
});
test('history renders literal names; printing includes only date/name/status and restores the dialog',()=>{
 const a=create(fixture({roster:[{id:'qa-a',name:'<img onerror="QAInjected=1"> & QA',photo:'data:image/png;base64,fictional'}],present:['qa-a'],history:['qa-a']}));toggle(a,true);a.node('#classHotspot').click();a.node('#classroomTeacher').click();a.node('#viewAttendanceHistory').click();assert.equal(a.node('#attendanceHistoryRows img'),null);assert.equal(a.node('#attendanceHistoryRows td').textContent,'<img onerror="QAInjected=1"> & QA');let calls=0;
 a.w.print=()=>{calls++;const surface=a.node('#attendancePrint');assert.match(surface.textContent,/Undated attendance/);assert.match(surface.textContent,/Here/);assert.equal(surface.querySelectorAll('img').length,0);assert.equal(surface.textContent.includes('fictional'),false);assert.equal(a.node('#attendanceHistoryDialog').open,false);assert.equal(a.w.document.body.classList.contains('printing-attendance'),true);};
 a.node('#printAttendanceRecord').click();assert.equal(calls,1);assert.equal(a.node('#attendanceHistoryDialog').open,false);assert.ok(a.node('#attendancePrint').children.length);a.run('printSavedAttendance()');assert.equal(calls,1);a.w.dispatchEvent(new a.w.Event('afterprint'));assert.equal(a.node('#attendanceHistoryDialog').open,true);assert.equal(a.node('#attendancePrint').children.length,0);assert.equal(a.w.document.body.classList.contains('printing-attendance'),false);a.node('#closeAttendanceHistory').click();assert.equal(a.node('#teacherDialog').open,true);
});

test('postponing midnight prompt leaves Start today available in controls without another edit',()=>{
 const a=create();start(a);assert.equal(a.node('#startTodayBtn').disabled,true);a.time('2026-10-06T12:00:00');a.w.dispatchEvent(new a.w.Event('focus'));a.node('#keepCurrentDay').click();a.node('#classHotspot').click();a.node('#classroomTeacher').click();assert.equal(a.node('#startTodayBtn').disabled,false);a.node('#startTodayBtn').click();assert.equal(a.node('#newDayDialog').open,true);a.node('#startNewDay').click();assert.equal(a.state().attendanceDay,'2026-10-06');
});
test('a check-in blocked by an unanswered day prompt does not falsely claim unsaved edits',()=>{
 const a=create(fixture({selectedTheme:'pumpkin-patch',present:[],history:[]}));a.run('openAttendance()');a.node('#studentGrid button').click();assert.deepEqual(a.state().present,[]);assert.equal(a.node('#storageWarning').hidden,true);assert.equal(a.node('#toast').textContent,'');
});

for(const route of ['openAttendance()','setChildPresent("qa-a",true)'])test(`postponing a day prompt from ${route} before the timer keeps Start today reachable`,()=>{
 const a=create();start(a);assert.equal(a.node('#startTodayBtn').disabled,true);a.time('2026-10-06T00:00:01');a.run(route);assert.equal(a.node('#newDayDialog').open,true);a.node('#keepCurrentDay').click();a.node('#classHotspot').click();a.node('#classroomTeacher').click();assert.equal(a.node('#startTodayBtn').disabled,false);a.node('#startTodayBtn').click();assert.equal(a.node('#newDayDialog').open,true);a.node('#startNewDay').click();assert.equal(a.state().attendanceDay,'2026-10-06');
});
function add(a,name){a.run('openFriendDialog()');a.node('#friendName').value=name;a.node('#friendForm').dispatchEvent(new a.w.Event('submit',{cancelable:true}));return a.state().roster.at(-1);}
function paste(a,names){a.node('#pasteListBtn').click();a.node('#pastedNames').value=names.join('\n');a.node('#pastedNames').dispatchEvent(new a.w.Event('input'));a.node('#pasteListForm').dispatchEvent(new a.w.Event('submit',{cancelable:true}));}
test('full-class replacement can undo newly added child then restore removed child exactly',()=>{
 const roster=Array.from({length:30},(_,i)=>({id:'qa-'+i,name:'QA Friend '+i,profile:{position:i}})),a=create(fixture({roster,present:['qa-0','qa-10'],history:['qa-10','qa-0']}));keep(a);const before=a.state();a.run('removeFriend("qa-0")');const added=add(a,'QA Replacement');assert.equal(a.state().roster.length,30);a.run(`data.roster.find(c=>c.id===${JSON.stringify(added.id)}).name="QA Renamed Replacement";moveFriend(${JSON.stringify(added.id)},-1);data.className="QA Unrelated Edit";save()`);a.node('#undoBtn').click();assert.equal(a.state().roster.length,29);assert.equal(a.state().roster.some(c=>c.id===added.id),false);a.node('#undoBtn').click();assert.deepEqual(a.state().roster,before.roster);assert.deepEqual(a.state().present,before.present);assert.deepEqual(a.state().history,before.history);assert.equal(a.state().className,'QA Unrelated Edit');
});
test('pasted addition Undo removes only created IDs after rename/reorder and survives reload',()=>{
 const a=create();keep(a);const before=a.state();paste(a,['QA New One','QA New Two']);const added=a.state().roster.slice(3).map(c=>c.id);a.run(`data.roster.find(c=>c.id===${JSON.stringify(added[0])}).name="QA Changed New";moveFriend(${JSON.stringify(added[1])},-1);data.roster[0].name="QA Existing Edit";save()`);const b=create(null,{store:a.store});b.run('undoAttendance()');assert.deepEqual(b.state().roster.map(c=>c.id),before.roster.map(c=>c.id));assert.equal(b.state().roster[0].name,'QA Existing Edit');assert.deepEqual(b.state().present,before.present);assert.deepEqual(b.state().history,before.history);
});
test('mixed add/check-in/reset/remove actions unwind chronologically without invalidating older recovery',()=>{
 const a=create();keep(a);const before=a.state();a.run('removeFriend("qa-a")');const added=add(a,'QA New');a.run(`setChildPresent(${JSON.stringify(added.id)},true);resetAttendance();removeFriend(${JSON.stringify(added.id)})`);a.run('undoAttendance()');assert.equal(a.state().roster.some(c=>c.id===added.id),true);assert.deepEqual(a.state().present,[]);a.run('undoAttendance()');assert.deepEqual(a.state().present,['qa-c',added.id]);a.run('undoAttendance()');assert.deepEqual(a.state().present,['qa-c']);a.run('undoAttendance()');assert.equal(a.state().roster.some(c=>c.id===added.id),false);a.run('undoAttendance()');assert.deepEqual(a.state().roster,before.roster);assert.deepEqual(a.state().present,before.present);assert.deepEqual(a.state().history,before.history);
});
test('bulk additions restore full-class capacity one chronological action at a time',()=>{
 const roster=Array.from({length:30},(_,i)=>({id:'qa-'+i,name:'QA Original '+i})),a=create(fixture({roster,present:['qa-0'],history:['qa-0']}));keep(a);a.run('removeFriend("qa-0");removeFriend("qa-1")');paste(a,['QA Replacement One','QA Replacement Two']);assert.equal(a.state().roster.length,30);a.run('undoAttendance();undoAttendance();undoAttendance()');assert.deepEqual(a.state().roster,roster);assert.deepEqual(a.state().present,['qa-0']);
});
