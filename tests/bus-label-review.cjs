// Synthetic-only visual regressions against the reviewed e81a600 native boxes.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
module.exports=async function({scenario,seed,state,out}){
 const baseline=require('./fixtures/bus-'+(process.env.BROWSER==='webkit'?'webkit':'chromium')+'-before-readable-labels.json');
 const names=['Ava','Ben','Chloe','Diego','Ella','Finn','Grace','Hugo','Ivy','Jack','Kai','Lila','Maya','Noah','Olivia','Priya','Quinn','Ruby','Sofia','Theo','Uma','Vera','Will','Xavi','Yara','Zane','Amara','Bea','Cleo','Dina'];
 const fixture=(n,varied=false)=>({schemaVersion:1,className:'QA Synthetic Label Review',roster:Array.from({length:n},(_,i)=>({id:'bus-qa-'+i,name:varied?names[i]:'QA Friend '+String(i+1).padStart(2,'0')})),present:[],history:[],selectedTheme:'school-bus',ownedThemes:['school-bus']});
 async function inspect(page){return page.evaluate(()=>{
  const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
  const frame=document.querySelector('.bus-la-waiting').getBoundingClientRect();
  const buttons=[...document.querySelectorAll('.bus-la-child')];
  const targets=buttons.map(node=>({id:node.dataset.childId,zone:node.classList.contains('waiting')?'waiting':'here',...rect(node)}));
  const photosBefore=buttons.map(node=>rect(node.querySelector('.bus-la-avatar')));
  // Reconstruct the previous direct-child, source-sized labels at the SAME fit.
  // Replacing wrappers must not move either the button or its portrait.
  const replacements=buttons.map(button=>{
   const slot=button.querySelector('.bus-la-label-slot'),source=slot.querySelector('.bus-la-name-measure').cloneNode(true);
   if(button.classList.contains('aboard'))source.style.display='none';
   button.replaceChild(source,slot);return{button,slot,source};
  });
  const sourcePhotos=buttons.map(node=>rect(node.querySelector('.bus-la-avatar')));
  const sourceTargets=buttons.map(rect);
  replacements.forEach(({button,slot,source})=>button.replaceChild(slot,source));
  const waiting=buttons.filter(node=>node.classList.contains('waiting')&&!node.disabled);
  const portraits=waiting.map(node=>({id:node.dataset.childId,rect:node.querySelector('.bus-la-avatar').getBoundingClientRect()}));
  const labels=waiting.map(node=>{
   const label=node.querySelector('.bus-la-name'),r=label.getBoundingClientRect();
   const overlaps=portraits.filter(p=>r.left<p.rect.right-.25&&r.right>p.rect.left+.25&&r.top<p.rect.bottom-.25&&r.bottom>p.rect.top+.25).map(p=>p.id);
   return{id:node.dataset.childId,text:label.textContent,font:parseFloat(getComputedStyle(label).fontSize)*.95*Number(document.querySelector('#busWaitingLayer').dataset.fit),...rect(label),overlaps,inside:r.left>=frame.left-.5&&r.right<=frame.right+.5&&r.top>=frame.top-.5&&r.bottom<=frame.bottom+.5};
  });
  return{targets,photosBefore,sourcePhotos,sourceTargets,labels};
 });}
 function assertPositions(actual,expected,label){
  assert.equal(actual.length,expected.length,label);
  actual.forEach((box,i)=>{for(const key of ['x','y','w','h'])assert.ok(Math.abs(box[key]-expected[i][key])<.12,`${label} ${i} ${key}: ${box[key]} vs ${expected[i][key]}`);});
 }
 function assertLabels(metrics){
  assert.ok(metrics.labels.every(label=>label.font>=11.99),'at least12px effective visible names');
  assert.ok(metrics.labels.every(label=>label.inside),'all names including last row remain inside the shelter');
  assert.deepEqual(metrics.labels.filter(label=>label.overlaps.length),[],'no names overlap any waiting portrait');
  assertPositions(metrics.photosBefore,metrics.sourcePhotos,'label-only change preserves portrait positions');
  assertPositions(metrics.targets,metrics.sourceTargets,'label-only change preserves button positions');
 }
 await scenario('School Bus readable labels preserve reviewed source slots at every computer size',async page=>{
  const report=[];
  for(const reference of baseline){
   await page.setViewportSize(reference.viewport);await seed(page,fixture(reference.count));await page.locator('#takeHotspot').click();await page.locator('#busAttendance.active').waitFor();
   const metrics=await inspect(page);assertPositions(metrics.targets,reference.targets,'e81a600 reviewed boxes');assertLabels(metrics);
   report.push({viewport:reference.viewport,count:reference.count,...metrics});
  }
  fs.writeFileSync(path.join(out,'bus-readable-label-evidence.json'),JSON.stringify(report,null,2));
 });
 await scenario('School Bus readable varied-name computer previews remain stable after taps',async page=>{
  for(const viewport of [{width:1280,height:720},{width:1024,height:768}]){
   await page.setViewportSize(viewport);
   for(const n of [2,10,20,25,30]){
    await seed(page,fixture(n,true));await page.locator('#takeHotspot').click();await page.locator('.bus-la-bg').evaluate(img=>img.decode());
    const before=await inspect(page);assertLabels(before);
    await page.screenshot({path:path.join(out,`bus-readable-${viewport.width}-${n}-waiting.png`)});
    for(const name of names.slice(0,n)){await page.getByRole('button',{name:'Mark here '+name,exact:true}).click();}
    assert.equal((await state(page)).present.length,n);const here=await inspect(page);assertPositions(here.targets,before.targets,'varied-name slots after all check-ins');
    await page.screenshot({path:path.join(out,`bus-readable-${viewport.width}-${n}-here.png`)});
   }
  }
 });
};
