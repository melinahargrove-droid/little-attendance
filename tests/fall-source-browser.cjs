const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASE='https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/';
const FILES=['fall-background.png','fall-here-leaf.png','fall-waiting-leaf.png'];
const approved=require('./fixtures/fall-approved-layout.json');
const sizes=[10,15,20,25,30],viewports=[{width:1024,height:768},{width:1280,height:720},{width:1671,height:941}];
const fixture=(size,here=false)=>({schemaVersion:1,className:'QA Fall Source',roster:Array.from({length:size},(_,i)=>({id:'qa-leaf-'+i,name:'QA Leaf '+String(i+1).padStart(2,'0')})),present:here?Array.from({length:size},(_,i)=>'qa-leaf-'+i):[],history:[],selectedTheme:'fall-leaves',ownedThemes:['school-bus','apple-orchard','fall-leaves']});
async function allowArt(context){for(const file of FILES)await context.route(BASE+file,route=>route.continue());}
async function loaded(page){await page.locator('#fallLeavesAttendance.active').waitFor();await page.evaluate(async urls=>Promise.all(urls.map(async url=>{const image=new Image();image.src=url;await image.decode();})),FILES.map(file=>BASE+file));}
async function hitPoint(locator){return locator.evaluate(button=>{const photo=button.querySelector('.fall-la-photo'),b=photo.getBoundingClientRect();for(const fy of [.5,.35,.65,.2,.8])for(const fx of [.5,.35,.65,.2,.8]){const x=b.x+b.width*fx,y=b.y+b.height*fy;if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;const hit=document.elementFromPoint(x,y);if(hit===photo||photo.contains(hit))return{x,y};}return null;});}
async function snapshot(page){return page.locator('#fallLeavesZone button').evaluateAll(buttons=>Object.fromEntries(buttons.map(button=>{const b=button.getBoundingClientRect();return[button.querySelector('.fall-la-name').textContent,{x:b.x,y:b.y,w:b.width,h:b.height,parent:button.parentElement.className,style:button.getAttribute('style')}];})));}
module.exports=async({scenario,seed,state,out})=>{
 await scenario('Fall approved source geometry: all children are physically reachable in every computer density',async(page,context)=>{
  await allowArt(context);const coverage=[],missing=[];
  for(const viewport of viewports)for(const size of sizes)for(const here of [false,true]){
   await page.setViewportSize(viewport);await seed(page,fixture(size,here));await page.locator('#takeHotspot').click();await loaded(page);
   assert.deepEqual(await page.evaluate(()=>FALL_LEAVES_CONFIG),approved);
   const board=await page.locator('.fall-la-board').boundingBox();assert.ok(Math.abs(board.width-viewport.width)<.1);assert.ok(Math.abs(board.height-viewport.height)<.1);
   const selected=page.locator('#fallLeavesZone button'),buttons=await selected.count();assert.equal(buttons,size);const expectedAsset=BASE+(here?'fall-here-leaf.png':'fall-waiting-leaf.png');assert.ok((await selected.evaluateAll(buttons=>buttons.map(button=>getComputedStyle(button).backgroundImage))).every(background=>background.includes(expectedAsset)));
   await page.screenshot({path:path.join(out,'fall-source-'+viewport.width+'-'+size+'-'+(here?'here':'waiting')+'.png')});
   for(let i=0;i<size;i++){const name='QA Leaf '+String(i+1).padStart(2,'0'),button=page.getByRole('button',{name:(here?'Return ':'Mark here ')+name,exact:true}),point=await hitPoint(button);const entry={viewport,size,here,name,point};coverage.push(entry);if(!point)missing.push(entry);}
   fs.writeFileSync(path.join(out,'fall-source-hit-coverage.json'),JSON.stringify({coverage,missing},null,2));
   const counts=await page.locator('.fall-la-count').evaluateAll(elements=>elements.map(el=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height};}));
   for(const count of counts){assert.ok(count.y>=viewport.height*.23&&count.y+count.h<=viewport.height*.38,'Counter stays in its painted box');}
  }
  fs.writeFileSync(path.join(out,'fall-source-hit-coverage.json'),JSON.stringify({coverage,missing},null,2));assert.deepEqual(missing,[],'Every approved tree and pile slot must have a real visible photo hit target');
 });
 for(const viewport of viewports)await scenario('Fall arrivals, Undo and roster editing preserve source slots at '+viewport.width,async(page,context)=>{
  await allowArt(context);await page.setViewportSize(viewport);
  for(const size of sizes){
   await seed(page,fixture(size));await page.locator('#takeHotspot').click();await loaded(page);
   for(let i=0;i<size;i++){
    const name='QA Leaf '+String(i+1).padStart(2,'0'),before=await snapshot(page),button=page.getByRole('button',{name:'Mark here '+name,exact:true}),point=await hitPoint(button);assert.ok(point,name+' has a real tap target');await page.mouse.click(point.x,point.y);assert.equal((await state(page)).present.length,i+1);const after=await snapshot(page);for(const other of Object.keys(before))if(other!==name)assert.deepEqual(after[other],before[other],'Only the tapped child moves');
   }
   assert.equal(await page.locator('#fallHereCount').textContent(),String(size));assert.equal(await page.locator('#fallWaitingCount').textContent(),'0');
   await page.locator('#fallLeavesClose').click();await page.locator('#teacherHotspot').click();await page.locator('#undoBtn').click();await page.locator('#closeTeacher').click();await page.locator('#takeHotspot').click();assert.equal((await state(page)).present.length,size-1);assert.equal(await page.locator('.fall-la-tree-zone button').count(),1);
   const before=await snapshot(page),beforeState=await state(page);await page.locator('#fallLeavesClose').click();await page.locator('#classHotspot').click();await page.getByRole('button',{name:'Edit QA Leaf 01',exact:true}).click();await page.locator('#friendName').fill('QA Renamed Leaf');await page.locator('#saveFriend').click();await page.locator('#classroomAttendance').click();await loaded(page);
   const after=await snapshot(page);assert.deepEqual(after['QA Renamed Leaf'],before['QA Leaf 01']);for(const name of Object.keys(before))if(name!=='QA Leaf 01')assert.deepEqual(after[name],before[name]);assert.deepEqual((await state(page)).present,beforeState.present);assert.equal((await state(page)).roster[0].id,beforeState.roster[0].id);
   await page.screenshot({path:path.join(out,'fall-source-'+viewport.width+'-'+size+'-after-undo-rename.png')});
   const button=page.getByRole('button',{name:'Return QA Renamed Leaf',exact:true}),point=await hitPoint(button);assert.ok(point);await page.mouse.click(point.x,point.y);assert.equal((await state(page)).present.length,size-2);
  }
 });
 await scenario('Fall actual art keeps readonly Close physically reachable',async(page,context)=>{
  await allowArt(context);await seed(page,fixture(30));const reader=await context.newPage();await reader.goto(page.url());await reader.waitForFunction(()=>editingLockState==='blocked');await reader.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});const before=await state(reader);
  for(const viewport of viewports){await reader.setViewportSize(viewport);await reader.locator('#takeHotspot').click();await loaded(reader);await reader.screenshot({path:path.join(out,'fall-source-readonly-'+viewport.width+'.png')});await reader.locator('#fallLeavesClose').click();assert.equal(await reader.locator('#dashboard.active').count(),1);assert.deepEqual(await state(reader),before);}
 });
};
