// Exercise the app's actual Full Screen control; no fullscreen API mock.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({scenario,seed,state,out})=>{
 await scenario('Fall counter mapping in actual fullscreen where the engine supports it',async(page,context)=>{
  const base='https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/';
  const urls=['fall-background.png','fall-here-leaf.png','fall-waiting-leaf.png'].map(file=>base+file);for(const url of urls)await context.route(url,route=>route.continue());
  const fixture={schemaVersion:1,className:'QA Fullscreen',roster:[{id:'qa-full-a',name:'QA Alpha'},{id:'qa-full-b',name:'QA Beta'}],present:['qa-full-a'],history:[],selectedTheme:'fall-leaves',ownedThemes:['school-bus','apple-orchard','fall-leaves']},proof=[];
  for(const viewport of [{width:1024,height:768},{width:1280,height:720},{width:1671,height:941}]){
   await page.setViewportSize(viewport);await seed(page,fixture);const before=await state(page);await page.locator('#classHotspot').click();await page.locator('#classroomTeacher').click();
   const supported=await page.evaluate(()=>Boolean(document.fullscreenEnabled&&document.documentElement.requestFullscreen));
   if(!supported){proof.push({engine:process.env.BROWSER||'chromium',viewport,supported:false,actualFullscreen:false});fs.writeFileSync(path.join(out,'fall-fullscreen-proof.json'),JSON.stringify(proof,null,2));assert.equal(process.env.BROWSER,'webkit','Chromium must exercise real fullscreen');return;}
   await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));assert.equal(await page.locator('#teacherDialog').evaluate(dialog=>dialog.open),false);await page.locator('#classroomAttendance').click();await page.locator('#fallLeavesAttendance.active').waitFor();await page.evaluate(async urls=>Promise.all(urls.map(async url=>{const image=new Image();image.src=url;await image.decode();})),urls);
   const metrics=await page.evaluate(()=>({actualFullscreen:Boolean(document.fullscreenElement),width:innerWidth,height:innerHeight,counts:[...document.querySelectorAll('.fall-la-count')].map(element=>{const rect=element.getBoundingClientRect();return{y:rect.y,height:rect.height,transform:getComputedStyle(element).transform};})}));
   assert.equal(metrics.actualFullscreen,true);for(const count of metrics.counts)assert.ok(count.y>=metrics.height*.285&&count.y+count.height<=metrics.height*.38,'Fullscreen count stays below its label inside the painted box');
   await page.screenshot({path:path.join(out,'fall-fullscreen-'+viewport.width+'.png')});proof.push({viewport,supported:true,...metrics});assert.deepEqual(await state(page),before);
   await page.locator('#fallLeavesClose').click();await page.locator('#classHotspot').click();await page.locator('#classroomTeacher').click();await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!document.fullscreenElement);assert.equal(await page.locator('#teacherDialog').evaluate(dialog=>dialog.open),false);assert.deepEqual(await state(page),before);
  }
  fs.writeFileSync(path.join(out,'fall-fullscreen-proof.json'),JSON.stringify(proof,null,2));
 });
};
