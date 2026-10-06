(function(){
'use strict';
// Only render recovered art. The current app owns IDs, saved dates, Undo,
// history, save errors and the exclusive editing lock.
const themes={
 'pumpkin-patch':{screen:'pumpkinPatchAttendance',board:'pumpkinBoard',waiting:'pumpkinWaitingZone',here:'pumpkinHereZone',close:'pumpkinClose',prefix:'pumpkin',name:'Pumpkin Patch',assets:['background.png','waiting-pumpkin.png','here-pumpkin.png','harvest-crate.png','harvest-crate-front.png']},
 halloween:{screen:'halloweenAttendance',board:'halloweenBoard',waiting:'halloweenWaiting',here:'halloweenHere',close:'halloweenClose',prefix:'halloween',name:'Halloween',assets:['background.png','ghost-waiting.png','candy-here.png','bucket-front-mask.png']},
 'our-friends':{screen:'ourFriendsAttendance',board:'ourFriendsBoard',waiting:'ourFriendsWaiting',here:'ourFriendsHere',close:'ourFriendsClose',prefix:'ourFriends',name:'Our Friends',assets:['background.png','polaroid.png','here-box-front-occlusion.png']}
};
const bucket=n=>n<=10?10:n<=15?15:n<=20?20:n<=25?25:30;
const flights=new Map();
function safePhoto(child){
 return [child.photo,child.photoUrl,child.image].find(value=>typeof value==='string' && /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value))||'';
}
function photo(child,className){
 const wrap=document.createElement('span');wrap.className=className;
 const initial=document.createElement('span');initial.className='restored-initial';initial.textContent=friendInitials(child.name);wrap.appendChild(initial);
 const src=safePhoto(child);
 if(src){const image=document.createElement('img');image.alt='';image.src=src;image.onload=()=>{initial.hidden=true;};image.onerror=()=>{image.remove();initial.hidden=false;};wrap.appendChild(image);}
 return wrap;
}
function asset(theme,name,className){const image=document.createElement('img');image.className=className;image.src='themes/'+theme+'/'+name;image.alt='';return image;}
function stopFlights(){
 for(const finish of [...flights.values()])finish();
 flights.clear();
}
function animateMove(theme,child,source,target,from,hadFocus){
 if(!source.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){if(hadFocus)target.focus({preventScroll:true});return;}
 const to=target.getBoundingClientRect();
 if(!from.width||!to.width)return;
 const cfg=themes[theme],shell=document.createElement('div');
 shell.className='restored-flight '+(theme==='pumpkin-patch'?(source.classList.contains('waiting')?'pumpkin-patch-manual-layout':'pumpkin-crate-manual-layout'):'');
 Object.assign(shell.style,{position:'fixed',left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px'});
 const clone=source.cloneNode(true);clone.removeAttribute('id');clone.removeAttribute('data-child-id');clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;clone.disabled=true;
 for(const [name,value] of Object.entries({position:'absolute',left:'0',top:'0',width:'100%',height:'100%',transform:'none',visibility:'visible',margin:'0','pointer-events':'none'}))clone.style.setProperty(name,value,'important');
 shell.appendChild(clone);document.getElementById(cfg.screen).appendChild(shell);target.style.visibility='hidden';
 const dx=to.left-from.left+(to.width-from.width)/2,dy=to.top-from.top+(to.height-from.height)/2;
 const animation=shell.animate([{transform:'translate(0,0)'},{offset:.42,transform:`translate(${dx*.42}px,${dy*.34-24}px) scale(1.04)`},{transform:`translate(${dx}px,${dy}px) scale(${to.width/from.width},${to.height/from.height})`}],{duration:theme==='pumpkin-patch'?620:520,easing:'cubic-bezier(.22,.75,.24,1)',fill:'forwards'});
 let finished=false;
 const finish=()=>{if(finished)return;finished=true;animation.cancel();shell.remove();target.style.visibility='';flights.delete(child.id);if(hadFocus&&document.getElementById(cfg.screen).classList.contains('active'))target.focus({preventScroll:true});};
 flights.set(child.id,finish);animation.finished.then(finish,finish);
}
function piece(theme,child,i,here){
 const button=document.createElement('button');button.type='button';button.dataset.childId=child.id;button.dataset.slot=String(i);button.dataset.here=String(here);button.classList.add('restored-child');
 button.setAttribute('aria-label',(here?'Return ':'Mark here ')+child.name);button.setAttribute('aria-pressed',String(here));
 const b=bucket(data.roster.length);
 if(theme==='pumpkin-patch'){
  button.classList.add('pumpkin-la-child',here?'aboard':'waiting');
  const p=(here?PUMPKIN_FINAL_CRATE_LAYOUTS:PUMPKIN_FINAL_PATCH_LAYOUTS)[b][i],scale=(here?PUMPKIN_FINAL_CRATE_SCALES:PUMPKIN_FINAL_PATCH_SCALES)[b];
  const sizes=here?{10:[112,112],15:[98,98],20:[86,86],25:[76,76],30:[68,68]}:{10:[130,135],15:[112,116],20:[96,100],25:[84,88],30:[74,78]},prefix=here?'--pc-':'--pp-';
  for(const [key,value] of Object.entries({left:p.x+'%',top:p.y+'%',w:sizes[b][0]+'px',h:sizes[b][1]+'px',scale,rot:p.r+'deg'}))button.style.setProperty(prefix+key,value);
  if(here)button.style.zIndex=String(950+i);
  const label=document.createElement('strong');label.className='pumpkin-la-name';label.textContent=child.name;button.append(photo(child,'pumpkin-la-avatar'),label);
 }else if(theme==='halloween'){
  const conf=(here?HALLOWEEN_HERE:HALLOWEEN_WAITING)[b],p=conf.positions[i],kind=here?'candy':'ghost';
  button.classList.add('halloween-'+kind);button.style.left=p.x+'%';button.style.top=p.y+'%';button.style.setProperty('--r',p.r+'deg');button.style.setProperty('--piece-scale',conf.size/100);
  button.append(photo(child,'halloween-'+kind+'-photo'),asset(theme,here?'candy-here.png':'ghost-waiting.png','halloween-'+kind+'-frame'));
  if(!here){const label=document.createElement('span');label.className='halloween-ghost-name';label.textContent=child.name;button.appendChild(label);}
 }else{
  const p=(here?OUR_FRIENDS_HERE:OUR_FRIENDS_WAITING)[i];button.classList.add('friends-la-kid');button.style.left=p.x+'%';button.style.top=p.y+'%';button.style.width=(8.2*(here?78:62)/100)+'%';button.style.transform=`translate(-50%,-50%) rotate(${p.r}deg)`;
  const label=document.createElement('span');label.className='name';label.textContent=child.name;button.append(photo(child,'friends-la-photo'),asset(theme,'polaroid.png','frame'),label);
 }
 button.onclick=()=>{
  if(!button.isConnected || flights.has(child.id) || !document.getElementById(themes[theme].screen).classList.contains('active'))return;
  const from=button.getBoundingClientRect(),hadFocus=document.activeElement===button;
  // Commit synchronously through the guarded state API. Animation never queues
  // a late write after Close, Reset, a new day, a lock loss or another theme.
  const saved=setChildPresent(child.id,!here);if(saved===null||saved===undefined)return;
  render(theme);
  const target=[...document.getElementById(themes[theme][here?'waiting':'here']).children].find(el=>el.dataset.childId===child.id);
  if(target)animateMove(theme,child,button,target,from,hadFocus);
  if(!saved)toastSaveResult(false,'');
 };
 return button;
}
function render(theme){
 stopFlights();const cfg=themes[theme];
 const waiting=document.getElementById(cfg.waiting),here=document.getElementById(cfg.here);waiting.replaceChildren();here.replaceChildren();
 data.roster.forEach((child,i)=>{const present=data.present.includes(child.id);(present?here:waiting).appendChild(piece(theme,child,i,present));});
 const count=data.roster.filter(child=>data.present.includes(child.id)).length;
 for(const [suffix,value,label] of [['HereCount',count,'here'],['WaitingCount',data.roster.length-count,'not here yet']]){
  const node=document.getElementById(cfg.prefix+suffix);if(node){node.textContent=String(value);node.setAttribute('aria-label',value+' '+label);}
 }
 document.getElementById(cfg.prefix+'Status').textContent=count+' here, '+(data.roster.length-count)+' not here yet';
 renderEditingState();
}
function fallback(theme){const cfg=themes[theme];if(!document.getElementById(cfg.screen).classList.contains('active'))return;stopFlights();renderAttendance();show('attendance');toast(cfg.name+' could not load. Your attendance is available here.');}
function loadArt(theme){
 const cfg=themes[theme];if(cfg.artStatus==='loading'||cfg.artStatus==='ready')return;
 cfg.artStatus='loading';
 Promise.all(cfg.assets.map(name=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src='themes/'+theme+'/'+name;}))).then(()=>{cfg.artStatus='ready';},()=>{cfg.artStatus='failed';fallback(theme);});
}
for(const [theme,cfg] of Object.entries(themes)){
 const screen=document.getElementById(cfg.screen),board=document.getElementById(cfg.board);screen.setAttribute('aria-label',cfg.name+' attendance');
 const tools=document.createElement('div');tools.className='restored-tools';
 const controls=document.createElement('button');controls.type='button';controls.id=cfg.prefix+'Teacher';controls.textContent='Attendance Controls';controls.onclick=()=>{stopFlights();document.getElementById('teacherDialog').showModal();};tools.appendChild(controls);board.appendChild(tools);
 const status=document.createElement('span');status.id=cfg.prefix+'Status';status.className='restored-sr';status.setAttribute('role','status');status.setAttribute('aria-live','polite');board.appendChild(status);
 const close=document.getElementById(cfg.close);close.type='button';close.onclick=()=>show('dashboard');
}
const priorShow=show;
show=function(id){stopFlights();priorShow(id);};
const priorOpen=openAttendance;
openAttendance=function(){
 const cfg=themes[data.selectedTheme];if(!cfg||!data.roster.length){priorOpen();return;}
 ensureAttendanceDay();render(data.selectedTheme);show(cfg.screen);loadArt(data.selectedTheme);
};
window.addEventListener('attendancechange',()=>{for(const [theme,cfg] of Object.entries(themes))if(document.getElementById(cfg.screen).classList.contains('active'))render(theme);});
window.addEventListener('pagehide',stopFlights);
window.addEventListener('resize',stopFlights);
})();
