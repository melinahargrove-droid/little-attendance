const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
module.exports=async function({scenario,seed,state,out}){
 const configs=[['pumpkin-patch','pumpkinPatchAttendance','pumpkinWaitingZone','pumpkinHereZone','pumpkinClose'],['halloween','halloweenAttendance','halloweenWaiting','halloweenHere','halloweenClose'],['our-friends','ourFriendsAttendance','ourFriendsWaiting','ourFriendsHere','ourFriendsClose']];
 const evidence=[];
 const fixture=(theme,n)=>({schemaVersion:1,className:'Fictional restored theme QA',roster:Array.from({length:n},(_,i)=>({id:'qa-'+i,name:'QA '+String(i+1).padStart(2,'0')})),present:[],history:[],selectedTheme:theme,ownedThemes:['school-bus','apple-orchard',...configs.map(c=>c[0])]});
 async function art(page,theme){await page.evaluate(async theme=>{const names={'pumpkin-patch':['background.png','waiting-pumpkin.png','here-pumpkin.png','harvest-crate.png','harvest-crate-front.png'],halloween:['background.png','ghost-waiting.png','candy-here.png','bucket-front-mask.png'],'our-friends':['background.png','polaroid.png','here-box-front-occlusion.png']}[theme];await Promise.all(names.map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>im.decode().then(resolve,reject);im.onerror=reject;im.src='themes/'+theme+'/'+name;})));},theme);}
 async function physicalTap(page,zone,id){
  const point=await page.locator('#'+zone+' [data-child-id="'+id+'"]').evaluate(el=>{const r=el.getBoundingClientRect();for(const [x,y] of [[.5,.5],...Array.from({length:81},(_,i)=>[(i%9+1)/10,(Math.floor(i/9)+1)/10])]){const px=r.left+r.width*x,py=r.top+r.height*y;const top=document.elementFromPoint(px,py);if(top&&top.closest('button')===el)return{x:px,y:py};}return null;});
  assert.ok(point,zone+' '+id+' must have an unobscured physical target');await page.mouse.click(point.x,point.y);
 }
 for(const [theme,screen,waiting,here,close] of configs){
  await scenario(theme+' original assets, fixed layouts, physical taps and complete desktop roster matrix',async page=>{
   await page.emulateMedia({reducedMotion:'reduce'});
   for(const viewport of [{width:1672,height:941},{width:1280,height:720},{width:1181,height:757},{width:1024,height:768}]){
    await page.setViewportSize(viewport);
    for(const n of [10,15,20,25,30]){
     await seed(page,fixture(theme,n));await page.locator('#takeHotspot').click();await page.locator('#'+screen+'.active').waitFor();await art(page,theme);
     if(theme==='halloween'){
      const geometry=await page.locator('#halloweenBoard').evaluate(board=>{const r=board.getBoundingClientRect(),mask=board.querySelector('.halloween-bucket-front-mask').getBoundingClientRect(),close=board.querySelector('#halloweenClose'),c=close.getBoundingClientRect();return{ratio:r.width/r.height,background:getComputedStyle(board).backgroundSize,mask:{x:mask.x-r.x,y:mask.y-r.y,w:mask.width-r.width,h:mask.height-r.height},close:{opacity:getComputedStyle(close).opacity,color:getComputedStyle(close).color,x:c.x,y:c.y,right:c.right,bottom:c.bottom}};});
      assert.ok(Math.abs(geometry.ratio-1672/941)<.001,'Halloween uses original aspect ratio');assert.equal(geometry.background,'100% 100%');for(const v of Object.values(geometry.mask))assert.ok(Math.abs(v)<1,'Bucket mask shares the art bounds');assert.equal(geometry.close.opacity,'1');assert.ok(geometry.close.x>=0&&geometry.close.y>=0&&geometry.close.right<=viewport.width&&geometry.close.bottom<=viewport.height,'Visible Close remains onscreen');
     }
     const positions=await page.locator('#'+waiting+' button').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.dataset.childId,{x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y}])));
     await page.screenshot({path:path.join(out,'restored-'+theme+'-'+viewport.width+'-'+n+'-waiting.png')});
     for(let i=n-1;i>=0;i--){await physicalTap(page,waiting,'qa-'+i);assert.equal((await state(page)).present.length,n-i);const remaining=await page.locator('#'+waiting+' button').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.dataset.childId,{x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y}])));for(const [id,rect] of Object.entries(remaining))assert.deepEqual(rect,positions[id]);}
     await page.screenshot({path:path.join(out,'restored-'+theme+'-'+viewport.width+'-'+n+'-here.png')});
     // Piles intentionally overlap; every card remains keyboard reachable.
     const first=page.locator('#'+here+' [data-child-id="qa-0"]');await first.focus();await page.keyboard.press('Enter');assert.equal((await state(page)).present.length,n-1);
     await page.locator('#'+screen+' .restored-tools button').click();await page.locator('#undoBtn').click();assert.equal((await state(page)).present.length,n-2);await page.locator('#closeTeacher').click();
     await page.locator('#'+close).click();await page.locator('#takeHotspot').click();assert.equal((await state(page)).present.length,n-2);
     evidence.push({theme,viewport,n,waitingPhysicalTaps:n,stableSlots:true,keyboardReturn:true});
    }
   }
  });
  await scenario(theme+' whole-piece animation, repeated clicks, Close/reopen, Reset and reload',async page=>{
   await seed(page,fixture(theme,10));await page.locator('#takeHotspot').click();await art(page,theme);const button=page.locator('#'+waiting+' [data-child-id="qa-0"]');await button.focus();await page.keyboard.press('Enter');
   assert.equal((await state(page)).present.length,1);assert.equal(await page.locator('.restored-flight').count(),1);assert.ok(await page.locator('.restored-flight').locator('img,strong,.name,.halloween-ghost-name').count()>0);
   await page.locator('#'+close).click();await page.waitForTimeout(700);assert.equal(await page.locator('.restored-flight').count(),0);assert.equal(await page.locator('#dashboard.active').count(),1);assert.equal((await state(page)).present.length,1);
   await page.locator('#takeHotspot').click();await page.locator('#'+waiting+' [data-child-id="qa-1"]').focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');assert.equal((await state(page)).present.length,2);
   await page.locator('#'+screen+' .restored-tools button').click();page.once('dialog',d=>d.accept());await page.locator('#resetBtn').click();await page.waitForTimeout(700);assert.deepEqual((await state(page)).present,[]);await page.reload();await page.waitForFunction(()=>editingLockHeld);assert.deepEqual((await state(page)).present,[]);
  });
  await scenario(theme+' failed artwork falls back and late failure cannot reopen a dismissed board',async(page,context)=>{
   await seed(page,fixture(theme,3));await context.route('**/themes/'+theme+'/background.png',route=>route.abort());await page.locator('#takeHotspot').click();await page.locator('#attendance.active').waitFor();assert.equal(await page.locator('#studentGrid button').count(),3);assert.deepEqual((await state(page)).present,[]);
   await context.unroute('**/themes/'+theme+'/background.png');await page.reload();await page.waitForFunction(()=>editingLockHeld);await page.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});let release;await context.route('**/themes/'+theme+'/background.png',async route=>{await new Promise(r=>{release=r});await route.abort();});await page.locator('#takeHotspot').click();await page.locator('#'+close).click();await page.waitForFunction(()=>document.querySelector('#dashboard.active'));if(release)release();await page.waitForTimeout(200);assert.equal(await page.locator('#dashboard.active').count(),1);
  });
 }
 fs.writeFileSync(path.join(out,'restored-themes-matrix.json'),JSON.stringify(evidence,null,2));
};
