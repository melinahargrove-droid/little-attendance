// Physical arrival taps, original cover-art mask geometry and review-frame resizing.
// Fictional QA names only. Screenshots are captured by Chromium/WebKit CI.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../themes/apple-orchard/theme-config.json')));
const cases=[
 {width:1024,height:768,inset:0},
 {width:1366,height:768,inset:0},
 {width:1920,height:1080,inset:0},
 {width:1280,height:664,inset:64},
 {width:1920,height:720,inset:64}
];
const fixture=n=>({schemaVersion:1,className:'QA Apple Basket',roster:Array.from({length:n},(_,i)=>({id:'qa-'+i,name:'QA Apple '+String(i+1).padStart(2,'0')})),present:[],history:[],selectedTheme:'apple-orchard',ownedThemes:['apple-orchard','school-bus','fall-leaves']});
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<.15,message+': '+a+' ≈ '+b);
async function inspect(page){
 return page.evaluate(points=>{
  const box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
  const stage=document.querySelector('.apple-la-stage'),bg=stage.querySelector('.apple-la-bg'),front=stage.querySelector('.apple-la-front');
  const b=box(bg),s=Math.max(b.width/bg.naturalWidth,b.height/bg.naturalHeight),width=bg.naturalWidth*s,height=bg.naturalHeight*s;
  const paint={x:b.x+(b.width-width)/2,y:b.y+(b.height-height)/2,width,height};
  const f=box(front),frontStyle=getComputedStyle(front),closeLabel=stage.querySelector('.apple-la-close-label');
  const clip=frontStyle.clipPath.match(/[-\d.]+%/g).map(Number.parseFloat);
  return{stage:box(stage),parent:box(stage.parentElement),paint,front:f,natural:[bg.naturalWidth,bg.naturalHeight],fit:getComputedStyle(bg).objectFit,containerType:getComputedStyle(stage).containerType,
   points:points.map((p,i)=>({paint:[paint.x+paint.width*p.x/100,paint.y+paint.height*p.y/100],clip:[f.x+f.width*clip[i*2]/100,f.y+f.height*clip[i*2+1]/100]})),
   clipping:frontStyle.clipPath,frontZ:Number(frontStyle.zIndex),pieceLayerZ:Number(getComputedStyle(stage.querySelector('.apple-la-here')).zIndex),frontPointerEvents:frontStyle.pointerEvents,
   closeLabelVisible:getComputedStyle(closeLabel).display!=='none',scroll:[stage.parentElement.scrollWidth,stage.parentElement.scrollHeight]};
 },config.basket.frontMask);
}
function assertAligned(metrics){
 assert.deepEqual(metrics.natural,[1672,941]);assert.equal(metrics.fit,'cover');assert.equal(metrics.containerType,'size');
 for(const key of ['x','y','width','height']){close(metrics.stage[key],metrics.parent[key],'stage fits its actual parent '+key);close(metrics.front[key],metrics.paint[key],'mask box follows covered artwork '+key);}
 for(const point of metrics.points){close(point.paint[0],point.clip[0],'mask x uses original art origin');close(point.paint[1],point.clip[1],'mask y uses original art origin');}
 assert.ok(metrics.frontZ>metrics.pieceLayerZ);assert.equal(metrics.frontPointerEvents,'none');assert.match(metrics.clipping,/^polygon\(/);
 assert.ok(metrics.scroll[0]<=metrics.stage.width+1);assert.ok(metrics.scroll[1]<=metrics.stage.height+1);
 const aspect=metrics.stage.width/metrics.stage.height;assert.equal(metrics.closeLabelVisible,aspect<1.75||aspect>1.8);
}
const slots=page=>page.locator('#appleWaitLayer button').evaluateAll(buttons=>buttons.map(button=>({name:button.getAttribute('aria-label'),left:button.style.left,top:button.style.top,width:button.style.width,height:button.style.height,transform:button.style.transform})));
module.exports=async({scenario,seed,state,out})=>{
 const proof=[];
 for(const size of [10,20,30])for(const viewport of cases){
  const tag=viewport.width+'x'+viewport.height+(viewport.inset?'-review':'')+'-'+size;
  await scenario('Apple basket artwork-aligned masking '+tag,async page=>{
   await page.setViewportSize({width:viewport.width,height:viewport.height});await seed(page,fixture(size));
   await page.evaluate(inset=>{document.querySelector('.app').style.top=inset+'px';},viewport.inset);
   await page.locator('#takeHotspot').click();await page.locator('#appleWaitLayer button').first().waitFor();
   await page.locator('.apple-la-bg').evaluate(image=>image.decode());await page.locator('.apple-la-front').evaluate(image=>image.decode());
   await page.evaluate(async()=>Promise.all(['waiting-apple.png','basket-apple.png'].map(async file=>{const image=new Image();image.src='themes/apple-orchard/'+file;await image.decode();})));
   const initialSlots=await slots(page);let metrics=await inspect(page);assertAligned(metrics);
   for(let i=0;i<size;i++){
    const name='QA Apple '+String(i+1).padStart(2,'0');await page.getByRole('button',{name:'Mark here '+name,exact:true}).click();await page.getByRole('button',{name:'Return '+name,exact:true}).waitFor();
    assert.equal((await state(page)).present.length,i+1);assert.deepEqual(await slots(page),initialSlots.slice(i+1),'arriving does not repack waiting slots');
    const here=await page.getByRole('button',{name:'Return '+name,exact:true}).evaluate(button=>({left:button.style.left,top:button.style.top}));
    assert.deepEqual(here,{left:config.basket.pile[i].x+'%',top:config.basket.pile[i].y+'%'},'original basket slot is unchanged');
    if(i===5){metrics=await inspect(page);assertAligned(metrics);await page.screenshot({path:path.join(out,'apple-mask-'+tag+'-partial.png')});proof.push({tag,phase:'partial',size,present:i+1,viewport,...metrics});}
   }
   assert.equal(await page.locator('#appleHereCount').textContent(),String(size));metrics=await inspect(page);assertAligned(metrics);await page.screenshot({path:path.join(out,'apple-mask-'+tag+'-all-here.png')});proof.push({tag,phase:'all-here',size,present:size,viewport,...metrics});
   // Piled apples overlap intentionally. Keyboard return remains available.
   const first=page.getByRole('button',{name:'Return QA Apple 01',exact:true});await first.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Mark here QA Apple 01',exact:true}).waitFor();assert.equal((await state(page)).present.length,size-1);
   await page.getByRole('button',{name:'Mark here QA Apple 01',exact:true}).click();await page.getByRole('button',{name:'Return QA Apple 01',exact:true}).waitFor();assert.equal((await state(page)).present.length,size);
   await page.locator('#appleTeacher').click();await page.locator('#undoBtn').click();await page.locator('#closeTeacher').click();assert.equal((await state(page)).present.length,size-1);
   const before=await state(page);await page.locator('#appleClose').click();await page.locator('#dashboard.active').waitFor();await page.locator('#takeHotspot').click();await page.locator('#appleHereLayer button').first().waitFor();assert.deepEqual(await state(page),before);assertAligned(await inspect(page));
   // Resize the actual host while open, then the viewport, without a re-render.
   await page.evaluate(()=>{document.querySelector('.app').style.top='96px';});assertAligned(await inspect(page));
   await page.setViewportSize({width:viewport.width,height:viewport.height+128});assertAligned(await inspect(page));assert.deepEqual(await state(page),before);
   if(size===20&&viewport.width===1366){
    const supported=await page.evaluate(()=>Boolean(document.fullscreenEnabled&&document.documentElement.requestFullscreen));
    if(supported){
     await page.locator('#appleTeacher').click();await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));assertAligned(await inspect(page));assert.deepEqual(await state(page),before);
     await page.screenshot({path:path.join(out,'apple-mask-fullscreen-'+tag+'.png')});proof.push({tag,phase:'fullscreen',actualFullscreen:true,...await inspect(page)});
     await page.locator('#appleTeacher').click();await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!document.fullscreenElement);assertAligned(await inspect(page));
    }else{assert.equal(process.env.BROWSER,'webkit','Chromium exercises actual fullscreen');proof.push({tag,phase:'fullscreen',actualFullscreen:false,supported:false});}
   }
   await page.locator('#appleTeacher').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#resetBtn').click();await page.waitForFunction(()=>document.querySelector('#appleHereLayer').children.length===0);assert.deepEqual((await state(page)).present,[]);assert.deepEqual(await slots(page),initialSlots);
   fs.writeFileSync(path.join(out,'apple-mask-geometry.json'),JSON.stringify(proof,null,2));
  });
 }
};
