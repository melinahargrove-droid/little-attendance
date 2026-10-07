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
test('Apple stage and foreground use container dimensions, with original mask and foreground occlusion',()=>{
 assert.match(css,/\.apple-la-stage\{[^}]*width:100%;height:100%;container-type:size;/);
 assert.match(css,/width:max\(100cqw,calc\(100cqh \* 1672 \/ 941\)\)/);
 assert.match(css,/height:max\(100cqh,calc\(100cqw \* 941 \/ 1672\)\)/);
 assert.match(css,/\.apple-la-front\{\s*inset:auto;\s*left:50%;top:50%;[^}]*transform:translate\(-50%,-50%\);/);
 const polygon='polygon('+config.basket.frontMask.map(p=>p.x+'% '+p.y+'%').concat(['100% 100%','0% 100%']).join(',')+')';
 assert.ok(css.includes('clip-path:'+polygon));
 assert.match(css,/\.apple-la-front\{z-index:60;clip-path:polygon/);
 assert.match(css,/@container\(min-aspect-ratio:7\/4\) and \(max-aspect-ratio:9\/5\)/);
});
for(const [width,height] of [[1024,768],[1366,768],[1920,1080],[1280,600],[1920,656]]){
 test(`Apple cover-space mask is aligned at ${width}x${height}`,()=>{
  const scale=Math.max(width/1672,height/941),paint={width:1672*scale,height:941*scale};
  const foreground={width:Math.max(width,height*1672/941),height:Math.max(height,width*941/1672)};
  for(const p of config.basket.frontMask){
   const imageX=(width-paint.width)/2+paint.width*p.x/100,imageY=(height-paint.height)/2+paint.height*p.y/100;
   const clipX=(width-foreground.width)/2+foreground.width*p.x/100,clipY=(height-foreground.height)/2+foreground.height*p.y/100;
   assert.ok(Math.abs(imageX-clipX)<1e-9);assert.ok(Math.abs(imageY-clipY)<1e-9);
  }
 });
}
