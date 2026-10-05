// Deterministic Web Locks model for DOM/state tests only. Real browser tests
// must use the browser's own lock manager. Each old fixture gets an isolated
// manager because it models one loaded session or a non-cooperating legacy
// writer; sharing a mock store alone deliberately does not claim tab safety.
function createLockManager({deferred=false}={}){
 const held=new Set(),pending=[];
 function run(name,options,callback,resolve,reject){
  if(options.mode!=='exclusive'||options.ifAvailable!==true||options.steal)throw Error('Unexpected lock options');
  const acquired=!held.has(name);if(acquired)held.add(name);
  let result;try{result=callback(acquired?{name,mode:'exclusive'}:null);}catch(error){if(acquired)held.delete(name);reject(error);return;}
  Promise.resolve(result).then(value=>{if(acquired)held.delete(name);resolve(value);},error=>{if(acquired)held.delete(name);reject(error);});
 }
 return {request(name,options,callback){return new Promise((resolve,reject)=>{const attempt=()=>run(name,options,callback,resolve,reject);if(deferred)pending.push(attempt);else attempt();});},flush(){pending.splice(0).forEach(attempt=>attempt());},held};
}
function installSingleDocumentLocks(window,manager=createLockManager()){
 Object.defineProperty(window.navigator,'locks',{configurable:true,value:manager});return manager;
}
module.exports={createLockManager,installSingleDocumentLocks};
