
const STORAGE_KEY="littleAttendanceCleanV4";
const $=s=>document.querySelector(s);
let data={
  className:"",
  roster:[],
  present:[],
  history:[],
  selectedTheme:"school-bus",
  ownedThemes:["school-bus"]
};

const themeCatalog=[
{id:"school-bus",name:"School Bus",category:"Everyday",tag:"Good friends. Brighter days.",emoji:"🚌",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/school-bus.png"},
{id:"apple-orchard",name:"Apple Orchard",category:"Fall",tag:"A sweet start to the day.",emoji:"🍎",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/shared/attendance-themes/apple-orchard/thumbnail.png"},
{id:"pumpkin-patch",name:"Pumpkin Patch",category:"Fall",tag:"Fall friends. Bright beginnings.",emoji:"🎃",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/pumpkin-patch.png"},
{id:"fall-leaves",name:"Fall Leaves",category:"Fall",tag:"Watch our friendship pile grow!",emoji:"🍂",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/fall-leaves.png"},
{id:"turkey-friends",name:"Turkey Friends",category:"Fall",tag:"Every friend adds something special.",emoji:"🦃",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/turkey-friends.png"},
{id:"penguin-pals",name:"Penguin Pals",category:"Winter",tag:"Cool friends. Warm welcomes.",emoji:"🐧",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/penguin-pals.png"},
{id:"christmas-tree",name:"Christmas Tree",category:"Holidays",tag:"Every friend makes our tree shine.",emoji:"🎄",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/christmas-tree.png"},
{id:"snow-globe",name:"Snow Globe",category:"Winter",tag:"Every friend makes our winter scene complete.",emoji:"❄️",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/snowglobe.png"},
{id:"valentine-mail",name:"Valentine Mail",category:"Holidays",tag:"Sending a little love with every arrival.",emoji:"💌",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/valentine-mailbox.png"},
{id:"frog-pond",name:"Frog Pond",category:"Everyday",tag:"Little hops. Big hellos.",emoji:"🐸",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/frog-pond.png"},
{id:"under-the-sea",name:"Under the Sea",category:"Everyday",tag:"Dive into a bright day.",emoji:"🐠"},
{id:"blast-off",name:"Blast Off!",category:"Everyday",tag:"Launch into a great day.",emoji:"🚀"},
{id:"busy-bees",name:"Busy Bees",category:"Spring",tag:"Buzz into a bright morning.",emoji:"🐝"},
{id:"spring-garden",name:"Spring Garden",category:"Spring",tag:"Grow into a beautiful day.",emoji:"🌷",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/spring-garden.png"},
{id:"butterfly-garden",name:"Butterfly Garden",category:"Spring",tag:"Watch every friend spread their wings.",emoji:"🦋",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/butterfly-garden.png"},
{id:"beach-day",name:"Beach Day",category:"Summer",tag:"Sunny starts and happy hearts.",emoji:"🏖️"},
{id:"firefly-campout",name:"Firefly Campout",category:"Summer",tag:"Every friend adds a little glow.",emoji:"✨",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/v6-test/assets/assets/attendance-themes/firefly-campout.png"},
{id:"snow-day",name:"Snow Day",category:"Winter",tag:"A cozy start together.",emoji:"☃️"},
{id:"love-bugs",name:"Love Bugs",category:"Holidays",tag:"Little friends. Big hearts.",emoji:"❤️"}
];
const themeCats=["All","My Themes","Everyday","Fall","Winter","Spring","Summer","Holidays"];
let themeFilter="All";

function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved) data={...data,...saved};
  }catch(e){}
}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function show(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  $("#"+id).classList.add("active");
  $("#"+id).scrollTop=0;
}
function toast(msg){
  const t=$("#toast");t.textContent=msg;t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1500);
}
function initials(name){
  const p=name.trim().split(/\s+/);
  return p.length===1?p[0][0].toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase();
}
function esc(s){
  return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}


let editingFriendIndex=-1;
let autosaveTimer=null;

function setAutosaveState(saving=false){
  const pill=document.querySelector(".autosave-pill");
  const text=$("#autosaveText");
  if(!pill||!text)return;
  pill.classList.toggle("saving",saving);
  text.textContent=saving?"Saving…":"Saved automatically";
}
function autosaveClassroom(){
  setAutosaveState(true);
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(()=>{save();setAutosaveState(false)},260);
}
function getThemeById(id){
  return themeCatalog.find(t=>t.id===id)||themeCatalog[0];
}
function renderCurrentTheme(){
  const t=getThemeById(data.selectedTheme);
  $("#currentThemeName").textContent=t.name;
  $("#currentThemeTag").textContent=t.tag;
  const art=$("#currentThemeArt");
  art.innerHTML=t.thumb?`<img src="${t.thumb}" alt="">`:`<span>${t.emoji||"♡"}</span>`;
}
function friendInitials(name){
  const parts=name.trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return "♡";
  return parts.length===1?parts[0][0].toUpperCase():(parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
function renderFriends(){
  const g=$("#friendGrid"), empty=$("#friendEmpty");
  const roster=data.roster||[];
  $("#friendCount").textContent=roster.length;
  g.innerHTML="";
  empty.classList.toggle("show",roster.length===0);
  g.style.display=roster.length?"grid":"none";

  roster.forEach((name,i)=>{
    const card=document.createElement("div");
    card.className="friend-card";
    card.innerHTML=`
      <div class="friend-avatar">${friendInitials(name)}</div>
      <div style="min-width:0">
        <div class="friend-card-name">${esc(name)}</div>
        <div class="friend-card-sub">Friend ${i+1}</div>
      </div>
      <div class="friend-actions">
        <button type="button" class="friend-action move-up" title="Move up" aria-label="Move ${esc(name)} up" ${i===0?"disabled":""}>↑</button>
        <button type="button" class="friend-action move-down" title="Move down" aria-label="Move ${esc(name)} down" ${i===roster.length-1?"disabled":""}>↓</button>
        <button type="button" class="friend-action edit" title="Edit" aria-label="Edit ${esc(name)}">✎</button>
        <button type="button" class="friend-action delete" title="Remove" aria-label="Remove ${esc(name)}">×</button>
      </div>`;
    card.querySelector(".move-up").onclick=()=>moveFriend(i,-1);
    card.querySelector(".move-down").onclick=()=>moveFriend(i,1);
    card.querySelector(".edit").onclick=()=>openFriendDialog(i);
    card.querySelector(".delete").onclick=()=>removeFriend(i);
    g.appendChild(card);
  });
}
function renderClassroom(){
  $("#className").value=data.className||"";
  renderCurrentTheme();
  renderFriends();
  // Mirror the already-embedded real logo from the Themes sidebar.
  const source=document.querySelector(".themes-sidebar .real-brand img");
  const target=$("#classroomLogoMirror");
  if(source&&target&&!target.src)target.src=source.src;
}
function openFriendDialog(index=-1){
  editingFriendIndex=index;
  const editing=index>=0;
  const name=editing?data.roster[index]:"";
  $("#friendDialogEyebrow").textContent=editing?"Edit Friend":"Add a Friend";
  $("#friendDialogTitle").textContent=editing?"Update this friend":"Who's joining your classroom?";
  $("#saveFriend").textContent=editing?"Save Changes":"Add Friend";
  $("#friendName").value=name;
  updateFriendPreview();
  $("#friendDialog").showModal();
  setTimeout(()=>$("#friendName").focus(),30);
}
function updateFriendPreview(){
  const name=$("#friendName").value.trim();
  $("#friendPreviewName").textContent=name||"Friend";
  $("#friendPreviewAvatar").textContent=name?friendInitials(name):"♡";
}
function saveFriendFromDialog(){
  const name=$("#friendName").value.trim();
  if(!name){toast("Enter a name first.");return false}
  if(editingFriendIndex<0 && data.roster.length>=30){toast("This classroom already has 30 friends.");return false}
  if(editingFriendIndex>=0)data.roster[editingFriendIndex]=name;
  else data.roster.push(name);
  data.present=[];data.history=[];
  save();renderFriends();setAutosaveState(false);
  toast(editingFriendIndex>=0?"Friend updated.":"Friend added.");
  return true;
}
function removeFriend(index){
  const name=data.roster[index];
  if(!confirm(`Remove ${name} from this classroom?`))return;
  data.roster.splice(index,1);
  data.present=[];data.history=[];
  save();renderFriends();toast(name+" removed.");
}
function moveFriend(index,delta){
  const next=index+delta;
  if(next<0||next>=data.roster.length)return;
  [data.roster[index],data.roster[next]]=[data.roster[next],data.roster[index]];
  data.present=[];data.history=[];
  save();renderFriends();
}


const FALL_LEAVES_CONFIG={"fallTreeLayouts":{"10":[{"x":14,"y":18,"r":-4},{"x":38,"y":18,"r":3},{"x":62,"y":18,"r":1},{"x":86,"y":18,"r":-1},{"x":18,"y":48.9,"r":-3},{"x":49,"y":42.4,"r":4},{"x":67.1,"y":53.2,"r":2},{"x":86,"y":50,"r":0},{"x":32.7,"y":58.2,"r":-2},{"x":51.7,"y":70.5,"r":-4}],"15":[{"x":14,"y":18,"r":-4},{"x":32,"y":18,"r":3},{"x":50,"y":18,"r":1},{"x":68,"y":18,"r":-1},{"x":83.8,"y":23.6,"r":-3},{"x":14,"y":50,"r":4},{"x":28.1,"y":43.4,"r":2},{"x":46.3,"y":40.4,"r":0},{"x":63,"y":41.4,"r":-2},{"x":86,"y":50,"r":-4},{"x":14,"y":82,"r":3},{"x":37.7,"y":64.5,"r":1},{"x":52.9,"y":66.7,"r":-1},{"x":70.5,"y":63.3,"r":-3},{"x":86,"y":82,"r":4}],"20":[{"x":11.5,"y":12.9,"r":-4},{"x":32,"y":18,"r":3},{"x":46.7,"y":10.9,"r":1},{"x":60.6,"y":16.1,"r":-1},{"x":86,"y":18,"r":-3},{"x":16.3,"y":33.6,"r":4},{"x":32,"y":39.3,"r":2},{"x":45.6,"y":32.2,"r":0},{"x":67.7,"y":39.2,"r":-2},{"x":86,"y":39.3,"r":-4},{"x":14.2,"y":55.3,"r":3},{"x":28.5,"y":61.7,"r":1},{"x":42.3,"y":58,"r":-1},{"x":68.7,"y":64.1,"r":-3},{"x":86,"y":60.7,"r":4},{"x":14,"y":82,"r":2},{"x":53.6,"y":48.6,"r":0},{"x":55.7,"y":70.4,"r":-2},{"x":73.9,"y":18.4,"r":-4},{"x":86,"y":82,"r":3}],"25":[{"x":11.4,"y":12.9,"r":-4},{"x":27.8,"y":12.2,"r":3},{"x":46.4,"y":10.9,"r":1},{"x":64.4,"y":10.4,"r":-1},{"x":86,"y":18,"r":-3},{"x":17.7,"y":29.6,"r":4},{"x":36,"y":23.5,"r":2},{"x":53.6,"y":28.5,"r":0},{"x":73.3,"y":24.1,"r":-2},{"x":86,"y":34,"r":-4},{"x":7.8,"y":48.8,"r":3},{"x":28.8,"y":40.3,"r":1},{"x":56,"y":49.9,"r":-1},{"x":68.7,"y":43.8,"r":-3},{"x":86,"y":50,"r":4},{"x":19.3,"y":52.4,"r":2},{"x":31.5,"y":59.2,"r":0},{"x":45.9,"y":59.9,"r":-2},{"x":75.6,"y":60.6,"r":-4},{"x":86,"y":66,"r":3},{"x":14,"y":82,"r":1},{"x":41.3,"y":42.5,"r":-1},{"x":56.2,"y":67.7,"r":-3},{"x":66,"y":71.3,"r":4},{"x":86,"y":82,"r":2}],"30":[{"x":9.3,"y":12.6,"r":-4},{"x":28.4,"y":18,"r":3},{"x":41.7,"y":11.6,"r":1},{"x":58.9,"y":26.7,"r":-1},{"x":74.2,"y":13.2,"r":-3},{"x":86,"y":18,"r":4},{"x":7.3,"y":33.6,"r":2},{"x":28.4,"y":34,"r":0},{"x":44.6,"y":29.2,"r":-2},{"x":51.1,"y":13.2,"r":-4},{"x":63.2,"y":9.3,"r":3},{"x":86,"y":34,"r":1},{"x":17.5,"y":34.9,"r":-1},{"x":24.5,"y":49.6,"r":-3},{"x":36,"y":47.2,"r":4},{"x":61.3,"y":48.6,"r":2},{"x":70,"y":31.8,"r":0},{"x":86,"y":50,"r":-2},{"x":17.4,"y":66.3,"r":-4},{"x":28.4,"y":66,"r":3},{"x":47.1,"y":54.2,"r":1},{"x":60.9,"y":66.9,"r":-1},{"x":74.6,"y":48.5,"r":-3},{"x":86,"y":66,"r":4},{"x":8.5,"y":53.1,"r":2},{"x":28.4,"y":82,"r":0},{"x":39.2,"y":68.7,"r":-2},{"x":50.5,"y":77,"r":-4},{"x":73.5,"y":67.1,"r":3},{"x":86,"y":82,"r":1}]},"fallTreeScales":{"10":1,"15":1.1,"20":1.1,"25":1.25,"30":1.35},"fallPileLayouts":{"10":[{"x":17,"y":38.5,"r":-5},{"x":34.4,"y":52.6,"r":2},{"x":52.8,"y":45.8,"r":-2},{"x":67.5,"y":48.2,"r":5},{"x":14,"y":78.1,"r":1},{"x":26,"y":71.5,"r":-3},{"x":42.9,"y":75,"r":4},{"x":58,"y":71.5,"r":0},{"x":73.4,"y":82,"r":-4},{"x":82.9,"y":65.7,"r":3}],"15":[{"x":16,"y":32.5,"r":-5},{"x":36.5,"y":47.3,"r":2},{"x":47.6,"y":40.4,"r":-2},{"x":61.1,"y":42.7,"r":5},{"x":84,"y":32.5,"r":1},{"x":18,"y":69,"r":-3},{"x":37.5,"y":66.8,"r":4},{"x":50,"y":55.5,"r":0},{"x":70,"y":58.5,"r":-4},{"x":84.4,"y":58,"r":3},{"x":7,"y":76.5,"r":-1},{"x":28.5,"y":79.5,"r":-5},{"x":55.4,"y":77.2,"r":2},{"x":71.5,"y":79.5,"r":-2},{"x":89.9,"y":86.3,"r":5}],"20":[{"x":16,"y":32.5,"r":-5},{"x":60,"y":72.8,"r":2},{"x":43.8,"y":41.2,"r":-2},{"x":58.4,"y":39.5,"r":5},{"x":71.6,"y":45.4,"r":1},{"x":84,"y":35.5,"r":-3},{"x":18.7,"y":77,"r":4},{"x":23.3,"y":58.5,"r":0},{"x":36.7,"y":55.5,"r":-4},{"x":50,"y":58.5,"r":3},{"x":63.3,"y":55.5,"r":-1},{"x":76.7,"y":58.5,"r":-5},{"x":88.9,"y":62.2,"r":2},{"x":8.5,"y":81.6,"r":-2},{"x":30.2,"y":85,"r":5},{"x":42.8,"y":89.5,"r":1},{"x":50,"y":79.5,"r":-3},{"x":61.5,"y":88.8,"r":4},{"x":76.4,"y":88.7,"r":0},{"x":89.8,"y":88.4,"r":-4}],"25":[{"x":16,"y":32.5,"r":-5},{"x":36.1,"y":46.6,"r":2},{"x":47.5,"y":50,"r":-2},{"x":52.8,"y":39,"r":5},{"x":61.1,"y":44.3,"r":1},{"x":61.1,"y":79.5,"r":-3},{"x":84,"y":32.5,"r":4},{"x":16.5,"y":75,"r":0},{"x":20,"y":58.5,"r":-4},{"x":30,"y":55.5,"r":3},{"x":40,"y":58.5,"r":-1},{"x":48.4,"y":63.7,"r":-5},{"x":60,"y":58.5,"r":2},{"x":70,"y":55.5,"r":-2},{"x":74.9,"y":68.9,"r":5},{"x":83.8,"y":56,"r":1},{"x":8.6,"y":86.2,"r":-3},{"x":23.6,"y":89.2,"r":4},{"x":31.9,"y":73.1,"r":0},{"x":39.3,"y":79.5,"r":-4},{"x":50,"y":76.5,"r":3},{"x":52,"y":92,"r":-1},{"x":71,"y":88.5,"r":-5},{"x":82.3,"y":79.5,"r":2},{"x":87.5,"y":93,"r":-2}],"30":[{"x":16,"y":32.5,"r":-5},{"x":27.4,"y":50,"r":2},{"x":36.4,"y":42.7,"r":-2},{"x":45.9,"y":42.5,"r":5},{"x":55.9,"y":39.3,"r":1},{"x":64.1,"y":43.4,"r":-3},{"x":72.5,"y":43.4,"r":4},{"x":84,"y":35.5,"r":0},{"x":9,"y":76.5,"r":-4},{"x":18.7,"y":64.7,"r":3},{"x":26.4,"y":61.4,"r":-1},{"x":34,"y":58.5,"r":-5},{"x":42,"y":55.5,"r":2},{"x":50.2,"y":65,"r":-2},{"x":58,"y":55.5,"r":5},{"x":66,"y":58.5,"r":1},{"x":73.3,"y":61.9,"r":-3},{"x":82,"y":58.5,"r":4},{"x":70.9,"y":76.3,"r":0},{"x":40.5,"y":92.4,"r":-4},{"x":18.3,"y":87.7,"r":3},{"x":24.2,"y":76.5,"r":-1},{"x":32.8,"y":79.5,"r":-5},{"x":41.4,"y":76.5,"r":2},{"x":50.9,"y":90.6,"r":-2},{"x":58.6,"y":76.5,"r":5},{"x":65.2,"y":89.9,"r":1},{"x":75.2,"y":90.3,"r":-3},{"x":80.7,"y":79.3,"r":4},{"x":90.3,"y":86.7,"r":0}]},"fallPileScales":{"10":1,"15":1,"20":1,"25":1.1,"30":1.1},"nameOffset":{"x":0,"y":-10},"bucketRule":"10 / 15 / 20 / 25 / 30 based on total roster size, not current attendance counts","behavior":{"stableSlots":true,"treeNames":true,"pileNames":false,"moveOnlyTappedChild":true},"assets":{"background":"assets/attendance-falling-leaves.png","waitingLeaf":"assets/fall-tree-leaf.png","hereLeaf":"assets/fall-pile-leaf.png"},"fallTreeSizes":{"10":[132,150],"15":[112,127],"20":[96,109],"25":[84,95],"30":[74,84]},"fallPileSizes":{"10":[126,126],"15":[110,110],"20":[96,96],"25":[86,86],"30":[78,78]}};

function fallLeavesBucket(n){
  return n<=10?10:n<=15?15:n<=20?20:n<=25?25:30;
}
function fallLeavesStudentAt(i){
  const item=data.roster[i];
  if(item && typeof item==="object"){
    return {
      id:item.id||("child-"+i),
      name:item.name||("Friend "+(i+1)),
      photo:item.photo||""
    };
  }
  return {id:"child-"+i,name:String(item||("Friend "+(i+1))),photo:""};
}
function fallLeavesSizes(kind,b){
  const key=kind==="tree"?"fallTreeSizes":"fallPileSizes";
  return FALL_LEAVES_CONFIG[key][String(b)];
}
function renderFallLeavesAttendance(){
  const total=data.roster.length;
  const bucket=fallLeavesBucket(total);
  const zone=$("#fallLeavesZone");
  zone.innerHTML="";
  $("#fallHereCount").textContent=data.present.length;
  $("#fallWaitingCount").textContent=Math.max(0,total-data.present.length);

  const tree=FALL_LEAVES_CONFIG.fallTreeLayouts[String(bucket)];
  const pile=FALL_LEAVES_CONFIG.fallPileLayouts[String(bucket)];
  const treeScale=FALL_LEAVES_CONFIG.fallTreeScales[String(bucket)];
  const pileScale=FALL_LEAVES_CONFIG.fallPileScales[String(bucket)];
  const [treeW,treeH]=fallLeavesSizes("tree",bucket);
  const [pileW,pileH]=fallLeavesSizes("pile",bucket);

  data.roster.forEach((_,i)=>{
    const student=fallLeavesStudentAt(i);
    const here=data.present.includes(i);
    const pos=(here?pile:tree)[i]||{x:50,y:50,r:0};

    const el=document.createElement("button");
    el.type="button";
    el.className="fall-la-child "+(here?"here":"waiting");
    el.setAttribute("aria-label",(here?"Return ":"Mark here ")+student.name);
    el.style.setProperty("--x",pos.x+"%");
    el.style.setProperty("--y",pos.y+"%");
    el.style.setProperty("--r",(pos.r||0)+"deg");
    el.style.setProperty("--s",here?pileScale:treeScale);
    el.style.setProperty("--w",(here?pileW:treeW)+"px");
    el.style.setProperty("--h",(here?pileH:treeH)+"px");
    el.style.zIndex=String(100+i);

    const photo=student.photo
      ? `<img src="${student.photo}" alt="">`
      : `<span class="fall-la-initial">${esc((student.name||"?")[0].toUpperCase())}</span>`;

    el.innerHTML=`<span class="fall-la-photo">${photo}</span><strong class="fall-la-name">${esc(student.name)}</strong>`;

    el.addEventListener("click",()=>{
      if(data.present.includes(i)){
        data.present=data.present.filter(x=>x!==i);
        data.history=data.history.filter(x=>x!==i);
      }else{
        data.present.push(i);
        data.history.push(i);
      }
      save();
      renderFallLeavesAttendance();
    });
    zone.appendChild(el);
  });
}
function openAttendance(){
  if(!data.roster.length){
    show("classroom");
    renderClassroom();
    toast("Add your friends first.");
    return;
  }
  if(data.selectedTheme==="fall-leaves"){
    renderFallLeavesAttendance();
    show("fallLeavesAttendance");
  }else{
    renderAttendance();
    show("attendance");
  }
}

function renderAttendance(){
  $("#classLabel").textContent=data.className||"Little Attendance";
  $("#hereCount").textContent=data.present.length;
  $("#waitingCount").textContent=Math.max(0,data.roster.length-data.present.length);
  const g=$("#studentGrid"); g.innerHTML="";
  if(!data.roster.length){
    g.innerHTML='<div class="empty">Add your friends in My Classroom before taking attendance.</div>';
    return;
  }
  data.roster.forEach((name,i)=>{
    const b=document.createElement("button");
    b.className="student"+(data.present.includes(i)?" present":"");
    b.innerHTML=`<div class="avatar">${initials(name)}</div><div class="name">${esc(name)}</div>`;
    b.onclick=()=>{
      if(data.present.includes(i))return;
      data.present.push(i); data.history.push(i); save(); renderAttendance(); toast(name+" is here ♡");
    };
    g.appendChild(b);
  });
}

function renderThemeFilters(){
  const f=$("#filters"); f.innerHTML="";
  themeCats.forEach(c=>{
    const b=document.createElement("button");
    b.className="filter"+(themeFilter===c?" active":"");
    b.textContent=c;
    b.onclick=()=>{themeFilter=c;renderThemeFilters();renderThemeGrid()};
    f.appendChild(b);
  });
}
function renderThemeGrid(){
  const q=($("#themeSearch").value||"").toLowerCase().trim();
  const owned=data.ownedThemes||["school-bus"];
  const list=themeCatalog.filter(t=>{
    const matchFilter=themeFilter==="All" || (themeFilter==="My Themes" && owned.includes(t.id)) || t.category===themeFilter;
    const matchSearch=!q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    return matchFilter&&matchSearch;
  });
  const g=$("#themeGrid"); g.innerHTML="";
  if(!list.length){
    g.innerHTML='<div class="empty-themes">No themes match that search.</div>';
    return;
  }
  list.forEach(t=>{
    const isOwned=owned.includes(t.id);
    const isSelected=data.selectedTheme===t.id;
    const b=document.createElement("button");
    b.className="theme-card"+(isSelected?" selected":"");
    b.innerHTML=`<span class="category">${t.category}</span>
      <div class="theme-art">${t.thumb?`<img src="${t.thumb}" alt="">`:t.emoji}</div>
      <div class="theme-info">
        <h3>${t.name}</h3>
        <p>${t.tag}</p>
        <div class="theme-status ${isSelected?"selected":isOwned?"owned":"locked"}">
          <span>${isSelected?"✓ Selected":isOwned?"✓ Owned":"🔒 Locked"}</span><span>›</span>
        </div>
      </div>`;
    b.onclick=()=>{
      if(isOwned){
        data.selectedTheme=t.id; save(); renderThemeGrid(); if($("#currentThemeName"))renderCurrentTheme(); toast(t.name+" selected.");
      }else{
        toast(t.name+" is locked.");
      }
    };
    g.appendChild(b);
  });
}

$("#takeHotspot").onclick=()=>openAttendance();
$("#classHotspot").onclick=()=>{show("classroom");renderClassroom()};
$("#teacherHotspot").onclick=()=>$("#teacherDialog").showModal();

$("#themesBack").onclick=()=>show("classroom");
$("#themeSearch").oninput=renderThemeGrid;
$("#clearThemeSearch").onclick=()=>{$("#themeSearch").value="";renderThemeGrid()};

$("#addPurchasedTheme").onclick=()=>$("#themeFile").click();
$("#themeFile").onchange=async e=>{
  const f=e.target.files[0]; if(!f)return;
  try{
    const pack=JSON.parse(await f.text());
    const ids=Array.isArray(pack.themeIds)?pack.themeIds:[pack.themeId];
    const valid=ids.filter(id=>themeCatalog.some(t=>t.id===id));
    if(!valid.length) throw new Error();
    data.ownedThemes=[...new Set([...(data.ownedThemes||[]),...valid])];
    save(); renderThemeGrid(); toast(valid.length+" theme"+(valid.length>1?"s":"")+" added.");
  }catch(err){toast("That theme pack could not be added.")}
  e.target.value="";
};

$("#fallLeavesClose").onclick=()=>show("dashboard");
$("#homeBtn").onclick=()=>show("dashboard");
$("#teacherBtn").onclick=()=>$("#teacherDialog").showModal();
$("#closeTeacher").onclick=()=>$("#teacherDialog").close();
$("#undoBtn").onclick=()=>{
  const last=data.history.pop();
  if(last===undefined){toast("Nothing to undo.");return}
  data.present=data.present.filter(i=>i!==last); save(); if(data.selectedTheme==="fall-leaves")renderFallLeavesAttendance(); else renderAttendance(); toast("Last check-in undone.");
};
$("#resetBtn").onclick=()=>{
  if(confirm("Reset attendance for tomorrow? Your class list will stay saved.")){
    data.present=[];data.history=[];save();if(data.selectedTheme==="fall-leaves")renderFallLeavesAttendance(); else renderAttendance();$("#teacherDialog").close();toast("Ready for tomorrow.");
  }
};
$("#fullscreenBtn").onclick=()=>{
  if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};


$("#themesHome").onclick=()=>show("dashboard");
$("#themesAttendance").onclick=()=>openAttendance();
$("#themesTeacher").onclick=()=>$("#teacherDialog").showModal();


$("#className").addEventListener("input",e=>{
  data.className=e.target.value;
  autosaveClassroom();
});
$("#browseThemes").onclick=()=>{renderThemeFilters();renderThemeGrid();show("themes")};
$("#classBack").onclick=()=>show("dashboard");
$("#classroomHome").onclick=()=>show("dashboard");
$("#classroomAttendance").onclick=()=>openAttendance();
$("#classroomTeacher").onclick=()=>$("#teacherDialog").showModal();
$("#addFriendBtn").onclick=()=>openFriendDialog();
$("#addFirstFriendBtn").onclick=()=>openFriendDialog();
$("#cancelFriend").onclick=()=>$("#friendDialog").close();
$("#friendName").addEventListener("input",updateFriendPreview);
$("#friendForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(saveFriendFromDialog())$("#friendDialog").close();
});

load();
renderThemeFilters();
const _themeLogo=document.querySelector(".themes-sidebar .real-brand img");
if(_themeLogo && $("#classroomLogoMirror")) $("#classroomLogoMirror").src=_themeLogo.src;
