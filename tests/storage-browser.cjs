// Real-engine checks for save recovery, modal reachability and storage events.
// Called only inside the existing isolated synthetic-fixture browser harness.
const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async({scenario,seed,state,out})=>{
 const KEY='littleAttendanceCleanV4';
 const fixture=theme=>({schemaVersion:1,className:'QA Storage Safety',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:['qa-a'],history:['qa-a'],selectedTheme:theme,ownedThemes:['school-bus','apple-orchard','fall-leaves']});
 for(const theme of ['school-bus','apple-orchard','fall-leaves','pumpkin-patch']){
  await scenario(theme+' failed Undo keeps modal feedback and retry usable',async page=>{
   await page.setViewportSize({width:1024,height:768});await seed(page,fixture(theme));await page.locator('#takeHotspot').click();
   const control=theme==='school-bus'?'#busTeacher':theme==='apple-orchard'?'#appleTeacher':'#teacherBtn';
   if(theme==='fall-leaves'){await page.locator('#fallLeavesClose').click();await page.locator('#teacherHotspot').click();}else await page.locator(control).click();
   const raw=await page.evaluate(key=>localStorage.getItem(key),KEY);
   await page.evaluate(()=>{window.qaOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Synthetic full storage','QuotaExceededError');};});
   await page.locator('#undoBtn').click();const notice=page.locator('#teacherDialog .storage-warning-dialog');
   assert.equal(await notice.isVisible(),true);assert.match(await notice.textContent(),/only kept in this session/);assert.equal(await page.locator('#teacherDialog').evaluate(e=>e.open),true);
   const retry=notice.getByRole('button',{name:'Try saving again',exact:true});await retry.click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),raw);assert.deepEqual((await state(page)).present,[]);
   const box=await retry.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=768,'Retry fits the computer viewport');await page.screenshot({path:path.join(out,'storage-'+theme+'-modal.png')});
   await page.evaluate(()=>{Storage.prototype.setItem=window.qaOriginalSetItem;});await retry.click();assert.equal(await notice.isVisible(),false);assert.deepEqual(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),KEY)).present,[]);
   await page.locator('#closeTeacher').click();await page.reload();assert.deepEqual((await state(page)).present,[]);
  });
 }
 await scenario('unsaved refresh warns, dismissal preserves work, successful retry permits reload',async page=>{
  await seed(page,fixture('school-bus'));await page.locator('#classHotspot').click();
  await page.evaluate(()=>{window.qaOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Synthetic full storage','QuotaExceededError');};});
  await page.locator('#className').fill('QA Unsaved Class');const pending=await state(page),raw=await page.evaluate(key=>localStorage.getItem(key),KEY);
  const warningPromise=page.waitForEvent('dialog');const reload=page.reload({timeout:5000}).catch(()=>{});const warning=await warningPromise;assert.equal(warning.type(),'beforeunload');await warning.dismiss();await reload;
  assert.deepEqual(await state(page),pending);assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),raw);
  await page.evaluate(()=>{Storage.prototype.setItem=window.qaOriginalSetItem;});await page.locator('#retrySave').click();await page.reload();assert.deepEqual(await state(page),pending);
 });
 await scenario('real two-tab storage events flag open dialogs without overwriting session work',async(page,context)=>{
  await seed(page,fixture('school-bus'));const other=await context.newPage();await other.goto(page.url());await other.locator('#classHotspot').click();await other.locator('#pasteListBtn').click();await other.locator('#pastedNames').fill('QA Draft Friend');
  const before=await state(other);await page.locator('#takeHotspot').click();await page.getByRole('button',{name:'Mark here QA Beta',exact:true}).click();
  const notice=other.locator('#pasteListDialog .storage-warning-dialog');await notice.waitFor();assert.match(await notice.textContent(),/out of date/);assert.equal(await notice.locator('button').isVisible(),false);assert.equal(await other.locator('#pastedNames').inputValue(),'QA Draft Friend');assert.deepEqual(await state(other),before);
  await other.locator('#savePasteList').click();const dirty=await state(other),saved=await page.evaluate(key=>localStorage.getItem(key),KEY);assert.equal(dirty.roster.length,3);assert.match(await other.locator('#storageWarning').textContent(),/reloading would discard/);await other.evaluate(()=>document.querySelector('#retrySave').click());assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),saved);assert.deepEqual(await state(other),dirty);
  await other.screenshot({path:path.join(out,'storage-two-tab-conflict.png')});
 });
};
