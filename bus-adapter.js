(function(){
'use strict';
const BASE='themes/school-bus/';
// Keep the original finished artwork and geometry separate from app/storage code.
// Density depends on the whole roster, never on the number already on the bus.
const density=n=>n<=6?1:n<=12?2:n<=16?3:n<=20?4:n<=24?5:n<=27?6:7;
const tier=n=>n<=10?'xs':n<=15?'sm':n<=20?'md':n<=25?'lg':'xl';
let rosterKey='',fitKey='',slots=new Map(),artFailed=false;
function safePhoto(child){
  // Legacy local raster photos can be displayed without sending child data or
  // fetching third-party URLs. Remote URLs and SVG/HTML are intentionally unused.
  return [child.photo,child.photoUrl,child.image].find(value=>typeof value==='string' && /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value))||'';
}
function fallback(){
  if(!document.getElementById('busAttendance').classList.contains('active'))return;
  renderAttendance();show('attendance');
  toast('School Bus could not load. Your attendance is available here.');
}
function ensureScreen(){
  if(document.getElementById('busAttendance'))return;
  const screen=document.createElement('section');screen.id='busAttendance';screen.className='screen';
  screen.setAttribute('aria-label','School Bus attendance');
  screen.innerHTML=`<div class="bus-la-stage"><img class="bus-la-bg" src="${BASE}background.png" alt=""><h1 class="bus-la-sr">Who’s Here Today? Tap your picture when you arrive.</h1><div class="bus-la-counts" aria-live="polite" aria-atomic="true"><span><strong id="busHereCount">0</strong><span class="bus-la-sr"> here</span></span><span><strong id="busWaitingCount">0</strong><span class="bus-la-sr"> not here yet</span></span></div><div class="bus-la-stop"><div class="bus-la-waiting"><div class="bus-la-wait-grid" id="busWaitingLayer" aria-label="Waiting for the bus"></div></div></div><div class="bus-la-window"><div class="bus-la-riders" id="busHereLayer" aria-label="On the bus"></div></div><button type="button" class="bus-la-close" id="busClose" aria-label="Close attendance"></button><div class="bus-la-tools"><button type="button" id="busTeacher">Attendance Controls</button></div></div>`;
  document.querySelector('.app').appendChild(screen);
  const art=screen.querySelector('.bus-la-bg');
  art.onerror=()=>{artFailed=true;fallback();};art.onload=()=>{artFailed=false;};
  document.getElementById('busClose').onclick=()=>show('dashboard');
  document.getElementById('busTeacher').onclick=()=>document.getElementById('teacherDialog').showModal();
}
function piece(child,here,index){
  const button=document.createElement('button');button.type='button';
  button.className='bus-la-child '+(here?'aboard':'waiting');
  button.dataset.childId=child.id;button.dataset.slot=String(index);
  button.setAttribute('aria-label',(here?'Return ':'Mark here ')+child.name);
  button.setAttribute('aria-pressed',String(here));
  const avatar=document.createElement('span');avatar.className='bus-la-avatar';
  const initial=document.createElement('span');initial.className='bus-la-initial';initial.textContent=friendInitials(child.name);
  avatar.appendChild(initial);
  const photo=safePhoto(child);
  if(photo){
    const img=document.createElement('img');img.alt='';img.src=photo;
    img.onload=()=>{initial.hidden=true;};
    img.onerror=()=>{img.remove();initial.hidden=false;};
    avatar.appendChild(img);
  }
  const label=document.createElement('strong');label.className='bus-la-name';label.textContent=child.name;
  button.append(avatar,label);
  button.onclick=()=>{
    if(button.disabled || !button.isConnected)return;
    const focused=document.activeElement===button;
    setChildPresent(child.id,!here);renderBus();
    if(focused)slots.get(child.id)?.[here?'waiting':'here'].focus({preventScroll:true});
  };
  return button;
}
function fitWaiting(){
  const screen=document.getElementById('busAttendance');
  if(!screen.classList.contains('active'))return;
  const outer=screen.querySelector('.bus-la-waiting'),grid=document.getElementById('busWaitingLayer');
  const frame=outer.getBoundingClientRect(),nodes=[...grid.children];
  if(!frame.width || !frame.height || !nodes.length)return;
  const key=rosterKey+'|'+frame.width+'|'+frame.height;
  if(key===fitKey)return;
  fitKey=key;
  grid.style.width='100%';grid.style.left='0';grid.style.right='auto';
  grid.style.transform='scale(1)';grid.style.removeProperty('--bus-la-name-floor');
  const css=getComputedStyle(grid),paddingX=(parseFloat(css.paddingLeft)+parseFloat(css.paddingRight))*.95,paddingY=(parseFloat(css.paddingTop)+parseFloat(css.paddingBottom))*.95;
  function measure(){
    // Always include placeholders: arrival state cannot affect the chosen fit.
    const rects=nodes.flatMap(node=>[node.getBoundingClientRect(),node.querySelector('.bus-la-avatar').getBoundingClientRect()]);
    const width=Math.max(...rects.map(r=>r.right))-Math.min(...rects.map(r=>r.left));
    const height=Math.max(...rects.map(r=>r.bottom))-Math.min(...rects.map(r=>r.top));
    return Math.min(1,(frame.width-paddingX)/width,(frame.height-paddingY)/height);
  }
  let best={width:100,fit:measure()};
  // Leave fitting source layouts completely untouched. For overflow, trying
  // a little more inner width can remove a whole wrapped row and avoid tiny
  // portraits. The outer shelter and its locked transform never change.
  if(best.fit<.999){
    for(let width=102;width<=180;width+=2){
      grid.style.width=width+'%';
      const fit=measure();
      if(fit>best.fit+.0001)best={width,fit};
    }
  }
  grid.style.width=best.width+'%';grid.style.left='50%';
  grid.style.transform='translateX(-50%) scale(1)';
  // The original 30-child names are 8px before the approved .95 transform.
  // Do not let overflow fitting make another roster's labels smaller than that.
  // Iterate because the slightly larger type can itself change row height.
  for(let pass=0;best.fit<.999 && pass<6;pass++){
    grid.style.setProperty('--bus-la-name-floor',(8/best.fit)+'px');
    const fit=measure();
    if(Math.abs(fit-best.fit)<.0001){best.fit=fit;break;}
    best.fit=fit;
  }
  if(best.fit<.999)grid.style.setProperty('--bus-la-name-floor',(8/best.fit)+'px');
  grid.style.transform=`translateX(-50%) scale(${best.fit})`;
  grid.dataset.fit=String(best.fit);grid.dataset.fitWidth=String(best.width);
}
function renderBus(){
  ensureScreen();
  const screen=document.getElementById('busAttendance'),n=data.roster.length;
  screen.querySelector('.bus-la-stage').className='bus-la-stage bus-la-tier-'+tier(n)+' bus-la-load-'+density(n);
  // Both zones retain every roster slot, including hidden placeholders. A tap
  // only changes the tapped child's visibility, not any other child's position.
  const key=JSON.stringify(data.roster.map(child=>[child.id,child.name,safePhoto(child)]));
  if(key!==rosterKey){
    rosterKey=key;slots=new Map();
    const waiting=document.getElementById('busWaitingLayer'),here=document.getElementById('busHereLayer');
    waiting.replaceChildren();here.replaceChildren();
    data.roster.forEach((child,index)=>{
      const pair={waiting:piece(child,false,index),here:piece(child,true,index)};
      slots.set(child.id,pair);waiting.appendChild(pair.waiting);here.appendChild(pair.here);
    });
  }
  const present=new Set(data.present);
  data.roster.forEach(child=>{
    const pair=slots.get(child.id),onBus=present.has(child.id);
    for(const [zone,button] of Object.entries(pair)){
      const visible=zone==='here'?onBus:!onBus;
      button.classList.toggle('is-placeholder',!visible);button.disabled=!visible;
      button.tabIndex=visible?0:-1;
      if(visible)button.removeAttribute('aria-hidden');else button.setAttribute('aria-hidden','true');
    }
  });
  const count=data.roster.filter(child=>present.has(child.id)).length;
  document.getElementById('busHereCount').textContent=String(count);
  document.getElementById('busWaitingCount').textContent=String(n-count);
  fitWaiting();
}
const oldOpen=openAttendance;
openAttendance=function(){
  if(data.selectedTheme!=='school-bus' || !data.roster.length){oldOpen();return;}
  renderBus();show('busAttendance');fitWaiting();if(artFailed)fallback();
};
function busActive(){return data.selectedTheme==='school-bus' && document.getElementById('busAttendance')?.classList.contains('active');}
const undo=document.getElementById('undoBtn'),oldUndo=undo.onclick;
undo.onclick=()=>{
  if(!busActive()){oldUndo?.();return;}
  const last=data.history.pop();
  if(last===undefined){toast('Nothing to undo.');return;}
  data.present=data.present.filter(id=>id!==last);save();renderBus();toast('Last check-in undone.');
};
const reset=document.getElementById('resetBtn'),oldReset=reset.onclick;
reset.onclick=()=>{
  if(!busActive()){oldReset?.();return;}
  if(confirm('Reset attendance for tomorrow? Your class list will stay saved.')){
    data.present=[];data.history=[];save();renderBus();document.getElementById('teacherDialog').close();toast('Ready for tomorrow.');
  }
};
window.addEventListener('resize',()=>{
  if(!busActive())return;
  fitWaiting();
});
// The School Bus catalog preview must use the neutral standalone artwork too.
const theme=themeCatalog.find(theme=>theme.id==='school-bus');if(theme)theme.thumb=BASE+'background.png';
ensureScreen();renderThemeGrid();renderCurrentTheme();
})();
