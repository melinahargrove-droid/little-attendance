// Called by the shared synthetic browser runner. No real classroom access.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
module.exports=async function({scenario,seed,state,out}){
 const landscapeReport=[];
 const fixture=n=>({schemaVersion:1,className:'QA Synthetic Bus Class',roster:Array.from({length:n},(_,i)=>({id:'bus-qa-'+i,name:'QA Friend '+String(i+1).padStart(2,'0')})),present:[],history:[],selectedTheme:'school-bus',ownedThemes:['school-bus']});
 const visible=zone=>'#'+zone+' button:not(.is-placeholder)';
 const boxes=page=>page.locator('.bus-la-child').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return{id:node.dataset.childId,zone:node.classList.contains('waiting')?'waiting':'here',x:b.x,y:b.y,w:b.width,h:b.height};}));
 const assertFixed=(before,after)=>{
  assert.equal(after.length,before.length);
  before.forEach((a,i)=>{const b=after[i];assert.equal(b.id,a.id);assert.equal(b.zone,a.zone);for(const key of ['x','y','w','h'])assert.ok(Math.abs(a[key]-b[key])<.1,`${a.id} ${a.zone} ${key} moved`);});
 };
 await scenario('School Bus original art, fixed geometry and all full-roster physical taps',async page=>{
  for(const viewport of [{width:1671,height:941},{width:1280,height:720},{width:1181,height:757},{width:1024,height:768}]){
   await page.setViewportSize(viewport);
   for(const n of [2,10,15,20,25,30]){
    await seed(page,fixture(n));await page.locator('#takeHotspot').click();await page.locator('#busAttendance.active').waitFor();
    assert.deepEqual(await page.locator('.bus-la-bg').evaluate(async img=>{await img.decode();return[img.naturalWidth,img.naturalHeight];}),[1671,941]);
    assert.equal(await page.locator('#busTeacher').textContent(),'Attendance Controls');
    const geometry=await page.locator('.bus-la-window').evaluate(el=>{const c=getComputedStyle(el),p=el.parentElement.getBoundingClientRect();return{left:parseFloat(c.left)/p.width,top:parseFloat(c.top)/p.height,width:parseFloat(c.width)/p.width,height:parseFloat(c.height)/p.height,transform:c.transform};});
    for(const [key,expected] of Object.entries({left:.408,top:.361,width:.518,height:.20188}))assert.ok(Math.abs(geometry[key]-expected)<.0001,key);
    assert.equal(geometry.transform,'matrix(1, 0, 0, 1, 0, 15)');
    const before=await boxes(page);assert.ok(before.every(b=>b.w>=24 && b.h>=24),`at least 24px targets at ${viewport.width}/${n}`);
    landscapeReport.push({viewport,count:n,waitingFit:await page.locator('#busWaitingLayer').getAttribute('data-fit'),label:await page.locator('#busWaitingLayer .bus-la-name').first().evaluate(el=>({font:getComputedStyle(el).fontSize,text:el.textContent})),targets:before});fs.writeFileSync(path.join(out,'bus-landscape-observations.json'),JSON.stringify(landscapeReport,null,2));await page.screenshot({path:path.join(out,`bus-${viewport.width}-${n}-waiting.png`)});
    const clipped=await page.locator(visible('busWaitingLayer')).evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect(),z=node.closest('.bus-la-waiting').getBoundingClientRect();return r.left<z.left-1||r.right>z.right+1||r.top<z.top-1||r.bottom>z.bottom+1;}).map(node=>node.dataset.childId));
    assert.deepEqual(clipped,[],`all ${n} waiting children fit at ${viewport.width}`);
    for(let i=n-1;i>=0;i--){
     const name='QA Friend '+String(i+1).padStart(2,'0');
     // Real hit-tested click, never force or dispatchEvent.
     await page.getByRole('button',{name:'Mark here '+name,exact:true}).click();assert.equal((await state(page)).present.length,n-i);assertFixed(before,await boxes(page));
    }
    assert.equal(await page.locator('#busHereCount').textContent(),String(n));assert.equal(await page.locator('#busWaitingCount').textContent(),'0');
    assert.equal(await page.locator(visible('busHereLayer')+' .bus-la-name').first().evaluate(el=>getComputedStyle(el).display),'none');
    const clippedRiders=await page.locator(visible('busHereLayer')+' .bus-la-avatar').evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect(),z=node.closest('.bus-la-window').getBoundingClientRect();return r.left<z.left-1||r.right>z.right+1||r.top<z.top-1||r.bottom>z.bottom+1;}).length);assert.equal(clippedRiders,0);
    await page.screenshot({path:path.join(out,`bus-${viewport.width}-${n}-here.png`)});
    await page.getByRole('button',{name:'Return QA Friend 01',exact:true}).click();assertFixed(before,await boxes(page));assert.equal((await state(page)).present.length,n-1);
    await page.getByRole('button',{name:'Mark here QA Friend 01',exact:true}).click();await page.locator('#busTeacher').click();await page.locator('#undoBtn').click();await page.locator('#closeTeacher').click();assert.equal((await state(page)).present.includes('bus-qa-0'),false);assertFixed(before,await boxes(page));
    await page.locator('#busClose').click();assert.equal(await page.locator('#dashboard.active').count(),1);await page.locator('#takeHotspot').click();assert.equal(await page.locator('#busHereCount').textContent(),String(n-1));
    await page.reload();await page.locator('#takeHotspot').click();assert.equal(await page.locator('#busHereCount').textContent(),String(n-1));
    await page.locator('#busTeacher').click();page.once('dialog',d=>d.accept());await page.locator('#resetBtn').click();assert.equal(await page.locator('#busHereCount').textContent(),'0');assert.equal((await state(page)).history.length,0);
   }
  }
 });
 await scenario('School Bus portrait evidence without substituting another board',async page=>{
  const report=[];
  for(const viewport of [{width:768,height:1024},{width:390,height:844}]){
   await page.setViewportSize(viewport);await seed(page,fixture(30));await page.locator('#takeHotspot').click();await page.locator('#busAttendance.active').waitFor();await page.locator('.bus-la-bg').evaluate(img=>img.decode());
   await page.screenshot({path:path.join(out,`bus-portrait-${viewport.width}-30.png`)});
   report.push({viewport,targets:await boxes(page),waitingFit:await page.locator('#busWaitingLayer').getAttribute('data-fit'),note:'Original landscape art retained; this capture documents portrait limits, not portrait usability certification'});
  }
  fs.writeFileSync(path.join(out,'bus-portrait-observations.json'),JSON.stringify(report,null,2));
 });
 await scenario('School Bus keyboard operation, local photo fallback and failed-art navigation',async(page,context)=>{
  const seedData=fixture(2);seedData.roster[0].name='<img src=x onerror="window.QAInjected=true"> & QA';seedData.roster[0].photo='https://untrusted.example/child-photo';seedData.roster[1].photo='data:image/png;base64,notapicture';
  await seed(page,seedData);await page.locator('#takeHotspot').click();assert.equal(await page.locator('#busWaitingLayer .bus-la-name').first().textContent(),seedData.roster[0].name);assert.equal(await page.evaluate(()=>window.QAInjected),undefined);assert.equal(await page.locator('.bus-la-avatar img').count(),0);
  await page.locator(visible('busWaitingLayer')).first().focus();await page.keyboard.press('Enter');assert.equal((await state(page)).present.length,1);assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('aboard')),true);await page.keyboard.press('Space');assert.equal((await state(page)).present.length,0);
  await page.locator('#busClose').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#dashboard.active').count(),1);
  await context.route('**/themes/school-bus/background.png',route=>route.abort());await page.reload();await page.locator('#takeHotspot').click();await page.locator('#attendance.active').waitFor();assert.equal(await page.locator('#studentGrid button').count(),2);await page.locator('#studentGrid button').first().click();await page.locator('#teacherBtn').click();await page.locator('#undoBtn').click();assert.equal(await page.locator('#hereCount').textContent(),'0');
 });
};
