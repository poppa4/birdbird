/* Birdbird – lagring på profilen din: i denne nettleseren (localStorage), med eksport og import som fil, og synk med
   Birdbird-kontoen (account.js) når du er logget inn. mode er alltid 'local'. */
(function(G){
'use strict';
const mode='local';
const LK='naeroson-store-';
const ready=Promise.resolve(mode);
function lget(kind){ try{ return JSON.parse(localStorage.getItem(LK+kind)||'{}')||{}; }catch(e){ return {}; } }
function lset(kind,o){ try{ localStorage.setItem(LK+kind,JSON.stringify(o)); return true; }catch(e){ return false; } }
async function list(kind){ await ready;
  return Object.values(lget(kind)).sort((a,b)=>(b.updated||0)-(a.updated||0));
}
async function put(kind,obj){ await ready; obj.updated=Date.now();
  const loc=lget(kind); loc[obj.id]=obj; lset(kind,loc);
  return 'local';
}
async function del(kind,id){ await ready; const loc=lget(kind); delete loc[id]; lset(kind,loc); }
G.NSTORE={ready,list,put,del,get mode(){ return mode; }};
})(window);
