// Synthetic local-only fixtures. Never reads a deployed classroom.
const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),KEY='littleAttendanceCleanV4',BACKUP=KEY+'_beforeStableIds';
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const windows=[];afterEach(()=>{windows.splice(0).forEach(w=>w.close());});
const fixture=(n=10,extra={})=>({schemaVersion:1,className:'QA Synthetic Bus Class',roster:Array.from({length:n},(_,i)=>({id:'qa-'+i,name:'QA Friend '+i})),present:[],history:[],selectedTheme:'school-bus',ownedThemes:['school-bus','apple-orchard'],...extra});
function create(saved=fixture(),options={}){
 const dom=new JSDOM(html,{url:'https://attendance.test/',runScripts:'outside-only'}),w=dom.window,d=w.document;windows.push(w);
 const store=options.store||new Map([[KEY,typeof saved==='string'?saved:JSON.stringify(saved)]]);
 Object.defineProperty(w,'localStorage',{value:{getItem:key=>store.get(key)??null,setItem:(key,val)=>{if(options.failWrite)throw Error('full');store.set(key,val);}}});
 w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'themes/apple-orchard/theme-config.json')))});
 const run=source=>vm.runInContext(source,dom.getInternalVMContext());
 for(const file of ['app.js','apple-adapter.js','bus-adapter.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
 run("acknowledgedAttendanceDay=localAttendanceDate()");
 return{w,d,run,store,node:s=>d.querySelector(s),state:()=>JSON.parse(run('JSON.stringify(data)'))};
}
const visible=(a,zone)=>[...a.d.querySelectorAll('#'+zone+' button:not(.is-placeholder)')];
const click=(a,zone,id)=>a.d.querySelector('#'+zone+' [data-child-id="'+id+'"]').click();

test('bus original artwork, locked geometry, and approved home pixels are byte-preserved',()=>{
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 assert.equal(hash('themes/school-bus/background.png'),'c0701618a36c4982d0a6ca74fbc94a276e160012574537e3d4ec52f6349918ce');
 assert.equal(hash('themes/school-bus/bus-approved-layout.json'),'32a476e0b9dbae93b979c29d1dd35f5303aa160240168f8d3f2e2e9e607c3e07');
 assert.equal(hash('assets/home-approved.png'),'74656937c2a43727219a3c9ddaa51738e57ed6871a65db774d3e102b0208c7e2');
 const css=fs.readFileSync(path.join(root,'bus-adapter.css'),'utf8');
 for(const locked of ['translate(-10px,-15px) scale(.95)','translate(-5px,35px)','translate(0px,35px)','top:36.1%','height:20.188%','translate(0px,15px)'])assert.ok(css.includes(locked),locked);
 assert.match(css,/\.bus-la-child.is-placeholder\{visibility:hidden;pointer-events:none\}/);
});

test('bus router uses neutral local art and keeps stable slots through every density',()=>{
 for(const n of [2,6,7,10,12,13,15,16,17,20,21,24,25,27,28,30]){
  const a=create(fixture(n));a.run('openAttendance()');assert.ok(a.node('#busAttendance.active'));
  assert.equal(a.node('.bus-la-bg').getAttribute('src'),'themes/school-bus/background.png');
  assert.equal(a.run('themeCatalog.find(t=>t.id==="school-bus").thumb'),'themes/school-bus/background.png');
  const original=[...a.node('#busWaitingLayer').children],riders=[...a.node('#busHereLayer').children],classes=a.node('.bus-la-stage').className;
  for(let i=n-1;i>=0;i--){click(a,'busWaitingLayer','qa-'+i);assert.equal(a.state().present.length,n-i);assert.equal(a.node('.bus-la-stage').className,classes);}
  assert.equal(visible(a,'busHereLayer').length,n);assert.equal(visible(a,'busWaitingLayer').length,0);
  assert.equal(a.node('#busHereCount').textContent,String(n));assert.equal(a.node('#busWaitingCount').textContent,'0');
  original.forEach((node,i)=>assert.equal(a.node('#busWaitingLayer').children[i],node));riders.forEach((node,i)=>assert.equal(a.node('#busHereLayer').children[i],node));
  click(a,'busHereLayer','qa-0');assert.equal(visible(a,'busWaitingLayer')[0],original[0]);assert.equal(a.state().history.includes('qa-0'),false);
  assert.equal(original[1].disabled,true);assert.equal(original[1].getAttribute('aria-hidden'),'true');assert.equal(original[1].tabIndex,-1);
 }
});

test('bus repeated taps, keyboard focus, close/reopen, Undo and Reset use current ID state',()=>{
 const a=create();a.run('openAttendance()');const waiting=a.node('#busWaitingLayer button');waiting.focus();waiting.click();waiting.click();
 assert.deepEqual(a.state().present,['qa-0']);assert.equal(a.d.activeElement.dataset.childId,'qa-0');assert.ok(a.d.activeElement.classList.contains('aboard'));
 click(a,'busWaitingLayer','qa-2');click(a,'busHereLayer','qa-0');click(a,'busWaitingLayer','qa-0');assert.deepEqual(a.state().history,['qa-2','qa-0']);
 a.node('#busClose').click();assert.ok(a.node('#dashboard.active'));a.run('openAttendance()');a.node('#busTeacher').click();assert.ok(a.node('#teacherDialog').open);a.node('#undoBtn').click();assert.deepEqual(a.state().present,['qa-2']);assert.equal(a.node('#busHereCount').textContent,'1');
 const b=create(null,{store:a.store});b.run('openAttendance()');assert.deepEqual(b.state().present,['qa-2']);assert.equal(visible(b,'busHereLayer').length,1);
 b.w.confirm=()=>false;b.node('#resetBtn').click();assert.deepEqual(b.state().present,['qa-2']);b.w.confirm=()=>true;b.node('#resetBtn').click();assert.deepEqual(b.state().present,[]);assert.deepEqual(b.state().history,[]);assert.equal(visible(b,'busWaitingLayer').length,10);
});

test('bus name/photo safety and initials fallback reject foreign sources and retain literal names',()=>{
 const payload='<img src=x onerror="window.QAInjected=true"> & QA';
 const raster='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCfkAAAAASUVORK5CYII=';
 const a=create(fixture(3,{roster:[{id:'qa-0',name:payload,photo:'https://untrusted.test/child-name'},{id:'qa-1',name:'QA Safe',photo:raster},{id:'qa-2',name:'QA Other',photo:'data:image/svg+xml;base64,PHN2Zy8+'}]}));a.run('openAttendance()');
 assert.equal(a.node('.bus-la-name').textContent,payload);assert.equal(a.w.QAInjected,undefined);
 assert.equal(a.d.querySelectorAll('.bus-la-avatar img').length,2);for(const image of a.d.querySelectorAll('.bus-la-avatar img'))assert.equal(image.getAttribute('src'),raster);
 assert.equal(a.node('#busWaitingLayer [data-child-id="qa-0"]').getAttribute('aria-label'),'Mark here '+payload);
 const img=a.node('#busWaitingLayer [data-child-id="qa-1"] img');img.dispatchEvent(new a.w.Event('error'));assert.equal(a.node('#busWaitingLayer [data-child-id="qa-1"] img'),null);assert.equal(a.node('#busWaitingLayer [data-child-id="qa-1"] .bus-la-initial').hidden,false);
});

test('bus retains migration backup, duplicate identity, extras and roster edits through reload',()=>{
 const old={roster:['QA Same','QA Same','QA Third'],present:[1],history:[1],selectedTheme:'school-bus',extraSetting:'kept'},raw=JSON.stringify(old);
 const a=create(raw);assert.equal(a.store.get(KEY),raw);a.run('openAttendance()');const [first,second,third]=a.state().roster;
 click(a,'busWaitingLayer',third.id);assert.equal(a.store.get(BACKUP),raw);
 a.run(`moveFriend(${JSON.stringify(second.id)},-1);data.roster.find(c=>c.id===${JSON.stringify(first.id)}).name='QA Renamed';save();openAttendance()`);
 assert.deepEqual(a.state().present,[second.id,third.id]);assert.equal(a.state().extraSetting,'kept');
 const b=create(null,{store:a.store});b.run('openAttendance()');b.node('#undoBtn').click();assert.deepEqual(b.state().present,[second.id]);assert.equal(b.store.get(BACKUP),raw);
});

test('bus storage failures and stale tabs do not overwrite saved classroom data',()=>{
 const original=JSON.stringify(fixture()),a=create(original,{failWrite:true});a.run('openAttendance()');click(a,'busWaitingLayer','qa-0');assert.equal(a.store.get(KEY),original);assert.equal(a.node('#storageWarning').hidden,false);assert.equal(a.node('#autosaveText').textContent,'Not saved');assert.deepEqual(a.state().present,['qa-0']);
 const b=create(),c=create(null,{store:b.store});b.run('openAttendance()');c.run('openAttendance()');click(b,'busWaitingLayer','qa-0');const latest=b.store.get(KEY);click(c,'busWaitingLayer','qa-1');assert.equal(b.store.get(KEY),latest);assert.match(c.node('#storageWarning').textContent,/another tab/);
});

test('bus failed background falls back safely and late load events never navigate after close',()=>{
 const a=create();a.run('openAttendance()');a.node('#busClose').click();a.node('.bus-la-bg').dispatchEvent(new a.w.Event('error'));assert.ok(a.node('#dashboard.active'));a.run('openAttendance()');assert.ok(a.node('#attendance.active'));assert.equal(a.d.querySelectorAll('#studentGrid button').length,10);
 a.node('#studentGrid button').click();a.node('#undoBtn').click();assert.equal(a.node('#hereCount').textContent,'0');a.node('.bus-la-bg').dispatchEvent(new a.w.Event('load'));assert.ok(a.node('#attendance.active'));
});

test('bus adapter leaves Apple, other themes, generic actions, and empty classroom route intact',async()=>{
 const a=create(fixture(0));a.run('openAttendance()');assert.ok(a.node('#classroom.active'));
 const b=create(fixture(2,{selectedTheme:'apple-orchard'}));b.run('openAttendance()');await new Promise(r=>setImmediate(r));assert.ok(b.node('#appleAttendance.active'));b.node('#appleWaitLayer button').click();await new Promise(r=>setImmediate(r));b.node('#undoBtn').click();assert.deepEqual(b.state().present,[]);
 b.run('data.selectedTheme="fall-leaves";openAttendance()');assert.ok(b.node('#fallLeavesAttendance.active'));assert.equal(b.run('themeCatalog.length'),19);
});

test('overflow fitting chooses readable rows inside the same shelter and caches stable slots',()=>{
 const a=create(fixture(20));a.run('openAttendance()');
 const outer=a.node('.bus-la-waiting'),grid=a.node('#busWaitingLayer');
 let width=1671*.282,height=941*.445,measurements=0;
 outer.getBoundingClientRect=()=>({width:width*.95,height:height*.95});grid.style.padding='10px 14px';
 for(const [i,node] of [...grid.children].entries()){
  const rect=()=>{
   measurements++;
   const inner=width*parseFloat(grid.style.width||'100')/100,columns=Math.max(1,Math.floor((inner-28+9)/(74+9))),row=Math.floor(i/columns),col=i%columns;
   const label=Math.max(11,parseFloat(grid.style.getPropertyValue('--bus-la-name-floor'))||0),cardHeight=62+label;
   return{left:col*83*.95,right:(col*83+74)*.95,top:row*(cardHeight+10)*.95,bottom:(row*(cardHeight+10)+cardHeight)*.95};
  };
  node.getBoundingClientRect=rect;node.querySelector('.bus-la-avatar').getBoundingClientRect=rect;
 }
 a.w.dispatchEvent(new a.w.Event('resize'));assert.equal(grid.dataset.fit,'1');assert.equal(grid.dataset.fitWidth,'100');assert.equal(grid.style.getPropertyValue('--bus-la-name-floor'),'');
 width=1024*.282;height=768*.445;a.w.dispatchEvent(new a.w.Event('resize'));
 assert.ok(Number(grid.dataset.fitWidth)>100);assert.ok(Number(grid.dataset.fit)>.75);assert.ok(Math.max(11,parseFloat(grid.style.getPropertyValue('--bus-la-name-floor')))*.95*Number(grid.dataset.fit)>=7.59);
 const before=measurements,fit=grid.dataset.fit;click(a,'busWaitingLayer','qa-2');assert.equal(grid.dataset.fit,fit);assert.equal(measurements,before,'arrival does not remeasure or reposition slots');
});

test('readable labels retain a separate hidden source footprint and full literal accessible name',()=>{
 const name='QA Amara Washington',a=create(fixture(1,{roster:[{id:'qa-0',name}]}));a.run('openAttendance()');
 const button=a.node('#busWaitingLayer button'),slot=button.querySelector('.bus-la-label-slot');
 assert.equal(slot.querySelector('.bus-la-name').textContent,name);assert.equal(slot.querySelector('.bus-la-name-measure').textContent,name);assert.equal(slot.querySelector('.bus-la-name-measure').getAttribute('aria-hidden'),'true');assert.equal(button.getAttribute('aria-label'),'Mark here '+name);
 const css=fs.readFileSync(path.join(root,'bus-adapter.css'),'utf8');assert.match(css,/\.bus-la-child \.bus-la-label-slot \.bus-la-name\{position:absolute/);assert.match(css,/\.bus-la-name-measure\{display:block;visibility:hidden;pointer-events:none\}/);
});
