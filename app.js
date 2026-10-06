
const STORAGE_KEY="littleAttendanceCleanV4";
const $=s=>document.querySelector(s);
let data={
  schemaVersion:2,
  attendanceDay:null,
  attendanceRecordId:"undated",
  saveAttendanceHistory:false,
  attendanceRecords:[],
  undoActions:[],
  className:"",
  roster:[],
  present:[],
  history:[],
  selectedTheme:"school-bus",
  ownedThemes:["school-bus"]
};

const themeCatalog=[
{id:"school-bus",name:"School Bus",category:"Everyday",tag:"Good friends. Brighter days.",emoji:"🚌",thumb:"themes/school-bus/thumbnail.png"},
{id:"our-friends",name:"Our Friends",category:"Everyday",tag:"Same friends. Brighter days.",emoji:"♡"},
{id:"halloween",name:"Halloween",category:"Holidays",tag:"A sweet little spooky hello.",emoji:"👻"},
{id:"apple-orchard",name:"Apple Orchard",category:"Fall",tag:"A sweet start to the day.",emoji:"🍎",thumb:"https://raw.githubusercontent.com/melinahargrove-droid/early-eagle-classroom/main/shared/attendance-themes/apple-orchard/thumbnail.png"},
{id:"pumpkin-patch",name:"Pumpkin Patch",category:"Fall",tag:"Fall friends. Bright beginnings.",emoji:"🎃",thumb:"themes/pumpkin-patch/thumbnail.png"},
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

// V4 used roster positions as identity. Keep the same storage key, but migrate
// each child to an enduring ID and retain the exact pre-migration value.
const BACKUP_KEY=STORAGE_KEY+"_beforeStableIds";
const DAY_BACKUP_KEY=STORAGE_KEY+"_beforeAttendanceDays";
let dayMigrationBackup=null;
let storedValue=null;
let migrationBackup=null;
let storageBlocked=false;
let storageError="";
let storageIssue="";
let savedSessionValue=JSON.stringify(data);
let unsavedChanges=false;
let nextChildId=0;
// Web Locks coordinate every cooperating copy that uses this storage key.
// Never use a timed lease or steal a lock: a paused owner may have unsaved work.
const EDITING_LOCK_NAME=STORAGE_KEY;
let editingLockHeld=false;
let editingLockState="pending";
let editingLockMessage="Checking whether this tab can edit the classroom…";
let releaseEditingLock=null;
let editingLockGeneration=0;
let pageIsLeaving=false;
function storageNotice(){
  return editingLockHeld?storageError:[editingLockMessage,storageError].filter(Boolean).join(" ");
}
function renderEditingState(){
  const message=storageNotice();
  $("#storageWarningText").textContent=message;
  $("#storageWarning").hidden=!message;
  const retry=$("#retrySave");
  retry.hidden=editingLockHeld?storageIssue!=="write":editingLockState!=="blocked";
  retry.textContent=editingLockHeld?"Try saving again":"Try editing";
  // ARIA-disabled keeps the artwork/layout unchanged. Mutation gates below are
  // the enforcement boundary, including direct calls and asynchronous handlers.
  document.querySelectorAll("#className,#saveFriend,#savePasteList,#saveAttendanceHistory,#startTodayBtn,#startNewDay,#undoBtn,#resetBtn,#addPurchasedTheme,.friend-action.move-up,.friend-action.move-down,.friend-action.delete,.theme-card,#studentGrid button,#fallLeavesZone button,#appleWaitLayer button,#appleHereLayer button,#busWaitingLayer button,#busHereLayer button,.restored-child").forEach(control=>control.setAttribute("aria-disabled",String(!editingLockHeld)));
  $("#className").readOnly=!editingLockHeld;
  renderDialogStorageWarnings();
  setAutosaveState(false);
}
function requireEditingLock(){
  if(editingLockHeld)return true;
  renderEditingState();
  toast(editingLockMessage);
  return false;
}
function requestEditingLock(){
  if(editingLockHeld || pageIsLeaving || editingLockState==="requesting")return;
  const generation=++editingLockGeneration;
  if(!navigator.locks || typeof navigator.locks.request!=="function"){
    editingLockState="unsupported";
    editingLockMessage="Read only: safe editing is unavailable in this browser. Open the secure version of this page in an up-to-date browser. You can still view and print saved attendance; your classroom has not been changed.";
    renderEditingState();return;
  }
  editingLockState="requesting";
  editingLockMessage="Checking whether this tab can edit the classroom…";
  renderEditingState();
  const failed=()=>{
    if(generation!==editingLockGeneration)return;
    editingLockHeld=false;releaseEditingLock=null;editingLockState="blocked";
    editingLockMessage="Read only: safe editing could not be started. Keep any unsaved work in this tab and try editing again.";
    renderEditingState();
  };
  try{
    navigator.locks.request(EDITING_LOCK_NAME,{mode:"exclusive",ifAvailable:true},lock=>{
      if(generation!==editingLockGeneration || pageIsLeaving)return;
      if(!lock){
        editingLockState="blocked";
        editingLockMessage="Read only: another tab is editing this classroom. Close that tab after its changes are saved, then choose Try editing here. Nothing in this tab will be automatically replaced.";
        renderEditingState();return;
      }
      // Check under the lock before enabling any edit. Never reload a snapshot
      // or a form draft here, even when the tab appears clean.
      try{
        if(localStorage.getItem(STORAGE_KEY)!==storedValue){
          showStorageConflict();
          editingLockState="stale";
          editingLockMessage="Read only: reload to use the latest saved classroom. Keep this tab open if you need to review any unsaved work or draft first.";
          renderEditingState();return;
        }
        if(storageBlocked){
          editingLockState="stale";
          editingLockMessage="Read only: the saved classroom could not be safely validated. Existing data and this tab have been left untouched.";
          renderEditingState();return;
        }
      }catch(error){failed();return;}
      editingLockHeld=true;editingLockState="held";editingLockMessage="";
      const held=new Promise(resolve=>{releaseEditingLock=resolve;});
      renderEditingState();checkAttendanceDate();
      return held;
    }).catch(failed);
  }catch(error){failed();}
}
function releaseEditingSession(){
  pageIsLeaving=true;
  ++editingLockGeneration;
  editingLockHeld=false;editingLockState="paused";
  editingLockMessage="Read only: editing is paused until this tab safely reacquires the classroom.";
  const release=releaseEditingLock;releaseEditingLock=null;
  renderEditingState();
  if(release)release();
}
window.addEventListener("pagehide",releaseEditingSession);
window.addEventListener("pageshow",()=>{
  pageIsLeaving=false;
  requestEditingLock();
});
function newChildId(){
  let id;
  do{id=globalThis.crypto?.randomUUID?.()||("child-"+Date.now().toString(36)+"-"+(++nextChildId));}
  while(data.roster.some(child=>child.id===id));
  return id;
}
function migrateState(saved){
  if(!saved || typeof saved!=="object" || Array.isArray(saved) ||
     !Array.isArray(saved.roster) ||
     (saved.schemaVersion!==undefined && ![1,2].includes(saved.schemaVersion)) ||
     (saved.className!==undefined && typeof saved.className!=="string") ||
     (saved.present!==undefined && !Array.isArray(saved.present)) ||
     (saved.history!==undefined && !Array.isArray(saved.history)) ||
     (saved.ownedThemes!==undefined && !Array.isArray(saved.ownedThemes))){
    throw new Error("Unrecognized saved classroom");
  }
  const used=new Set();
  const roster=saved.roster.map((item,index)=>{
    const child=typeof item==="string"?{name:item}:item;
    if(!child || typeof child!=="object" || typeof child.name!=="string")throw new Error("Unrecognized saved child");
    let id=typeof child.id==="string" && child.id?child.id:"migrated-child-"+index;
    while(used.has(id))id+="-copy";
    used.add(id);
    return {...child,id};
  });
  const stable=[1,2].includes(saved.schemaVersion);
  const toIds=values=>(values||[]).map(value=>stable?value:(Number.isInteger(value)?roster[value]?.id:null)).filter(id=>used.has(id));
  const present=[...new Set(toIds(saved.present))];
  // Old Apple returns left stale entries. The last check-in determines Undo order.
  const history=[...new Set(toIds(saved.history).filter(id=>present.includes(id)).reverse())].reverse();
  const dayState=migrateAttendanceDays(saved,history);
  return {...data,...saved,...dayState,schemaVersion:2,roster,present,history,
    selectedTheme:themeCatalog.some(t=>t.id===saved.selectedTheme)?saved.selectedTheme:data.selectedTheme,
    ownedThemes:[...new Set(["school-bus",...(saved.ownedThemes||[]).filter(id=>typeof id==="string")])]};
}
function warnUnsavedChanges(event){
  if(!unsavedChanges)return;
  event.preventDefault();
  event.returnValue="";
}
function trackUnsavedChanges(){
  unsavedChanges=JSON.stringify(data)!==savedSessionValue;
  if(unsavedChanges)window.addEventListener("beforeunload",warnUnsavedChanges);
  else window.removeEventListener("beforeunload",warnUnsavedChanges);
}
function renderDialogStorageWarnings(){
  // Native modal dialogs sit above the page and make page controls inert.
  // Keep the same storage status and safe retry reachable inside each dialog.
  document.querySelectorAll("dialog").forEach(dialog=>{
    let warning=dialog.querySelector(".storage-warning-dialog");
    if(!warning && storageNotice()){
      warning=document.createElement("div");
      warning.className="storage-warning-dialog";
      warning.setAttribute("role","alert");
      const message=document.createElement("span"),retry=document.createElement("button");
      retry.type="button";retry.className="secondary";retry.textContent="Try saving again";
      retry.onclick=retrySave;
      warning.append(message,retry);
      dialog.querySelector("h2").insertAdjacentElement("afterend",warning);
    }
    if(warning){
      warning.hidden=!storageNotice();
      warning.querySelector("span").textContent=storageNotice();
      warning.querySelector("button").hidden=editingLockHeld?storageIssue!=="write":editingLockState!=="blocked";
      warning.querySelector("button").textContent=editingLockHeld?"Try saving again":"Try editing";
    }
  });
}
function retrySave(){if(!editingLockHeld){requestEditingLock();return;}toastSaveResult(save(),"Changes saved.");}
function showStorageError(message,issue="write"){
  storageError=message;
  storageIssue=issue;
  renderEditingState();
}
function showStorageConflict(){
  storageBlocked=true;
  showStorageError(unsavedChanges
    ?"This classroom changed in another tab. Your changes here are not saved. Keep this tab open to review them; reloading would discard them and use the latest saved classroom."
    :"This classroom changed in another tab. This tab is out of date. Reload to use the latest saved classroom.","conflict");
}
function checkForExternalChanges(){
  if(storageBlocked)return;
  try{
    if(localStorage.getItem(STORAGE_KEY)!==storedValue)showStorageConflict();
  }catch(e){
    // A read-only check cannot establish whether unsaved work can be saved.
    // The next explicit save still verifies the original stored value.
    showStorageError("Browser storage could not be checked. Keep this tab open and try saving again.");
  }
}
function load(){
  try{
    storedValue=localStorage.getItem(STORAGE_KEY);
    if(storedValue!==null){
      const saved=JSON.parse(storedValue);
      data=migrateState(saved);
      if(saved.schemaVersion===undefined)migrationBackup=storedValue;
      if(saved.schemaVersion!==2)dayMigrationBackup=storedValue;
    }
  }catch(e){
    storageBlocked=true;
    showStorageError("Saved classroom could not be read. Existing browser data has been left untouched. Changes in this session cannot be saved.","load");
  }
  savedSessionValue=JSON.stringify(data);
}
function save(){
  if(!requireEditingLock())return false;
  updateAttendanceRecord();
  renderAttendanceControls();
  trackUnsavedChanges();
  if(storageBlocked){
    if(storageIssue==="conflict")showStorageConflict();
    return false;
  }
  try{
    // A stale tab must never silently overwrite another tab's classroom.
    if(localStorage.getItem(STORAGE_KEY)!==storedValue){
      showStorageConflict();
      return false;
    }
    if(migrationBackup!==null){
      if(localStorage.getItem(BACKUP_KEY)===null)localStorage.setItem(BACKUP_KEY,migrationBackup);
    }
    if(dayMigrationBackup!==null && localStorage.getItem(DAY_BACKUP_KEY)===null)localStorage.setItem(DAY_BACKUP_KEY,dayMigrationBackup);
    const next=JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY,next);
    storedValue=next;
    savedSessionValue=next;
    trackUnsavedChanges();
    migrationBackup=null;
    dayMigrationBackup=null;
    storageError="";
    storageIssue="";
    renderEditingState();
    return true;
  }catch(e){
    showStorageError("Changes are only kept in this session. Browser storage is unavailable or full; do not close this tab until saving works again.");
    return false;
  }
}
function setChildPresent(id,here){
  if(!requireEditingLock())return null;
  if(!data.roster.some(child=>child.id===id))return;
  if(!ensureAttendanceDay())return null;
  if(here){
    if(data.present.includes(id))return;
    data.present.push(id);data.history.push(id);
    data.undoActions.push({type:"checkin",id});
  }else{
    data.present=data.present.filter(value=>value!==id);
    data.history=data.history.filter(value=>value!==id);
    const undoIndex=data.undoActions.findLastIndex(action=>action.type==="checkin"&&action.id===id);
    if(undoIndex>=0)data.undoActions.splice(undoIndex,1);
  }
  return save();
}
function show(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  $("#"+id).classList.add("active");
  $("#"+id).scrollTop=0;
}
function toast(msg){
  const t=$("#toast");t.textContent=msg;t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1500);
}
function toastSaveResult(saved,message){
  toast(saved?message:"Changes kept only in this tab. Not saved; keep this tab open.");
}
function initials(name){return friendInitials(name);}
function esc(s){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}


// Daily records are local to this browser. A missing date stays undated until
// the teacher explicitly starts today. Loading never writes or clears attendance.
let acknowledgedAttendanceDay=null;
let pendingAttendanceDate=null;
let attendancePrintInProgress=false;
function localAttendanceDate(){
  const now=new Date();
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
}
function validAttendanceDate(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T12:00:00");
  return !Number.isNaN(date.getTime()) && [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-")===value;
}
function attendanceDateLabel(value){return value===null?"Undated attendance":value;}
function migrateAttendanceDays(saved,history){
  const fail=()=>{throw new Error("Unrecognized attendance records");};
  const object=value=>value && typeof value==="object" && !Array.isArray(value);
  const id=value=>typeof value==="string" && value.length>0;
  const ids=value=>Array.isArray(value)&&value.every(id)&&new Set(value).size===value.length;
  const fields=["attendanceDay","attendanceRecordId","saveAttendanceHistory","attendanceRecords","undoActions"];
  if(saved.schemaVersion!==2){
    // Do not ignore a half-written or unsupported days upgrade.
    if(fields.some(field=>Object.hasOwn(saved,field)))fail();
    return {attendanceDay:null,attendanceRecordId:"undated",saveAttendanceHistory:false,attendanceRecords:[],undoActions:history.map(id=>({type:"checkin",id}))};
  }
  if((saved.attendanceDay!==null&&!validAttendanceDate(saved.attendanceDay))||!id(saved.attendanceRecordId)||typeof saved.saveAttendanceHistory!=="boolean"||!Array.isArray(saved.attendanceRecords)||!Array.isArray(saved.undoActions))fail();
  const recordIds=new Set();
  for(const record of saved.attendanceRecords){
    if(!object(record)||!id(record.id)||recordIds.has(record.id)||(record.date!==null&&!validAttendanceDate(record.date))||!Array.isArray(record.students))fail();
    recordIds.add(record.id);const children=new Set();
    for(const child of record.students){
      if(!object(child)||!id(child.id)||children.has(child.id)||typeof child.name!=="string"||typeof child.present!=="boolean"||Object.keys(child).some(key=>!["id","name","present"].includes(key)))fail();
      children.add(child.id);
    }
    if(Object.keys(record).some(key=>!["id","date","students"].includes(key)))fail();
    if(record.id===saved.attendanceRecordId&&record.date!==saved.attendanceDay)fail();
  }
  for(const action of saved.undoActions){
    if(!object(action))fail();
    if(action.type==="checkin"){if(!id(action.id))fail();}
    else if(action.type==="add"){if(!ids(action.ids)||!action.ids.length)fail();}
    else if(action.type==="reset"){if(!ids(action.present)||!ids(action.history)||action.history.some(id=>!action.present.includes(id)))fail();}
    else if(action.type==="remove"){
      if(!object(action.child)||!id(action.child.id)||typeof action.child.name!=="string"||!Number.isInteger(action.index)||action.index<0||!Number.isInteger(action.presentIndex)||action.presentIndex< -1||!Number.isInteger(action.historyIndex)||action.historyIndex< -1||(action.historyIndex>=0&&action.presentIndex<0))fail();
    }else fail();
  }
  return Object.fromEntries(fields.map(field=>[field,saved[field]]));
}
function updateAttendanceRecord(){
  if(!data.saveAttendanceHistory)return;
  const record={id:data.attendanceRecordId,date:data.attendanceDay,students:data.roster.map(child=>({id:child.id,name:child.name,present:data.present.includes(child.id)}))};
  const index=data.attendanceRecords.findIndex(item=>item.id===record.id);
  if(index<0)data.attendanceRecords.push(record);else data.attendanceRecords[index]=record;
}
function refreshAttendanceViews(){
  renderFriends();
  if($("#fallLeavesAttendance").classList.contains("active"))renderFallLeavesAttendance();
  if($("#attendance").classList.contains("active"))renderAttendance();
  renderAttendanceControls();
  window.dispatchEvent(new Event("attendancechange"));
}
function undoAttendance(){
  if(!requireEditingLock())return false;
  const action=data.undoActions.at(-1);
  if(!action){toast("Nothing to undo.");return;}
  if(action.type==="add"){
    const created=new Set(action.ids);
    data.roster=data.roster.filter(child=>!created.has(child.id));
    data.present=data.present.filter(id=>!created.has(id));
    data.history=data.history.filter(id=>!created.has(id));
  }else if(action.type==="remove"){
    if(data.roster.some(child=>child.id===action.child.id)){toast("This friend is already in the class. Nothing was replaced.");return;}
    if(data.roster.length>=30){toast("This class is full. This friend cannot be restored without exceeding 30. Undo is still available.");return;}
    data.roster.splice(Math.min(action.index,data.roster.length),0,JSON.parse(JSON.stringify(action.child)));
    if(action.presentIndex>=0)data.present.splice(Math.min(action.presentIndex,data.present.length),0,action.child.id);
    if(action.historyIndex>=0)data.history.splice(Math.min(action.historyIndex,data.history.length),0,action.child.id);
  }else if(action.type==="reset"){
    const ids=new Set(data.roster.map(child=>child.id));
    data.present=action.present.filter(id=>ids.has(id));
    data.history=action.history.filter(id=>ids.has(id));
  }else{
    data.present=data.present.filter(id=>id!==action.id);
    data.history=data.history.filter(id=>id!==action.id);
  }
  data.undoActions.pop();
  const saved=save();refreshAttendanceViews();
  toastSaveResult(saved,action.type==="add"?"Added friends undone.":action.type==="remove"?"Friend restored.":action.type==="reset"?"Reset undone.":"Last check-in undone.");
}
function resetAttendance(){
  if(!requireEditingLock())return false;
  if(!confirm("Reset this attendance now? Your class list and date stay the same. You can Undo this reset."))return;
  // Repeated resets of an already-clear board must not hide the useful Undo.
  if(!data.present.length&&!data.history.length){toast("Attendance is already clear.");return;}
  data.undoActions.push({type:"reset",present:[...data.present],history:[...data.history]});
  data.present=[];data.history=[];
  const saved=save();refreshAttendanceViews();$("#teacherDialog").close();toastSaveResult(saved,"Attendance reset. Undo is available in Attendance Controls.");
}
function renderAttendanceControls(){
  const toggle=$("#saveAttendanceHistory");if(!toggle)return;
  toggle.checked=data.saveAttendanceHistory;
  $("#attendanceDayLabel").textContent=attendanceDateLabel(data.attendanceDay);
  $("#startTodayBtn").disabled=data.attendanceDay===localAttendanceDate();
  $("#historyState").textContent=data.saveAttendanceHistory?"On: attendance records update automatically.":"Off: no new history updates. Previously saved records stay available.";
  $("#viewAttendanceHistory").textContent=`View saved attendance (${data.attendanceRecords.length})`;
}
function ensureAttendanceDay(force=false){
  renderAttendanceControls();
  const today=localAttendanceDate();
  if(!force&&(data.attendanceDay===today||acknowledgedAttendanceDay===today))return true;
  if(!$("#newDayDialog").open||pendingAttendanceDate!==today){
    pendingAttendanceDate=today;
    $("#newDayMessage").textContent=`The board is ${data.attendanceDay===null?"undated":"for "+data.attendanceDay}. Today on this device is ${today}. Start today with everyone not here yet? Your class list stays the same. Starting a new day cannot be undone and clears earlier Undo actions.`;
    $("#newDayHistoryMessage").textContent=data.saveAttendanceHistory?"Your current attendance will be kept in saved attendance before the new day starts.":"Save attendance history is off. Starting today replaces the current attendance and clears Undo; it will not be added to saved history.";
    $("#startNewDay").textContent="Start "+today;
    if(!$("#newDayDialog").open)$("#newDayDialog").showModal();
  }
  return false;
}
function checkAttendanceDate(){
  renderAttendanceControls();
  if(attendancePrintInProgress || !editingLockHeld)return;
  // Undated legacy data is explained on entering attendance, not guessed on load.
  if(data.attendanceDay!==null && data.attendanceDay!==localAttendanceDate() && !storageBlocked)ensureAttendanceDay();
}
function startNewAttendanceDay(){
  if(!requireEditingLock())return false;
  if(!$("#newDayDialog").open)return;
  const today=localAttendanceDate();
  if(pendingAttendanceDate!==today){ensureAttendanceDay(true);return;}
  if(data.attendanceDay===today){$("#newDayDialog").close();return;}
  const previous=JSON.parse(JSON.stringify(data));
  // Preserve the old snapshot and the new day in the same storage value. If any
  // backup/read/write fails, retain the old session too. Detected conflicts stay blocked.
  updateAttendanceRecord();
  data.attendanceDay=today;
  data.attendanceRecordId="day-"+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+"-"+(++nextChildId));
  data.present=[];data.history=[];data.undoActions=[];
  if(!save()){
    data=previous;trackUnsavedChanges();renderAttendanceControls();
    if(storageIssue==="conflict")showStorageConflict();
    toast("New day did not start. Your current attendance is unchanged. Try saving again, then start today.");
    return;
  }
  acknowledgedAttendanceDay=today;
  $("#newDayDialog").close();refreshAttendanceViews();toast("Started "+today+".");
}
function renderSavedAttendance(){
  const list=$("#attendanceRecordList");list.replaceChildren();
  const dateCounts=new Map();
  data.attendanceRecords.forEach(record=>dateCounts.set(record.date,(dateCounts.get(record.date)||0)+1));
  [...data.attendanceRecords].reverse().forEach(record=>{
    const sameDate=data.attendanceRecords.filter(item=>item.date===record.date);
    const entry=dateCounts.get(record.date)>1?" · record "+(sameDate.findIndex(item=>item.id===record.id)+1):"";
    const option=document.createElement("option");option.value=record.id;
    option.textContent=attendanceDateLabel(record.date)+entry+" · "+record.students.filter(child=>child.present).length+" of "+record.students.length+" here";
    list.appendChild(option);
  });
  list.disabled=!list.options.length;
  $("#attendanceHistoryEmpty").hidden=Boolean(list.options.length);
  showSavedAttendanceRecord();
}
function showSavedAttendanceRecord(){
  const record=data.attendanceRecords.find(record=>record.id===$("#attendanceRecordList").value);
  const tbody=$("#attendanceHistoryRows");tbody.replaceChildren();
  $("#printAttendanceRecord").disabled=!record;
  $("#attendanceHistoryTable").hidden=!record;
  $("#savedAttendanceDate").textContent=record?attendanceDateLabel(record.date):"";
  if(!record)return;
  record.students.forEach(child=>{
    const row=document.createElement("tr"),name=document.createElement("td"),status=document.createElement("td");
    name.textContent=child.name;status.textContent=child.present?"Here":"Not here yet";row.append(name,status);tbody.appendChild(row);
  });
}
function printSavedAttendance(){
  if(attendancePrintInProgress)return;
  const record=data.attendanceRecords.find(record=>record.id===$("#attendanceRecordList").value);if(!record)return;
  // A text-only print surface excludes photos, controls, storage messages and profiles.
  const surface=$("#attendancePrint");surface.replaceChildren();
  const heading=document.createElement("h1");heading.textContent="Attendance · "+attendanceDateLabel(record.date);surface.appendChild(heading);
  const table=document.createElement("table"),header=document.createElement("tr");
  ["Name","Attendance"].forEach(label=>{const cell=document.createElement("th");cell.textContent=label;header.appendChild(cell);});table.appendChild(header);
  record.students.forEach(child=>{const row=document.createElement("tr");[child.name,child.present?"Here":"Not here yet"].forEach(value=>{const cell=document.createElement("td");cell.textContent=value;row.appendChild(cell);});table.appendChild(row);});surface.appendChild(table);
  attendancePrintInProgress=true;
  surface.setAttribute("aria-hidden","false");
  document.body.classList.add("printing-attendance");
  // Remove native modal top-layer content from the print job; restore it after.
  const wasOpen=$("#attendanceHistoryDialog").open;if(wasOpen)$("#attendanceHistoryDialog").close();
  const finish=()=>{
    window.removeEventListener("afterprint",finish);
    attendancePrintInProgress=false;document.body.classList.remove("printing-attendance");
    surface.replaceChildren();surface.setAttribute("aria-hidden","true");
    if(wasOpen&&!$("#attendanceHistoryDialog").open)$("#attendanceHistoryDialog").showModal();
  };
  window.addEventListener("afterprint",finish);
  try{window.print();}catch(error){finish();toast("Printing could not open. Please try again.");}
}
function setupAttendanceDays(){
  $("#saveAttendanceHistory").onchange=()=>{if(!requireEditingLock()){renderAttendanceControls();return;}data.saveAttendanceHistory=$("#saveAttendanceHistory").checked;toastSaveResult(save(),data.saveAttendanceHistory?"Attendance history is on.":"Attendance history is off. Saved records were kept.");};
  $("#startTodayBtn").onclick=()=>ensureAttendanceDay(true);
  $("#startNewDay").onclick=startNewAttendanceDay;
  const keep=()=>{acknowledgedAttendanceDay=localAttendanceDate();$("#newDayDialog").close();};
  $("#keepCurrentDay").onclick=keep;
  $("#newDayDialog").addEventListener("cancel",()=>{acknowledgedAttendanceDay=localAttendanceDate();});
  $("#viewAttendanceHistory").onclick=()=>{renderSavedAttendance();$("#teacherDialog").close();$("#attendanceHistoryDialog").showModal();};
  $("#attendanceRecordList").onchange=showSavedAttendanceRecord;
  $("#printAttendanceRecord").onclick=printSavedAttendance;
  $("#closeAttendanceHistory").onclick=()=>{$("#attendanceHistoryDialog").close();$("#teacherDialog").showModal();};
  renderAttendanceControls();
  checkAttendanceDate();
  // Focus catches suspended tabs; the minute check catches an already-open board.
  setInterval(checkAttendanceDate,60000);
}

let editingFriendId=null;
let friendDialogReady=false;
let pasteListReady=false;

function setAutosaveState(saving=false){
  const pill=document.querySelector(".autosave-pill");
  const text=$("#autosaveText");
  if(!pill||!text)return;
  pill.classList.toggle("saving",saving);
  pill.classList.toggle("save-error",Boolean(storageError));
  text.textContent=storageError?"Not saved":!editingLockHeld?"Read only":saving?"Saving…":"Saved automatically";
}
function autosaveClassroom(){
  setAutosaveState(true);
  save();
}
function getThemeById(id){
  return themeCatalog.find(t=>t.id===id)||themeCatalog[0];
}
function renderCurrentTheme(){
  const t=getThemeById(data.selectedTheme);
  $("#currentThemeName").textContent=t.name;
  $("#currentThemeTag").textContent=t.tag;
  const art=$("#currentThemeArt");
  art.dataset.theme=t.id;
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

  roster.forEach((child,i)=>{
    const {name,id}=child;
    const card=document.createElement("div");
    card.className="friend-card";
    card.innerHTML=`
      <div class="friend-avatar">${esc(friendInitials(name))}</div>
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
    card.querySelector(".move-up").onclick=()=>moveFriend(id,-1);
    card.querySelector(".move-down").onclick=()=>moveFriend(id,1);
    card.querySelector(".edit").onclick=()=>openFriendDialog(id);
    card.querySelector(".delete").onclick=()=>removeFriend(id);
    g.appendChild(card);
  });
  renderEditingState();
}
function renderClassroom(){
  $("#className").value=data.className||"";
  renderCurrentTheme();
  renderFriends();
}
function openFriendDialog(id=null){
  if($("#friendDialog").open)return;
  const child=data.roster.find(child=>child.id===id);
  if(id!==null && !child)return;
  editingFriendId=id;
  friendDialogReady=true;
  const editing=Boolean(child);
  const name=child?child.name:"";
  $("#friendDialogEyebrow").textContent=editing?"Edit Friend":"Add a Friend";
  $("#friendDialogTitle").textContent=editing?"Update this friend":"Who's joining your classroom?";
  $("#saveFriend").textContent=editing?"Save Changes":"Add Friend";
  $("#friendName").value=name;
  updateFriendPreview();
  $("#friendDialog").showModal();
  setTimeout(()=>{if($("#friendDialog").open)$("#friendName").focus();},30);
}
function updateFriendPreview(){
  const name=$("#friendName").value.trim();
  $("#friendPreviewName").textContent=name||"Friend";
  $("#friendPreviewAvatar").textContent=name?friendInitials(name):"♡";
}
function saveFriendFromDialog(){
  if(!requireEditingLock())return false;
  if(!friendDialogReady || !$("#friendDialog").open)return false;
  const name=$("#friendName").value.trim();
  if(!name){toast("Enter a name first.");return false}
  const editing=editingFriendId!==null;
  if(!editing && data.roster.length>=30){toast("This classroom already has 30 friends.");return false}
  const child=data.roster.find(child=>child.id===editingFriendId);
  if(editing && !child){toast("This friend is no longer in the classroom.");return false}
  if(child)child.name=name;
  else{
    const id=newChildId();data.roster.push({id,name});data.undoActions.push({type:"add",ids:[id]});
  }
  friendDialogReady=false;
  const saved=save();renderFriends();
  toastSaveResult(saved,editing?"Friend updated.":"Friend added.");
  return true;
}
function removeFriend(id){
  if(!requireEditingLock())return false;
  const child=data.roster.find(child=>child.id===id);
  if(!child || !confirm(`Remove ${child.name} from this classroom?`))return;
  data.undoActions.push({type:"remove",child:JSON.parse(JSON.stringify(child)),index:data.roster.indexOf(child),presentIndex:data.present.indexOf(id),historyIndex:data.history.indexOf(id)});
  data.roster=data.roster.filter(child=>child.id!==id);
  data.present=data.present.filter(value=>value!==id);
  data.history=data.history.filter(value=>value!==id);
  const saved=save();renderFriends();toastSaveResult(saved,child.name+" removed.");
}
function moveFriend(id,delta){
  if(!requireEditingLock())return false;
  const index=data.roster.findIndex(child=>child.id===id);
  const next=index+delta;
  if(index<0 || next<0 || next>=data.roster.length)return;
  [data.roster[index],data.roster[next]]=[data.roster[next],data.roster[index]];
  save();renderFriends();
}

function readPastedNames(){
  // Never split on commas or merge matching names: each line is one child.
  const names=$("#pastedNames").value.split(/\r\n|\r|\n/).map(name=>name.trim()).filter(Boolean);
  const matchKey=name=>name.normalize("NFC").toLocaleLowerCase();
  const existing=new Set(data.roster.map(child=>matchKey(child.name.trim())));
  const counts=new Map();
  names.forEach(name=>{const key=matchKey(name);counts.set(key,(counts.get(key)||0)+1);});
  const entries=names.map(name=>({name,inClass:existing.has(matchKey(name)),repeated:counts.get(matchKey(name))>1,tooLong:name.length>40}));
  const duplicates=entries.some(entry=>entry.inClass||entry.repeated);
  const remaining=Math.max(0,30-data.roster.length);
  let error="";
  if(names.length>remaining)error=`There is room for ${remaining} more friend${remaining===1?"":"s"}. Remove ${names.length-remaining} name${names.length-remaining===1?"":"s"} from the list before adding. No names have been added.`;
  else if(entries.some(entry=>entry.tooLong))error="Shorten the marked names to 40 characters or fewer before adding. No names have been added.";
  return {entries,duplicates,error};
}
function updatePasteListPreview(){
  const preview=readPastedNames(),count=preview.entries.length;
  const list=$("#pasteListPreview");list.replaceChildren();
  preview.entries.forEach(entry=>{
    const item=document.createElement("li"),name=document.createElement("span");
    name.textContent=entry.name;item.appendChild(name);
    const notes=[];
    if(entry.tooLong)notes.push("Over 40 characters");
    if(entry.inClass)notes.push("Name already in class");
    if(entry.repeated)notes.push("Name repeated in this list");
    if(notes.length){const note=document.createElement("small");note.textContent=notes.join(" · ");item.appendChild(note);}
    list.appendChild(item);
  });
  $("#pasteListCount").textContent=count?`${count} friend${count===1?"":"s"} to add · ${data.roster.length+count} of 30 in class after adding`:"No names to add yet";
  $("#pasteListError").textContent=preview.error;
  $("#pasteListError").hidden=!preview.error;
  $("#pastedNames").setAttribute("aria-invalid",String(Boolean(preview.error)));
  $("#pasteListDuplicateReview").hidden=!preview.duplicates;
  $("#savePasteList").textContent=count?`Add ${count} friend${count===1?"":"s"} to class`:"Add to class";
  $("#savePasteList").disabled=!count||Boolean(preview.error)||(preview.duplicates&&!$("#confirmDuplicateNames").checked);
  return preview;
}
function openPasteListDialog(){
  if($("#pasteListDialog").open)return;
  pasteListReady=true;
  $("#pastedNames").value="";
  $("#confirmDuplicateNames").checked=false;
  updatePasteListPreview();
  $("#pasteListDialog").showModal();
  $("#pastedNames").focus();
}
function savePastedNames(){
  if(!requireEditingLock())return false;
  if(!pasteListReady||!$("#pasteListDialog").open)return false;
  // Revalidate the current roster and current text at submission time.
  const preview=updatePasteListPreview();
  if($("#savePasteList").disabled)return false;
  pasteListReady=false;
  const addedIds=[];
  preview.entries.forEach(({name})=>{const id=newChildId();data.roster.push({id,name});addedIds.push(id);});
  data.undoActions.push({type:"add",ids:addedIds});
  const saved=save();renderFriends();
  toast(saved?`${preview.entries.length} friend${preview.entries.length===1?"":"s"} added.`:"Friends added only in this session. Not saved; keep this tab open.");
  return true;
}


const FALL_LEAVES_CONFIG={"fallTreeLayouts":{"10":[{"x":14,"y":18,"r":-4},{"x":38,"y":18,"r":3},{"x":62,"y":18,"r":1},{"x":86,"y":18,"r":-1},{"x":18,"y":48.9,"r":-3},{"x":49,"y":42.4,"r":4},{"x":67.1,"y":53.2,"r":2},{"x":86,"y":50,"r":0},{"x":32.7,"y":58.2,"r":-2},{"x":51.7,"y":70.5,"r":-4}],"15":[{"x":14,"y":18,"r":-4},{"x":32,"y":18,"r":3},{"x":50,"y":18,"r":1},{"x":68,"y":18,"r":-1},{"x":83.8,"y":23.6,"r":-3},{"x":14,"y":50,"r":4},{"x":28.1,"y":43.4,"r":2},{"x":46.3,"y":40.4,"r":0},{"x":63,"y":41.4,"r":-2},{"x":86,"y":50,"r":-4},{"x":14,"y":82,"r":3},{"x":37.7,"y":64.5,"r":1},{"x":52.9,"y":66.7,"r":-1},{"x":70.5,"y":63.3,"r":-3},{"x":86,"y":82,"r":4}],"20":[{"x":11.5,"y":12.9,"r":-4},{"x":32,"y":18,"r":3},{"x":46.7,"y":10.9,"r":1},{"x":60.6,"y":16.1,"r":-1},{"x":86,"y":18,"r":-3},{"x":16.3,"y":33.6,"r":4},{"x":32,"y":39.3,"r":2},{"x":45.6,"y":32.2,"r":0},{"x":67.7,"y":39.2,"r":-2},{"x":86,"y":39.3,"r":-4},{"x":14.2,"y":55.3,"r":3},{"x":28.5,"y":61.7,"r":1},{"x":42.3,"y":58,"r":-1},{"x":68.7,"y":64.1,"r":-3},{"x":86,"y":60.7,"r":4},{"x":14,"y":82,"r":2},{"x":53.6,"y":48.6,"r":0},{"x":55.7,"y":70.4,"r":-2},{"x":73.9,"y":18.4,"r":-4},{"x":86,"y":82,"r":3}],"25":[{"x":11.4,"y":12.9,"r":-4},{"x":27.8,"y":12.2,"r":3},{"x":46.4,"y":10.9,"r":1},{"x":64.4,"y":10.4,"r":-1},{"x":86,"y":18,"r":-3},{"x":17.7,"y":29.6,"r":4},{"x":36,"y":23.5,"r":2},{"x":53.6,"y":28.5,"r":0},{"x":73.3,"y":24.1,"r":-2},{"x":86,"y":34,"r":-4},{"x":7.8,"y":48.8,"r":3},{"x":28.8,"y":40.3,"r":1},{"x":56,"y":49.9,"r":-1},{"x":68.7,"y":43.8,"r":-3},{"x":86,"y":50,"r":4},{"x":19.3,"y":52.4,"r":2},{"x":31.5,"y":59.2,"r":0},{"x":45.9,"y":59.9,"r":-2},{"x":75.6,"y":60.6,"r":-4},{"x":86,"y":66,"r":3},{"x":14,"y":82,"r":1},{"x":41.3,"y":42.5,"r":-1},{"x":56.2,"y":67.7,"r":-3},{"x":66,"y":71.3,"r":4},{"x":86,"y":82,"r":2}],"30":[{"x":9.3,"y":12.6,"r":-4},{"x":28.4,"y":18,"r":3},{"x":41.7,"y":11.6,"r":1},{"x":58.9,"y":26.7,"r":-1},{"x":74.2,"y":13.2,"r":-3},{"x":86,"y":18,"r":4},{"x":7.3,"y":33.6,"r":2},{"x":28.4,"y":34,"r":0},{"x":44.6,"y":29.2,"r":-2},{"x":51.1,"y":13.2,"r":-4},{"x":63.2,"y":9.3,"r":3},{"x":86,"y":34,"r":1},{"x":17.5,"y":34.9,"r":-1},{"x":24.5,"y":49.6,"r":-3},{"x":36,"y":47.2,"r":4},{"x":61.3,"y":48.6,"r":2},{"x":70,"y":31.8,"r":0},{"x":86,"y":50,"r":-2},{"x":17.4,"y":66.3,"r":-4},{"x":28.4,"y":66,"r":3},{"x":47.1,"y":54.2,"r":1},{"x":60.9,"y":66.9,"r":-1},{"x":74.6,"y":48.5,"r":-3},{"x":86,"y":66,"r":4},{"x":8.5,"y":53.1,"r":2},{"x":28.4,"y":82,"r":0},{"x":39.2,"y":68.7,"r":-2},{"x":50.5,"y":77,"r":-4},{"x":73.5,"y":67.1,"r":3},{"x":86,"y":82,"r":1}]},"fallTreeScales":{"10":1,"15":1.1,"20":1.1,"25":1.25,"30":1.35},"fallPileLayouts":{"10":[{"x":17,"y":38.5,"r":-5},{"x":34.4,"y":52.6,"r":2},{"x":52.8,"y":45.8,"r":-2},{"x":67.5,"y":48.2,"r":5},{"x":14,"y":78.1,"r":1},{"x":26,"y":71.5,"r":-3},{"x":42.9,"y":75,"r":4},{"x":58,"y":71.5,"r":0},{"x":73.4,"y":82,"r":-4},{"x":82.9,"y":65.7,"r":3}],"15":[{"x":16,"y":32.5,"r":-5},{"x":36.5,"y":47.3,"r":2},{"x":47.6,"y":40.4,"r":-2},{"x":61.1,"y":42.7,"r":5},{"x":84,"y":32.5,"r":1},{"x":18,"y":69,"r":-3},{"x":37.5,"y":66.8,"r":4},{"x":50,"y":55.5,"r":0},{"x":70,"y":58.5,"r":-4},{"x":84.4,"y":58,"r":3},{"x":7,"y":76.5,"r":-1},{"x":28.5,"y":79.5,"r":-5},{"x":55.4,"y":77.2,"r":2},{"x":71.5,"y":79.5,"r":-2},{"x":89.9,"y":86.3,"r":5}],"20":[{"x":16,"y":32.5,"r":-5},{"x":60,"y":72.8,"r":2},{"x":43.8,"y":41.2,"r":-2},{"x":58.4,"y":39.5,"r":5},{"x":71.6,"y":45.4,"r":1},{"x":84,"y":35.5,"r":-3},{"x":18.7,"y":77,"r":4},{"x":23.3,"y":58.5,"r":0},{"x":36.7,"y":55.5,"r":-4},{"x":50,"y":58.5,"r":3},{"x":63.3,"y":55.5,"r":-1},{"x":76.7,"y":58.5,"r":-5},{"x":88.9,"y":62.2,"r":2},{"x":8.5,"y":81.6,"r":-2},{"x":30.2,"y":85,"r":5},{"x":42.8,"y":89.5,"r":1},{"x":50,"y":79.5,"r":-3},{"x":61.5,"y":88.8,"r":4},{"x":76.4,"y":88.7,"r":0},{"x":89.8,"y":88.4,"r":-4}],"25":[{"x":16,"y":32.5,"r":-5},{"x":36.1,"y":46.6,"r":2},{"x":47.5,"y":50,"r":-2},{"x":52.8,"y":39,"r":5},{"x":61.1,"y":44.3,"r":1},{"x":61.1,"y":79.5,"r":-3},{"x":84,"y":32.5,"r":4},{"x":16.5,"y":75,"r":0},{"x":20,"y":58.5,"r":-4},{"x":30,"y":55.5,"r":3},{"x":40,"y":58.5,"r":-1},{"x":48.4,"y":63.7,"r":-5},{"x":60,"y":58.5,"r":2},{"x":70,"y":55.5,"r":-2},{"x":74.9,"y":68.9,"r":5},{"x":83.8,"y":56,"r":1},{"x":8.6,"y":86.2,"r":-3},{"x":23.6,"y":89.2,"r":4},{"x":31.9,"y":73.1,"r":0},{"x":39.3,"y":79.5,"r":-4},{"x":50,"y":76.5,"r":3},{"x":52,"y":92,"r":-1},{"x":71,"y":88.5,"r":-5},{"x":82.3,"y":79.5,"r":2},{"x":87.5,"y":93,"r":-2}],"30":[{"x":16,"y":32.5,"r":-5},{"x":27.4,"y":50,"r":2},{"x":36.4,"y":42.7,"r":-2},{"x":45.9,"y":42.5,"r":5},{"x":55.9,"y":39.3,"r":1},{"x":64.1,"y":43.4,"r":-3},{"x":72.5,"y":43.4,"r":4},{"x":84,"y":35.5,"r":0},{"x":9,"y":76.5,"r":-4},{"x":18.7,"y":64.7,"r":3},{"x":26.4,"y":61.4,"r":-1},{"x":34,"y":58.5,"r":-5},{"x":42,"y":55.5,"r":2},{"x":50.2,"y":65,"r":-2},{"x":58,"y":55.5,"r":5},{"x":66,"y":58.5,"r":1},{"x":73.3,"y":61.9,"r":-3},{"x":82,"y":58.5,"r":4},{"x":70.9,"y":76.3,"r":0},{"x":40.5,"y":92.4,"r":-4},{"x":18.3,"y":87.7,"r":3},{"x":24.2,"y":76.5,"r":-1},{"x":32.8,"y":79.5,"r":-5},{"x":41.4,"y":76.5,"r":2},{"x":50.9,"y":90.6,"r":-2},{"x":58.6,"y":76.5,"r":5},{"x":65.2,"y":89.9,"r":1},{"x":75.2,"y":90.3,"r":-3},{"x":80.7,"y":79.3,"r":4},{"x":90.3,"y":86.7,"r":0}]},"fallPileScales":{"10":1,"15":1,"20":1,"25":1.1,"30":1.1},"nameOffset":{"x":0,"y":-10},"bucketRule":"10 / 15 / 20 / 25 / 30 based on total roster size, not current attendance counts","behavior":{"stableSlots":true,"treeNames":true,"pileNames":false,"moveOnlyTappedChild":true},"assets":{"background":"assets/attendance-falling-leaves.png","waitingLeaf":"assets/fall-tree-leaf.png","hereLeaf":"assets/fall-pile-leaf.png"},"fallTreeSizes":{"10":[132,150],"15":[112,127],"20":[96,109],"25":[84,95],"30":[74,84]},"fallPileSizes":{"10":[126,126],"15":[110,110],"20":[96,96],"25":[86,86],"30":[78,78]}};

function fallLeavesBucket(n){
  return n<=10?10:n<=15?15:n<=20?20:n<=25?25:30;
}
function fallLeavesStudentAt(i){return data.roster[i];}
function fallLeavesSizes(kind,b){
  const key=kind==="tree"?"fallTreeSizes":"fallPileSizes";
  return FALL_LEAVES_CONFIG[key][String(b)];
}
function renderFallLeavesAttendance(){
  const total=data.roster.length;
  const bucket=fallLeavesBucket(total);
  const zone=$("#fallLeavesZone");
  zone.innerHTML='<div class="fall-la-tree-zone"></div><div class="fall-la-pile-zone"></div>';
  const treeZone=zone.querySelector(".fall-la-tree-zone"),pileZone=zone.querySelector(".fall-la-pile-zone");
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
    const here=data.present.includes(student.id);
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

    el.innerHTML='<span class="fall-la-photo"></span><strong class="fall-la-name"></strong>';
    const photo=document.createElement("span");
    photo.className="fall-la-initial";
    photo.textContent=(student.name||"?")[0].toUpperCase();
    // Preserve supported saved images without interpreting an attribute as HTML.
    if(typeof student.photo==="string" && /^(https?:|data:image\/(png|jpeg|webp);base64,)/i.test(student.photo)){
      const img=document.createElement("img");img.src=student.photo;img.alt="";
      el.querySelector(".fall-la-photo").appendChild(img);
    }else el.querySelector(".fall-la-photo").appendChild(photo);
    el.querySelector(".fall-la-name").textContent=student.name;
    el.setAttribute("aria-pressed",String(here));

    el.addEventListener("click",()=>{
      setChildPresent(student.id,!data.present.includes(student.id));
      renderFallLeavesAttendance();
    });
    (here?pileZone:treeZone).appendChild(el);
  });
  renderEditingState();
}
function openAttendance(){
  ensureAttendanceDay();
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
  data.roster.forEach((child,i)=>{
    const {name,id}=child;
    const b=document.createElement("button");
    b.className="student"+(data.present.includes(id)?" present":"");
    b.setAttribute("aria-pressed",String(data.present.includes(id)));
    b.innerHTML=`<div class="avatar">${esc(initials(name))}</div><div class="name">${esc(name)}</div>`;
    b.onclick=()=>{
      if(data.present.includes(id))return;
      const saved=setChildPresent(id,true);
      if(saved===null)return;
      renderAttendance();toastSaveResult(saved,name+" is here ♡");
    };
    g.appendChild(b);
  });
  renderEditingState();
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
      if(!requireEditingLock())return;
      if(isOwned){
        data.selectedTheme=t.id; const saved=save(); renderThemeGrid(); if($("#currentThemeName"))renderCurrentTheme(); toastSaveResult(saved,t.name+" selected.");
      }else{
        toast(t.name+" is locked.");
      }
    };
    g.appendChild(b);
  });
  renderEditingState();
}

$("#takeHotspot").onclick=()=>openAttendance();
$("#classHotspot").onclick=()=>{show("classroom");renderClassroom()};

$("#themesBack").onclick=()=>show("classroom");
$("#themeSearch").oninput=renderThemeGrid;
$("#clearThemeSearch").onclick=()=>{$("#themeSearch").value="";renderThemeGrid()};

$("#addPurchasedTheme").onclick=()=>{if(requireEditingLock())$("#themeFile").click();};
$("#themeFile").onchange=async e=>{
  const f=e.target.files[0]; if(!f)return;
  if(!requireEditingLock()){e.target.value="";return;}
  const editingGeneration=editingLockGeneration;
  try{
    const pack=JSON.parse(await f.text());
    if(editingGeneration!==editingLockGeneration || !requireEditingLock()){e.target.value="";return;}
    const ids=Array.isArray(pack.themeIds)?pack.themeIds:[pack.themeId];
    const valid=ids.filter(id=>themeCatalog.some(t=>t.id===id));
    if(!valid.length) throw new Error();
    data.ownedThemes=[...new Set([...(data.ownedThemes||[]),...valid])];
    const saved=save(); renderThemeGrid(); toastSaveResult(saved,valid.length+" theme"+(valid.length>1?"s":"")+" added.");
  }catch(err){toast("That theme pack could not be added.")}
  e.target.value="";
};

$("#fallLeavesClose").onclick=()=>show("dashboard");
$("#fallLeavesTeacher").onclick=()=>$("#teacherDialog").showModal();
$("#homeBtn").onclick=()=>show("dashboard");
$("#teacherBtn").onclick=()=>$("#teacherDialog").showModal();
$("#closeTeacher").onclick=()=>$("#teacherDialog").close();
$("#undoBtn").onclick=undoAttendance;
$("#resetBtn").onclick=resetAttendance;
$("#fullscreenBtn").onclick=async()=>{
  const exiting=Boolean(document.fullscreenElement);
  const target=exiting?document:document.documentElement;
  const change=exiting?document.exitFullscreen:document.documentElement.requestFullscreen;
  if(typeof change!=="function" || (!exiting && document.fullscreenEnabled===false)){
    toast("Full screen isn't available in this browser.");
    return;
  }
  // Close the dialog first: a native fullscreen element can otherwise cover an
  // already-open modal in WebKit's top layer, leaving its Done button hidden.
  $("#teacherDialog").close();
  try{
    await change.call(target);
  }catch(error){
    toast("Full screen couldn't be changed. Try your browser's full-screen control.");
  }
};


$("#themesHome").onclick=()=>show("dashboard");
$("#themesAttendance").onclick=()=>openAttendance();
$("#themesTeacher").onclick=()=>$("#teacherDialog").showModal();


$("#className").addEventListener("input",e=>{
  if(!requireEditingLock()){e.target.value=data.className;return;}
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
$("#pasteListBtn").onclick=openPasteListDialog;
$("#cancelPasteList").onclick=()=>{pasteListReady=false;$("#pasteListDialog").close();};
$("#pasteListDialog").addEventListener("cancel",()=>{pasteListReady=false;});
$("#pasteListDialog").addEventListener("close",()=>{
  if(!$("#pasteListDialog").open){pasteListReady=false;$("#pastedNames").value="";$("#confirmDuplicateNames").checked=false;}
});
$("#pastedNames").addEventListener("input",()=>{$("#confirmDuplicateNames").checked=false;updatePasteListPreview();});
$("#confirmDuplicateNames").addEventListener("change",updatePasteListPreview);
$("#pasteListForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(savePastedNames())$("#pasteListDialog").close();
});
$("#cancelFriend").onclick=()=>{friendDialogReady=false;$("#friendDialog").close();};
$("#friendDialog").addEventListener("close",()=>{friendDialogReady=false;});
$("#friendName").addEventListener("input",updateFriendPreview);
$("#friendForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(saveFriendFromDialog())$("#friendDialog").close();
});

$("#retrySave").onclick=retrySave;
window.addEventListener("storage",event=>{
  if(event.key===STORAGE_KEY || event.key===null)checkForExternalChanges();
});
window.addEventListener("focus",()=>{checkForExternalChanges();checkAttendanceDate();});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){checkForExternalChanges();checkAttendanceDate();}
});
load();
setupAttendanceDays();
requestEditingLock();
renderThemeFilters();

// Keep named navigation available while the approved artwork loads or if it fails.
const dashboardArt=new Image();
dashboardArt.onload=()=>document.querySelector(".dashboard-stage").classList.add("art-ready");
dashboardArt.onerror=()=>document.querySelector(".dashboard-stage").classList.remove("art-ready");
dashboardArt.src="assets/home-two-actions.png";
