// Two-action homepage, unchanged brand pixels, and visible navigation routes.
const assert=require('node:assert/strict'),path=require('node:path');
const {openClassroom,openAttendanceControls}=require('./navigation-helper.cjs');
const fixture=()=>({schemaVersion:1,className:'QA Two Action Home',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:['qa-a'],history:['qa-a'],selectedTheme:'school-bus',ownedThemes:['school-bus','apple-orchard','fall-leaves']});
async function assertHomeTargets(page){
 assert.deepEqual(await page.locator('#dashboard button').evaluateAll(buttons=>buttons.map(b=>[b.id,b.getAttribute('aria-label')])),[['takeHotspot','Take Attendance'],['classHotspot','My Classroom']]);
 assert.equal(await page.locator('#dashboard button:visible').count(),2);
 assert.equal(await page.locator('#teacherHotspot').count(),0,'The removed card has no ghost target');
 assert.equal(await page.locator('#dashboard [role="button"],#dashboard a,#dashboard input').count(),0,'No extra interactive home action');
 const buttons=await page.locator('#dashboard button').evaluateAll(buttons=>buttons.map(button=>{const b=button.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{x:b.x,y:b.y,w:b.width,h:b.height,hit:hit===button||button.contains(hit),inside:b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1};}));
 for(const b of buttons){assert.ok(b.inside);assert.ok(b.w>0&&b.h>0);assert.equal(b.hit,true,'Both painted cards have their own real hit target');}
 assert.ok(buttons[0].x+buttons[0].w<=buttons[1].x,'Home targets cannot overlap');
}
module.exports=async({scenario,seed,state,out})=>{
 await scenario('two-action home art, original transparent logo, keyboard and computer-size navigation',async page=>{
  await seed(page,fixture());const before=await state(page);
  const image=await page.locator('.dashboard-stage').evaluate(async el=>{const css=getComputedStyle(el).backgroundImage,img=new Image();img.src=css.slice(5,-2);await img.decode();return{path:new URL(img.src).pathname.split('/').pop(),width:img.naturalWidth,height:img.naturalHeight};});
  assert.deepEqual(image,{path:'home-two-actions.png',width:1672,height:941});
  await page.waitForFunction(()=>document.querySelector('.dashboard-stage').classList.contains('art-ready'));
  const logo=await page.locator('.dashboard-brand').evaluate(async img=>{await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let transparent=false,painted=false;for(let i=3;i<pixels.length;i+=4){transparent ||= pixels[i]===0;painted ||= pixels[i]>0;if(transparent&&painted)break;}return{source:img.getAttribute('src'),alt:img.alt,width:img.naturalWidth,height:img.naturalHeight,transparent,painted,background:getComputedStyle(img).backgroundColor};});
  assert.deepEqual(logo,{source:'assets/one-little-teacher-logo.png',alt:'One Little Teacher',width:2172,height:724,transparent:true,painted:true,background:'rgba(0, 0, 0, 0)'});
  for(const viewport of [{width:1280,height:720},{width:1024,height:768},{width:1920,height:1080},{width:768,height:1024},{width:390,height:844},{width:320,height:568}]){
   await page.setViewportSize(viewport);await assertHomeTargets(page);
   const logoBox=await page.locator('.dashboard-brand').boundingBox();assert.ok(Math.abs(logoBox.width/logoBox.height-3)<.02,'The brand keeps its original 3:1 ratio');
   await page.locator('#takeHotspot').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#classHotspot').evaluate(e=>e===document.activeElement),true);assert.notEqual(await page.locator('#classHotspot').evaluate(e=>getComputedStyle(e).boxShadow),'none');await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#takeHotspot').evaluate(e=>e===document.activeElement),true);
   await page.screenshot({path:path.join(out,'home-'+viewport.width+'.png')});
   // Small captures document home-only layout; board controls target computers.
   if(viewport.width<1024)continue;
   await page.keyboard.press('Enter');assert.equal(await page.locator('#busAttendance.active').count(),1);await page.locator('#busTeacher').click();assert.equal(await page.locator('#teacherDialog').isVisible(),true);await page.locator('#closeTeacher').click();await page.locator('#busClose').click();
   await page.locator('#classHotspot').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#classroom.active').count(),1);
   await openAttendanceControls(page);assert.equal(await page.locator('#teacherDialog').isVisible(),true);await page.locator('#closeTeacher').click();await page.locator('#classroomHome').click();assert.deepEqual(await state(page),before);
  }
 });
 await scenario('home actions and brand alternative remain usable when both images fail',async(page,context)=>{
  await context.route('**/assets/home-two-actions.png',route=>route.abort());await context.route('**/assets/one-little-teacher-logo.png',route=>route.abort());await seed(page,fixture());const before=await state(page);
  assert.equal(await page.locator('.dashboard-stage').evaluate(e=>e.classList.contains('art-ready')),false);await assertHomeTargets(page);
  for(const id of ['takeHotspot','classHotspot']){const button=page.locator('#'+id);assert.notEqual(await button.evaluate(e=>getComputedStyle(e).color),'rgba(0, 0, 0, 0)');assert.ok(await button.textContent());}
  assert.equal(await page.getByRole('img',{name:'One Little Teacher',exact:true}).count(),1);assert.equal(await page.locator('.dashboard-brand').evaluate(e=>e.complete&&e.naturalWidth===0),true);
  await page.screenshot({path:path.join(out,'home-art-and-logo-fallback.png')});await page.locator('#takeHotspot').click();assert.equal(await page.locator('#busAttendance.active').count(),1);await page.locator('#busClose').click();await openClassroom(page);assert.equal(await page.locator('#classroom.active').count(),1);assert.deepEqual(await state(page),before);
 });
 await scenario('missing logo does not disable the loaded two-action homepage',async(page,context)=>{
  await context.route('**/assets/one-little-teacher-logo.png',route=>route.abort());await seed(page,fixture());await page.waitForFunction(()=>document.querySelector('.dashboard-stage').classList.contains('art-ready'));await assertHomeTargets(page);assert.equal(await page.getByRole('img',{name:'One Little Teacher',exact:true}).count(),1);await openAttendanceControls(page);assert.equal(await page.locator('#teacherDialog').isVisible(),true);
 });
 await scenario('two-action homepage and controls remain reachable through fullscreen when supported',async page=>{
  await seed(page,fixture());const before=await state(page);const supported=await page.evaluate(()=>document.fullscreenEnabled&&typeof document.documentElement.requestFullscreen==='function');
  if(!supported){console.log('INFO native fullscreen unavailable in this browser; desktop-size coverage still applies');return;}
  await openAttendanceControls(page);await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.locator('#closeTeacher').click();await page.locator('#classroomHome').click();await assertHomeTargets(page);await page.screenshot({path:path.join(out,'home-fullscreen.png')});
  await openAttendanceControls(page);await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!document.fullscreenElement);await page.locator('#closeTeacher').click();await page.locator('#classroomHome').click();await assertHomeTargets(page);assert.deepEqual(await state(page),before);
 });
};
