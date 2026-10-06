// The Current Theme card contains the whole original Bus scene, not a crop.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {openAttendanceControls}=require('./navigation-helper.cjs');
const fixture=theme=>({schemaVersion:1,className:'QA Preview Class',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:['qa-a'],history:['qa-a'],selectedTheme:theme,ownedThemes:['school-bus','apple-orchard','fall-leaves']});
async function inspectPreview(page){
 return page.locator('#currentThemeArt img').evaluate(async img=>{
  await img.decode();
  const box=img.getBoundingClientRect(),frame=img.parentElement.getBoundingClientRect(),css=getComputedStyle(img);
  const scale=Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight);
  const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
  const left=box.x+(box.width-width)/2,top=box.y+(box.height-height)/2;
  const button=document.querySelector('#browseThemes'),b=button.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
  return{theme:img.parentElement.dataset.theme,source:img.getAttribute('src'),fit:css.objectFit,position:css.objectPosition,natural:[img.naturalWidth,img.naturalHeight],frame:{x:frame.x,y:frame.y,width:frame.width,height:frame.height},rendered:{left,top,width,height},insideFrame:left>=frame.x-.5&&top>=frame.y-.5&&left+width<=frame.right+.5&&top+height<=frame.bottom+.5,insideViewport:frame.x>=0&&frame.y>=0&&frame.right<=innerWidth&&frame.bottom<=innerHeight,changeThemeHit:hit===button||button.contains(hit)};
 });
}
function assertWholeBus(metrics){
 assert.equal(metrics.theme,'school-bus');assert.equal(metrics.source,'themes/school-bus/background.png');
 assert.equal(metrics.fit,'contain');assert.equal(metrics.position,'50% 50%');
 assert.ok(metrics.natural[0]>0&&metrics.natural[1]>0);assert.equal(metrics.insideFrame,true);assert.equal(metrics.insideViewport,true);assert.equal(metrics.changeThemeHit,true);
 assert.ok(Math.abs(metrics.rendered.width/metrics.rendered.height-metrics.natural[0]/metrics.natural[1])<.001,'Original bus proportions are preserved');
}
module.exports=async({scenario,seed,state,out})=>{
 await scenario('Current Theme School Bus preview is fully visible at computer sizes and native fullscreen',async page=>{
  await seed(page,fixture('school-bus'));await page.locator('#classHotspot').click();const before=await state(page),proof=[];
  for(const viewport of [{width:1024,height:768},{width:1280,height:720},{width:1671,height:941},{width:1920,height:998}]){
   await page.setViewportSize(viewport);let metrics=await inspectPreview(page);assertWholeBus(metrics);proof.push({viewport,mode:'windowed',...metrics});
   await page.screenshot({path:path.join(out,'theme-preview-bus-'+viewport.width+'.png')});
   await page.locator('#browseThemes').click();assert.equal(await page.locator('#themes.active').count(),1);await page.locator('#themesBack').click();assertWholeBus(await inspectPreview(page));
   if(await page.evaluate(()=>document.fullscreenEnabled&&typeof document.documentElement.requestFullscreen==='function')){
    await openAttendanceControls(page);await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!!document.fullscreenElement);
    metrics=await inspectPreview(page);assertWholeBus(metrics);proof.push({viewport,mode:'fullscreen',...metrics});await page.screenshot({path:path.join(out,'theme-preview-bus-fullscreen-'+viewport.width+'.png')});
    await openAttendanceControls(page);await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!document.fullscreenElement);assertWholeBus(await inspectPreview(page));
   }
   assert.deepEqual(await state(page),before,'Preview navigation and fullscreen do not change the classroom');
  }
  fs.writeFileSync(path.join(out,'theme-preview-geometry.json'),JSON.stringify(proof,null,2));
 });
 await scenario('contained preview sizing stays scoped to School Bus when changing themes',async page=>{
  await seed(page,fixture('school-bus'));await page.locator('#classHotspot').click();
  for(const [theme,label,fit] of [['apple-orchard','Apple Orchard','cover'],['school-bus','School Bus','contain']]){
   await page.locator('#browseThemes').click();await page.locator('.theme-card').filter({has:page.locator('h3',{hasText:label})}).click();await page.locator('#themesBack').click();
   const metrics=await inspectPreview(page);assert.equal(metrics.theme,theme);assert.equal(metrics.fit,fit);assert.equal((await state(page)).selectedTheme,theme);
   await page.screenshot({path:path.join(out,'theme-preview-'+theme+'-switch.png')});
  }
 });
};
