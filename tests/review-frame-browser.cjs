// Test-only synthetic host. No preview/unlock code is shipped by the public app.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const choices=[['school-bus','#busAttendance'],['apple-orchard','#appleAttendance'],['fall-leaves','#fallLeavesAttendance'],['pumpkin-patch','#pumpkinPatchAttendance'],['halloween','#halloweenAttendance'],['our-friends','#ourFriendsAttendance']];
module.exports=async({scenario,seed,state,out})=>{
 await scenario('home and six boards retain artwork, state and click coordinates in a short host and full screen at two pixel densities',async(page,context)=>{
  const evidence=[];
  for(const dpr of [1,1.5]){
   const own=await context.browser().newContext({viewport:{width:1280,height:664},deviceScaleFactor:dpr});
   try{
    const p=await own.newPage();const input={schemaVersion:1,className:'QA Review Frame',roster:Array.from({length:20},(_,i)=>({id:'qa-'+i,name:'QA '+String(i+1).padStart(2,'0')})),present:['qa-4','qa-10','qa-14','qa-19'],history:[],selectedTheme:'halloween',ownedThemes:choices.map(c=>c[0])};
    await seed(p,input);const url=p.url(),origin=new URL(url).origin;
    const html=`<!doctype html><style>html,body{margin:0;height:100%}header{height:64px}section{height:calc(100vh - 64px)}iframe{border:0;width:100%;height:100%;display:block}section:fullscreen{height:100vh;width:100vw}.exit{position:fixed;top:4px;left:4px;z-index:99;display:none}:fullscreen .exit{display:block}</style><header>Fictional geometry test <button id="full">Full screen</button></header><section id="surface"><button class="exit">Exit full screen</button><iframe id="frame" allowfullscreen src="${url}"></iframe></section><script>full.onclick=async()=>{try{await surface.requestFullscreen()}catch{document.body.dataset.fallback='true'}};document.querySelector('.exit').onclick=()=>document.exitFullscreen();</script>`;
    await own.route('**/*',route=>route.request().url()===origin+'/__qa_review_frame'?route.fulfill({contentType:'text/html',body:html}):route.request().url().startsWith(origin)?route.continue():route.abort());
    await p.goto(origin+'/__qa_review_frame');const handle=await p.locator('#frame').elementHandle(),frame=await handle.contentFrame();await frame.waitForFunction(()=>editingLockHeld);await frame.evaluate(()=>{acknowledgedAttendanceDay=localAttendanceDate();});
    async function fit(selector,ratio){const g=await frame.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};});assert.ok(g.x>=-.1&&g.y>=-.1&&g.right<=g.vw+.1&&g.bottom<=g.vh+.1,selector+' fits its real frame');assert.ok(Math.abs(g.w/g.h-ratio)<.001);return g;}
    const original=await state(frame);const home=await fit('.dashboard-stage',16/9);for(const id of ['takeHotspot','classHotspot'])assert.equal(await frame.locator('#'+id).isVisible(),true);
    await p.screenshot({path:path.join(out,`review-frame-dpr${dpr}-home.png`)});
    for(const [theme,screen] of choices){await frame.evaluate(theme=>{data.selectedTheme=theme;show('dashboard');},theme);await frame.locator('#takeHotspot').click();await frame.locator(screen+'.active').waitFor();await frame.waitForTimeout(150);if(dpr===1)await p.screenshot({path:path.join(out,`review-frame-${theme}-partial.png`)});await frame.evaluate(()=>show('dashboard'));}
    await frame.evaluate(()=>{data.selectedTheme='halloween';});await frame.locator('#takeHotspot').click();const fitBefore=await fit('#halloweenBoard',1672/941),before=await state(frame);
    await p.locator('#full').click();await p.waitForTimeout(150);const supported=await p.evaluate(()=>!!document.fullscreenElement);assert.equal(await p.locator('#frame').elementHandle().then(h=>h.contentFrame()).then(f=>f===frame),true);assert.deepEqual(await state(frame),before);const fitAfter=await fit('#halloweenBoard',1672/941);
    if(supported){assert.equal(await p.locator('.exit').isVisible(),true);assert.equal(await frame.evaluate(()=>innerHeight),await p.evaluate(()=>innerHeight));}
    const child=frame.locator('#halloweenWaiting [data-child-id="qa-0"]'),r=await child.evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};}),outer=await p.locator('#frame').boundingBox();await p.mouse.click(outer.x+r.x,outer.y+r.y);await frame.waitForFunction(()=>data.present.includes('qa-0'));await frame.waitForTimeout(600);
    await p.screenshot({path:path.join(out,`review-frame-dpr${dpr}-halloween-fullscreen.png`)});if(supported)await p.locator('.exit').click();assert.equal((await state(frame)).present.length,original.present.length+1);
    await p.evaluate(()=>{document.querySelector('#surface').requestFullscreen=()=>Promise.reject(new Error('Synthetic unsupported fullscreen'));});await p.locator('#full').click();await p.waitForFunction(()=>document.body.dataset.fallback==='true');assert.equal((await state(frame)).present.length,original.present.length+1);
    evidence.push({dpr,home,fitBefore,fitAfter,fullscreenSupported:supported,sameFrame:true,physicalNestedClick:true,statePreserved:true,fallbackPreserved:true});
   }finally{await own.close();}
  }
  fs.writeFileSync(path.join(out,'review-frame-geometry.json'),JSON.stringify(evidence,null,2));
 });
};
