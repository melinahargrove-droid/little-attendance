const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),KEY='littleAttendanceCleanV4',windows=[];
afterEach(()=>windows.splice(0).forEach(w=>w.close()));
const configs=[['pumpkin-patch','pumpkinPatchAttendance','pumpkinWaitingZone','pumpkinHereZone','pumpkinClose'],['halloween','halloweenAttendance','halloweenWaiting','halloweenHere','halloweenClose'],['our-friends','ourFriendsAttendance','ourFriendsWaiting','ourFriendsHere','ourFriendsClose']];
function create(theme='pumpkin-patch',n=30,extra={},options={}){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://attendance.test/',runScripts:'outside-only'}),w=dom.window;windows.push(w);
 const saved={schemaVersion:1,roster:Array.from({length:n},(_,i)=>({id:'qa-'+i,name:'QA Friend '+i})),present:[],history:[],selectedTheme:theme,ownedThemes:['school-bus','apple-orchard',...configs.map(c=>c[0])],...extra};
 const store=new Map([[KEY,JSON.stringify(saved)]]);Object.defineProperty(w,'localStorage',{value:{getItem:key=>store.get(key)??null,setItem:(key,val)=>{if(options.failWrite)throw Error('full');store.set(key,val);}}});
 require('./lock-helper.cjs').installSingleDocumentLocks(w);w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'themes/apple-orchard/theme-config.json')))});
 const run=source=>vm.runInContext(source,dom.getInternalVMContext());for(const file of ['app.js','apple-adapter.js','bus-adapter.js','restored-theme-layouts.js','restored-themes.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
 run('acknowledgedAttendanceDay=localAttendanceDate()');return {w,run,store,node:s=>w.document.querySelector(s),nodes:s=>[...w.document.querySelectorAll(s)],state:()=>JSON.parse(run('JSON.stringify(data)'))};
}
function click(a,zone,id){a.node('#'+zone+' [data-child-id="'+id+'"]').click();}

test('all thirteen recovered images are byte-preserved and geometry has every locked slot',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'themes/restored-source-manifest.json')));assert.equal(manifest.assets.length,13);
 for(const item of manifest.assets)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,item.path))).digest('hex'),item.sha256,item.path);
 const a=create();for(const n of [10,15,20,25,30]){for(const name of ['PUMPKIN_FINAL_PATCH_LAYOUTS','PUMPKIN_FINAL_CRATE_LAYOUTS'])assert.equal(a.run(name+'['+n+'].length'),n);for(const name of ['HALLOWEEN_WAITING','HALLOWEEN_HERE'])assert.equal(a.run(name+'['+n+'].positions.length'),n);}assert.equal(a.run('OUR_FRIENDS_WAITING.length'),30);assert.equal(a.run('OUR_FRIENDS_HERE.length'),30);
});
for(const [theme,screen,waiting,here,close] of configs){
 test(theme+' uses fixed roster slots through all five densities, reverse check-ins, return, Undo and Reset',()=>{
  for(const n of [10,15,20,25,30]){
   const a=create(theme,n);a.run('openAttendance()');assert.ok(a.node('#'+screen+'.active'));const before=new Map(a.nodes('#'+waiting+' button').map(el=>[el.dataset.childId,el.style.cssText]));
   for(let i=n-1;i>=0;i--){click(a,waiting,'qa-'+i);assert.equal(a.state().present.length,n-i);for(const el of a.nodes('#'+waiting+' button'))assert.equal(el.style.cssText,before.get(el.dataset.childId));}
   const positions=new Map(a.nodes('#'+here+' button').map(el=>[el.dataset.childId,el.style.cssText]));click(a,here,'qa-1');assert.equal(a.state().present.length,n-1);for(const el of a.nodes('#'+here+' button'))assert.equal(el.style.cssText,positions.get(el.dataset.childId));
   assert.equal(a.node('#'+waiting+' button').dataset.childId,'qa-1');a.node('#undoBtn').click();assert.equal(a.state().present.length,n-2);a.node('#resetBtn').click();assert.equal(a.state().present.length,0);assert.equal(a.nodes('#'+waiting+' button').length,n);a.node('#undoBtn').click();assert.equal(a.state().present.length,n-2);a.node('#'+close).click();assert.ok(a.node('#dashboard.active'));a.run('openAttendance()');assert.equal(a.nodes('#'+here+' button').length,n-2);
  }
 });
 test(theme+' routes all mutations through saved stable IDs and truthful save failure',()=>{
  const a=create(theme,3,{}, {failWrite:true});a.run('openAttendance()');const old=a.store.get(KEY);click(a,waiting,'qa-2');assert.deepEqual(a.state().present,['qa-2']);assert.equal(a.store.get(KEY),old);assert.equal(a.node('#storageWarning').hidden,false);assert.match(a.node('#toast').textContent,/Not saved/);a.run('editingLockHeld=false;renderEditingState()');assert.equal(a.node('#'+waiting+' button').getAttribute('aria-disabled'),'true');click(a,waiting,'qa-0');assert.deepEqual(a.state().present,['qa-2']);
 });
 test(theme+' day confirmation blocks a check-in and controls stay usable',()=>{
  const a=create(theme,3);a.run('acknowledgedAttendanceDay=null;openAttendance()');assert.equal(a.node('#newDayDialog').open,true);click(a,waiting,'qa-0');assert.deepEqual(a.state().present,[]);a.run('acknowledgedAttendanceDay=localAttendanceDate()');a.node('#newDayDialog').close();click(a,waiting,'qa-0');assert.deepEqual(a.state().present,['qa-0']);a.node('#'+screen+' .restored-tools button').click();assert.equal(a.node('#teacherDialog').open,true);
 });
 test(theme+' literal names, remote photo rejection, duplicate names and empty roster remain safe',()=>{
  const name='<img src=x onerror="alert(1)">';const a=create(theme,2,{roster:[{id:'qa-0',name,photo:'https://example.invalid/child.jpg'},{id:'qa-1',name}]});a.run('openAttendance()');assert.equal(a.nodes('#'+waiting+' [onerror]').length,0);assert.equal(a.nodes('#'+waiting+' img[src^="https:"]').length,0);assert.equal(a.node('#'+waiting+' button').getAttribute('aria-label'),'Mark here '+name);click(a,waiting,'qa-1');assert.deepEqual(a.state().present,['qa-1']);assert.equal(a.node('#'+waiting+' button').dataset.childId,'qa-0');a.run('data.roster=[];openAttendance()');assert.ok(a.node('#classroom.active'));
 });
 test(theme+' newer navigation never queues a late state mutation',async()=>{
  const a=create(theme,3);a.run('openAttendance()');click(a,waiting,'qa-1');a.node('#'+close).click();const state=a.state();await new Promise(r=>setTimeout(r,700));assert.deepEqual(a.state(),state);assert.ok(a.node('#dashboard.active'));assert.equal(a.nodes('.restored-flight').length,0);
 });
}
test('restoration does not migrate defaults, ownership, current theme or saved bytes on load',()=>{
 const a=create('school-bus',3,{ownedThemes:['school-bus','apple-orchard']});const raw=a.store.get(KEY);assert.equal(a.run('themeCatalog[0].id'),'school-bus');assert.deepEqual(a.state().ownedThemes,['school-bus','apple-orchard']);assert.equal(a.state().selectedTheme,'school-bus');assert.equal(a.store.get(KEY),raw);assert.equal(a.run('themeCatalog.length'),21);
 a.run('renderThemeGrid()');for(const name of ['Our Friends','Halloween','Pumpkin Patch']){const card=a.nodes('.theme-card').find(el=>el.querySelector('h3').textContent===name);assert.match(card.textContent,/Locked/);card.click();assert.equal(a.state().selectedTheme,'school-bus');}
});
