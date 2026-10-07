// Thumbnail-only coverage. Native Chromium and WebKit run this via browser.cjs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const themes=[['our-friends','Our Friends'],['halloween','Halloween'],['pumpkin-patch','Pumpkin Patch']];
const fixture=theme=>({schemaVersion:1,className:'QA Thumbnail Class',roster:[{id:'qa-a',name:'QA Alpha'},{id:'qa-b',name:'QA Beta'}],present:['qa-a'],history:['qa-a'],selectedTheme:theme,ownedThemes:['school-bus','apple-orchard',...themes.map(([id])=>id)]});
async function inspect(image){
 return image.evaluate(async img=>{
  await img.decode();
  const box=img.getBoundingClientRect(),frame=img.parentElement.getBoundingClientRect(),css=getComputedStyle(img),scale=Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight);
  const width=img.naturalWidth*scale,height=img.naturalHeight*scale,left=box.x+(box.width-width)/2,top=box.y+(box.height-height)/2;
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
  return{theme:img.parentElement.dataset.theme,source:img.getAttribute('src'),alt:img.alt,fit:css.objectFit,position:css.objectPosition,natural:[img.naturalWidth,img.naturalHeight],frame:{left:frame.x,top:frame.y,width:frame.width,height:frame.height},imageBox:{left:box.x,top:box.y,width:box.width,height:box.height},rendered:{left,top,width,height},insideFrame:left>=frame.x-.5&&top>=frame.y-.5&&left+width<=frame.right+.5&&top+height<=frame.bottom+.5,insideViewport:frame.x>=0&&frame.y>=0&&frame.right<=innerWidth&&frame.bottom<=innerHeight,centerAlpha:ctx.getImageData(canvas.width/2,canvas.height/2,1,1).data[3],cornerAlpha:ctx.getImageData(0,0,1,1).data[3]};
 });
}
function assertWhole(metrics,theme,label){
 assert.equal(metrics.theme,theme);assert.equal(metrics.source,'themes/'+theme+'/thumbnail-illustration.png');assert.equal(metrics.alt,label+' theme illustration');
 assert.equal(metrics.fit,'contain');assert.equal(metrics.position,'50% 50%');assert.deepEqual(metrics.natural,[1254,1254]);
 assert.equal(metrics.insideFrame,true,'The complete illustration fits its art frame: '+JSON.stringify(metrics));assert.equal(metrics.insideViewport,true,'The art frame fits the viewport: '+JSON.stringify(metrics));assert.ok(Math.abs(metrics.rendered.width-metrics.rendered.height)<.01);
 assert.ok(metrics.centerAlpha>=245,'The thumbnail has a filled painted center, not a portrait hole');assert.equal(metrics.cornerAlpha,0,'The thumbnail keeps its transparent outer margin');
}
module.exports=async({scenario,seed,state,out})=>{
 await scenario('Our Friends, Halloween and Pumpkin Patch show complete named illustrations in both preview locations',async page=>{
  const proof=[];
  for(const viewport of [{width:1024,height:768},{width:1280,height:720},{width:1671,height:941}]){
   await page.setViewportSize(viewport);
   for(const [theme,label] of themes){
    await seed(page,fixture(theme));await page.locator('#classHotspot').click();const before=await state(page);
    const current=await inspect(page.locator('#currentThemeArt img'));assertWhole(current,theme,label);assert.equal(await page.locator('#currentThemeName').textContent(),label);
    proof.push({viewport,location:'current',...current});await page.locator('.current-theme-card').screenshot({path:path.join(out,`theme-preview-thumbnail-${theme}-current-${viewport.width}.png`)});
    await page.locator('#browseThemes').click();await page.locator('#themeSearch').fill(label);
    const card=page.getByRole('button',{name:new RegExp(label+' theme illustration')});await card.scrollIntoViewIfNeeded();assert.equal(await card.locator('h3').textContent(),label);
    const chooser=await inspect(card.locator('.theme-art img'));assertWhole(chooser,theme,label);assert.equal(chooser.source,current.source);
    proof.push({viewport,location:'chooser',...chooser});await card.screenshot({path:path.join(out,`theme-preview-thumbnail-${theme}-chooser-${viewport.width}.png`)});
    await card.click();await page.getByRole('button',{name:new RegExp(label+' theme illustration')}).click();await page.locator('#themesBack').click();
    assertWhole(await inspect(page.locator('#currentThemeArt img')),theme,label);assert.deepEqual(await state(page),before,'Repeated selection and return leave the classroom unchanged');
   }
  }
  fs.writeFileSync(path.join(out,'theme-preview-thumbnail-geometry.json'),JSON.stringify(proof,null,2));
 });
 await scenario('thumbnail download failure preserves full theme labels and usable navigation',async(page,context)=>{
  await context.route('**/thumbnail-illustration.png',route=>route.abort());
  for(const [theme,label] of themes){
   await seed(page,fixture(theme));await page.locator('#classHotspot').click();const before=await state(page);
   assert.equal(await page.locator('#currentThemeName').textContent(),label);assert.equal(await page.locator('#currentThemeArt img').getAttribute('alt'),label+' theme illustration');
   await page.locator('#browseThemes').click();await page.locator('#themeSearch').fill(label);const card=page.getByRole('button',{name:new RegExp(label+' theme illustration')});
   assert.equal(await card.locator('h3').textContent(),label);await card.click();await page.locator('#themesBack').click();assert.deepEqual(await state(page),before);
   await page.locator('.current-theme-card').screenshot({path:path.join(out,`theme-preview-thumbnail-${theme}-missing-art.png`)});
  }
 });
};
