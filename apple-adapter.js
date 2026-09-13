(function(){
const BASE='themes/apple-orchard/';
const WAIT={
10:[{x:20.1,y:70.9},{x:83.2,y:64.2},{x:62.6,y:19.2},{x:36.4,y:54.1},{x:30.2,y:27.2},{x:67.1,y:64.8},{x:75.9,y:35.6},{x:17,y:45.6},{x:46.8,y:26.4},{x:51,y:59.2}],
15:[{x:75.9,y:49.4},{x:17.6,y:52.8},{x:43.3,y:19.8},{x:52.8,y:67},{x:31.1,y:74.6},{x:68.3,y:27},{x:32.9,y:38.3},{x:69.5,y:70.4},{x:62,y:51.1},{x:84.1,y:74.8},{x:38.9,y:58},{x:22.3,y:34},{x:55.4,y:18.7},{x:89.3,y:54},{x:48.4,y:42}],
20:[{x:61.5,y:49.8},{x:13.6,y:54.6},{x:90.4,y:59.3},{x:33.2,y:26.4},{x:59.2,y:18.9},{x:70.9,y:80.2},{x:31,y:78.9},{x:75.2,y:40.6},{x:26.8,y:54.3},{x:40.9,y:44.6},{x:20.5,y:37.3},{x:53,y:36.8},{x:17.9,y:71.8},{x:59.5,y:70.9},{x:82,y:73.2},{x:42,y:66.7},{x:85.1,y:41.7},{x:73.9,y:60.4},{x:45,y:19.4},{x:69.4,y:25.7}],
25:[{x:54.5,y:34.5},{x:11.9,y:61.9},{x:90.3,y:55.9},{x:39.9,y:71.3},{x:26.2,y:28.2},{x:74,y:28.9},{x:60.8,y:69},{x:28.9,y:69.4},{x:36.6,y:20.5},{x:44.8,y:35.5},{x:17.4,y:44.2},{x:66.5,y:51.7},{x:61.6,y:18.2},{x:41.2,y:53.7},{x:84.3,y:75.3},{x:84.9,y:40.2},{x:49.2,y:14.5},{x:27.1,y:53.5},{x:34.5,y:39.3},{x:65,y:35.4},{x:50.7,y:71.4},{x:18.8,y:75.6},{x:52.9,y:52.3},{x:71.6,y:80.3},{x:77.3,y:57.9}],
30:[{x:64,y:48.2},{x:10.8,y:57.1},{x:35.6,y:21.3},{x:35.9,y:73.5},{x:89.5,y:67.7},{x:59.9,y:20.8},{x:81.4,y:38.4},{x:47,y:50.6},{x:70.6,y:82.2},{x:27.2,y:45.3},{x:23.2,y:72.6},{x:55.9,y:71.4},{x:76.4,y:53.8},{x:49.2,y:34.7},{x:82.1,y:81.9},{x:34.1,y:57.6},{x:69.7,y:24.6},{x:23.6,y:29.5},{x:87.8,y:50},{x:16.5,y:41.7},{x:48.1,y:19.8},{x:45.3,y:67},{x:20.5,y:57.1},{x:14.4,y:70.6},{x:37.9,y:41.1},{x:58.6,y:35.7},{x:55.7,y:57.8},{x:65,y:64.2},{x:72.5,y:40.3},{x:76,y:68.3}]
};
const WAIT_SCALE={10:.95,15:.9,20:1,25:1,30:1};
const HERE_SCALE={10:1,15:1.05,20:1.15,25:1.25,30:1.2};
const WAIT_SIZE={10:[104,123],15:[88,104],20:[76,90],25:[66,78],30:[58,68]};
const HERE_SIZE={10:[96,96],15:[82,82],20:[72,72],25:[64,64],30:[58,58]};
function bucket(n){return n<=10?10:n<=15?15:n<=20?20:n<=25?25:30}
function initials(n){const p=String(n||'').trim().split(/\s+/);return(p.length>1?p[0][0]+p[p.length-1][0]:p[0]?.[0]||'?').toUpperCase()}
function ensureScreen(){
 if(document.getElementById('appleAttendance'))return;
 const s=document.createElement('section');s.id='appleAttendance';s.className='screen';
 s.innerHTML=`<div class="apple-la-stage"><img class="apple-la-bg" src="${BASE}background.png" alt=""><div class="apple-la-wait" id="appleWaitLayer"></div><div class="apple-la-here" id="appleHereLayer"></div><img class="apple-la-front" src="${BASE}background.png" alt=""><div class="apple-la-count apple-la-here-count" id="appleHereCount">0</div><div class="apple-la-count apple-la-wait-count" id="appleWaitCount">0</div><button class="apple-la-close" id="appleClose" aria-label="Close attendance"></button><div class="apple-la-tools"><button id="appleTeacher">Teacher Mode</button></div></div>`;
 document.querySelector('.app').appendChild(s);
 document.getElementById('appleClose').onclick=()=>show('dashboard');
 document.getElementById('appleTeacher').onclick=()=>document.getElementById('teacherDialog').showModal();
}
function piece(name,state,pos,size,scale,index){
 const b=document.createElement('button');b.className='apple-la-piece '+state;b.style.left=pos.x+'%';b.style.top=pos.y+'%';b.style.width=size[0]+'px';b.style.height=size[1]+'px';b.style.transform=`translate(-50%,-50%) rotate(${pos.r||0}deg) scale(${scale})`;b.style.backgroundImage=`url(${BASE}${state==='here'?'basket-apple.png':'waiting-apple.png'})`;
 b.innerHTML=`<span class="apple-la-photo">${initials(name)}</span><span class="apple-la-name">${name}</span>`;
 b.onclick=()=>toggleApple(index);return b;
}
let config=null;
async function getConfig(){if(config)return config;config=await fetch(BASE+'theme-config.json').then(r=>r.json());return config}
async function renderApple(){
 ensureScreen();const cfg=await getConfig(),n=data.roster.length,b=bucket(n),wait=WAIT[b],pile=cfg.basket.pile;
 const wl=document.getElementById('appleWaitLayer'),hl=document.getElementById('appleHereLayer');wl.innerHTML='';hl.innerHTML='';
 document.getElementById('appleHereCount').textContent=data.present.length;document.getElementById('appleWaitCount').textContent=Math.max(0,n-data.present.length);
 data.roster.forEach((name,i)=>{const is=data.present.includes(i),p=is?pile[Math.min(data.present.indexOf(i),pile.length-1)]:wait[i];if(!p)return;(is?hl:wl).appendChild(piece(name,is?'here':'waiting',p,is?HERE_SIZE[b]:WAIT_SIZE[b],is?HERE_SCALE[b]:WAIT_SCALE[b],i))});
}
function toggleApple(i){const at=data.present.indexOf(i);if(at>=0)data.present.splice(at,1);else{data.present.push(i);data.history.push(i)}save();renderApple()}
const oldOpen=openAttendance;
openAttendance=function(){if(data.selectedTheme==='apple-orchard'){if(!data.roster.length){show('classroom');renderClassroom();toast('Add your friends first.');return}renderApple();show('appleAttendance');return}oldOpen()};
const appleTheme=themeCatalog.find(t=>t.id==='apple-orchard');if(appleTheme)appleTheme.thumb=BASE+'thumbnail.png';
if(!data.ownedThemes.includes('apple-orchard')){data.ownedThemes.push('apple-orchard');save()}
ensureScreen();
const oldUndo=document.getElementById('undoBtn').onclick;document.getElementById('undoBtn').onclick=()=>{if(data.selectedTheme==='apple-orchard'){const last=data.history.pop();if(last===undefined){toast('Nothing to undo.');return}data.present=data.present.filter(i=>i!==last);save();renderApple();toast('Last check-in undone.');return}oldUndo&&oldUndo()};
const oldReset=document.getElementById('resetBtn').onclick;document.getElementById('resetBtn').onclick=()=>{if(data.selectedTheme==='apple-orchard'){if(confirm('Reset attendance for tomorrow? Your class list will stay saved.')){data.present=[];data.history=[];save();renderApple();document.getElementById('teacherDialog').close();toast('Ready for tomorrow.')}return}oldReset&&oldReset()};
renderThemeGrid();renderCurrentTheme();
})();