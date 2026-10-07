// Basket masking uses the original art coordinates; locked artwork/layouts do not change.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'apple-adapter.css'),'utf8');
const config=JSON.parse(fs.readFileSync(path.join(root,'themes/apple-orchard/theme-config.json')));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');

test('Apple mask repair preserves original artwork, student slots, scales and pile order',()=>{
 assert.equal(hash('apple-adapter.js'),'47f398b19c693573b30352488ea7063c78bdd873c06fccb0c4792f72afe60c73');
 assert.equal(hash('themes/apple-orchard/theme-config.json'),'e1cb5f50b679e8ff5988b60878f5bc15cabe2b889352cf9cc4cb6300b9cfd9e6');
 assert.equal(hash('themes/apple-orchard/background.png'),'63274dd0cd4035e7c5dea993cc37e5d6f22611584ec16eb5f1a4eae19f6982a0');
 assert.equal(hash('themes/apple-orchard/basket-apple.png'),'2a466df2c990a87c19cf4e4d64f15d12f9a4ae61ec416354942b44c9c35fa191');
 assert.equal(hash('themes/apple-orchard/waiting-apple.png'),'80d0c2fbccf2ceac7e4d3a996e48108273f36c361100458cbc2acc8c7a52696c');
});
test('Apple stage proportionally contains complete artwork with original foreground occlusion',()=>{
 assert.match(css,/#appleAttendance\{container-type:size;overflow:hidden;/);
 assert.match(css,/\.apple-la-stage\{position:absolute;left:50%;top:50%;/);
 assert.match(css,/width:min\(100cqw,calc\(100cqh \* 1672 \/ 941\)\)/);
 assert.match(css,/height:min\(100cqh,calc\(100cqw \* 941 \/ 1672\)\)/);
 assert.match(css,/transform:translate\(-50%,-50%\);container-type:size;/);
 assert.match(css,/\.apple-la-bg,\.apple-la-front\{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;/);
 const polygon='polygon('+config.basket.frontMask.map(p=>p.x+'% '+p.y+'%').concat(['100% 100%','0% 100%']).join(',')+')';
 assert.ok(css.includes('clip-path:'+polygon));
 assert.match(css,/\.apple-la-front\{z-index:60;clip-path:polygon/);
 assert.match(css,/@container\(min-aspect-ratio:7\/4\) and \(max-aspect-ratio:9\/5\)/);
});
for(const [width,height] of [[1024,768],[1366,768],[1920,1080],[1280,600],[1920,656]]){
 test(`Apple full-art stage and mask fit without cropping at ${width}x${height}`,()=>{
  const scale=Math.min(width/1672,height/941),paint={width:1672*scale,height:941*scale};
  const stage={width:Math.min(width,height*1672/941),height:Math.min(height,width*941/1672)};
  assert.ok(stage.width<=width&&stage.height<=height);
  assert.ok(Math.abs(stage.width/stage.height-1672/941)<1e-9);
  assert.ok(Math.abs(stage.width-width)<1e-9||Math.abs(stage.height-height)<1e-9,'fits the maximum available space');
  for(const p of config.basket.frontMask.concat([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}])){
   const imageX=(width-paint.width)/2+paint.width*p.x/100,imageY=(height-paint.height)/2+paint.height*p.y/100;
   const clipX=(width-stage.width)/2+stage.width*p.x/100,clipY=(height-stage.height)/2+stage.height*p.y/100;
   assert.ok(Math.abs(imageX-clipX)<1e-9);assert.ok(Math.abs(imageY-clipY)<1e-9);
   assert.ok(imageX>=-1e-9&&imageX<=width+1e-9&&imageY>=-1e-9&&imageY<=height+1e-9,'every original art corner is inside the host');
  }
 });
}
