/* Birdbird – lagring på profilen din.
   I Claude: privat under data/users/<din id>/ i artefaktens database (følger Claude-kontoen din, synlig bare for deg).
   Ellers: i denne nettleseren (localStorage), med eksport og import som fil. */
(function(G){
'use strict';
let db=null, uid=null, mode='local';
const LK='naeroson-store-';
const ready=(async()=>{
  try{ if(G.claude&&G.claude.use){ const [d,u]=await Promise.all([G.claude.use('db'),G.claude.use('user')]); if(d&&u){ const id=await u.id(); if(id){ db=d; uid=id; mode='account'; } } } }catch(e){ db=null; }
  return mode;
})();
const col=()=>db.collection('data/users/'+uid);
function lget(kind){ try{ return JSON.parse(localStorage.getItem(LK+kind)||'{}')||{}; }catch(e){ return {}; } }
function lset(kind,o){ try{ localStorage.setItem(LK+kind,JSON.stringify(o)); return true; }catch(e){ return false; } }
async function list(kind){ await ready;
  const loc=lget(kind);
  if(mode==='account'){ try{ const qs=await col().where('kind','==',kind).limit(1000).get(); const out={}; qs.docs.forEach(d=>{ const v=d.data(); if(v&&v.body) try{ const o=JSON.parse(v.body); if(o&&o.id) out[o.id]=o; }catch(e){} });
      // nyere lokale kopier (skrevet uten nett) vinner
      for(const k in loc){ if(!out[k]||(loc[k].updated||0)>(out[k].updated||0)) out[k]=loc[k]; }
      return Object.values(out).sort((a,b)=>(b.updated||0)-(a.updated||0)); }catch(e){} }
  return Object.values(loc).sort((a,b)=>(b.updated||0)-(a.updated||0));
}
async function put(kind,obj){ await ready; obj.updated=Date.now();
  const loc=lget(kind); loc[obj.id]=obj; lset(kind,loc);
  if(mode==='account'){ try{ const body=JSON.stringify(obj); if(new Blob([body]).size>240000) throw {code:'too_big'}; await col().doc(kind+'-'+obj.id).set({kind,body,updated:obj.updated}); return 'account'; }catch(e){ if(e&&(e.code==='revoked'||e.code==='not_granted')) mode='local'; return 'local'; } }
  return 'local';
}
async function del(kind,id){ await ready; const loc=lget(kind); delete loc[id]; lset(kind,loc); if(mode==='account'){ try{ await col().doc(kind+'-'+id).delete(); }catch(e){} } }
G.NSTORE={ready,list,put,del,get mode(){ return mode; }};
})(window);
