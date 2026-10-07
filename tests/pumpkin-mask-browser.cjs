// Source-art geometry + rendered pixels, not only element bounds.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({scenario,seed,state,out})=>{
 const proof=[];
 const fixture=n=>({schemaVersion:1,className:'Fictional crate mask QA',roster:Array.from({length:n},(_,i)=>({id:'mask-'+i,name:'QA '+String(i+1).padStart(2,'0')})),present:[],history:[],selectedTheme:'pumpkin-patch',ownedThemes:['school-bus','our-friends','pumpkin-patch']});
 async function geometry(page){return page.locator('#pumpkinBoard').evaluate(board=>{const back=board.querySelector('.pumpkin-crate-asset'),front=board.querySelector('.pumpkin-crate-front'),zone=board.querySelector('.pumpkin-crate-drop-zone'),z=zone.getBoundingClientRect(),b=back.getBoundingClientRect(),f=front.getBoundingClientRect(),m=front.getScreenCTM();const p=(x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});const top=p(400,558),bottom=p(1400,830);return{hereClip:getComputedStyle(zone).clipPath,back:{x:b.x,y:b.y,w:b.width,h:b.height},front:{x:f.x,y:f.y,w:f.width,h:f.height},scaleX:m.a,scaleY:m.d,svgRatio:front.viewBox.baseVal.width/front.viewBox.baseVal.height,oldCut:z.top+z.height*.8,railY:top.y,band:{left:Math.ceil(z.left+12),right:Math.floor(Math.min(z.right-12,innerWidth)),top:Math.ceil(z.top+z.height*.8+2),bottom:Math.floor(Math.min(top.y-2,innerHeight))},wood:{left:Math.ceil(top.x),right:Math.floor(Math.min(bottom.x,innerWidth-1)),top:Math.ceil(p(400,660).y),bottom:Math.floor(Math.min(bottom.y,innerHeight-1))}};});}
 async function pixelDiff(page,before,after,rect){return page.evaluate(async({before,after,rect})=>{const decode=async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height);};const a=await decode(before),b=await decode(after);let changed=0,checked=0;for(let y=Math.max(0,rect.top);y<Math.min(a.height,rect.bottom);y++)for(let x=Math.max(0,rect.left);x<Math.min(a.width,rect.right);x++){const i=(y*a.width+x)*4;checked++;if(Math.max(...[0,1,2].map(k=>Math.abs(a.data[i+k]-b.data[i+k])))>3)changed++;}return{changed,checked};},{before:'data:image/png;base64,'+before.toString('base64'),after:'data:image/png;base64,'+after.toString('base64'),rect});}
 await scenario('Pumpkin crate masks follow the painted rail across roster sizes and wide/short frames',async page=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const viewport of [{width:1024,height:768},{width:1366,height:768},{width:1920,height:1080},{width:1280,height:600}]){
   await page.setViewportSize(viewport);
   for(const n of [10,20,30]){
    await seed(page,fixture(n));await page.locator('#takeHotspot').click();await page.evaluate(async()=>{await Promise.all(['background.png','harvest-crate.png','here-pumpkin.png','waiting-pumpkin.png'].map(name=>{const i=new Image();i.src='themes/pumpkin-patch/'+name;return i.decode();}));});
    const g=await geometry(page);assert.equal(g.hereClip,'none');assert.deepEqual(g.front,g.back,'Back and foreground share exactly one art box');assert.ok(Math.abs(g.scaleX-g.scaleY)<.0001,'Mask coordinates scale proportionally with the crate image');assert.ok(Math.abs(g.svgRatio-1731/909)<.0001);
    const empty=await page.screenshot();
    await page.evaluate(()=>{data.present=data.roster.filter((_,i)=>i%3===0).map(c=>c.id);window.dispatchEvent(new Event('attendancechange'));});
    if(n===20)await page.screenshot({path:path.join(out,`pumpkin-mask-${viewport.width}-${viewport.height}-partial.png`)});
    await page.evaluate(()=>{data.present=data.roster.map(c=>c.id);window.dispatchEvent(new Event('attendancechange'));});
    const all=await page.screenshot();if(n===20)fs.writeFileSync(path.join(out,`pumpkin-mask-${viewport.width}-${viewport.height}-all.png`),all);
    const band=await pixelDiff(page,empty,all,g.band),wood=await pixelDiff(page,empty,all,g.wood);
    assert.ok(band.checked>0&&band.changed>20,'Pumpkin pixels extend below the old invisible cutoff into the crate interior: '+JSON.stringify({viewport,n,g,band}));assert.ok(wood.checked>0);assert.equal(wood.changed,0,'The real wooden front still occludes every Here pumpkin');
    const before=await state(page);await page.locator('#pumpkinClose').click();await page.locator('#takeHotspot').click();assert.deepEqual(await state(page),before);proof.push({viewport,n,...g,band,wood});
   }
  }
 });
 await scenario('Pumpkin animated arrival settles behind the art-aligned front without a late clip or state change',async page=>{
  await page.setViewportSize({width:1280,height:600});await seed(page,fixture(20));await page.locator('#takeHotspot').click();const child=page.locator('#pumpkinWaitingZone [data-child-id="mask-19"]');await child.focus();await page.keyboard.press('Enter');assert.equal((await state(page)).present.length,1);await page.waitForTimeout(150);assert.equal(await page.locator('.restored-flight').count(),1);await page.waitForTimeout(600);assert.equal(await page.locator('.restored-flight').count(),0);assert.equal(await page.locator('#pumpkinHereZone [data-child-id="mask-19"]').count(),1);assert.equal((await geometry(page)).hereClip,'none');await page.screenshot({path:path.join(out,'pumpkin-mask-1280-transition-settled.png')});
 });
 fs.writeFileSync(path.join(out,'pumpkin-mask-geometry.json'),JSON.stringify(proof,null,2));
};
