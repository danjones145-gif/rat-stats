/* Small document store on top of Supabase: one table "docs" (coll, id, data jsonb).
   Gives the app the same doc/collection/onSnapshot/set/delete/batch calls it uses elsewhere. */
(function(){
  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function merge(a,b){
    Object.keys(b).forEach(function(k){
      var v=b[k];
      if(v&&typeof v==='object'&&!Array.isArray(v)){ a[k]=(a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))?a[k]:{}; merge(a[k],v); }
      else a[k]=v;
    });
    return a;
  }
  function rid(){ return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

  window.makeStore=function(cfg){
    var sb=window.supabase.createClient(cfg.url,cfg.anonKey);
    var cache={}, loaded={}, listeners={}, errHandlers={};
    function coll(c){ return cache[c]||(cache[c]={}); }
    function notify(c){ (listeners[c]||[]).slice().forEach(function(f){ f(); }); }
    function fetchColl(c){
      return sb.from('docs').select('id,data').eq('coll',c).then(function(r){
        if(r.error) throw r.error;
        var m={}; (r.data||[]).forEach(function(row){ m[row.id]=row.data; });
        cache[c]=m; loaded[c]=true; notify(c);
      });
    }
    var channel=null;
    function ensureChannel(){
      if(channel) return;
      channel=sb.channel('rats-docs').on('postgres_changes',{event:'*',schema:'public',table:'docs'},function(p){
        var row=(p.eventType==='DELETE')?p.old:p.new; if(!row||!row.coll) return;
        if(p.eventType==='DELETE') delete coll(row.coll)[row.id]; else coll(row.coll)[row.id]=row.data;
        loaded[row.coll]=loaded[row.coll]||false; if(loaded[row.coll]) notify(row.coll);
      }).subscribe();
      setInterval(function(){ Object.keys(listeners).forEach(function(c){ fetchColl(c).catch(function(){}); }); },20000);
    }
    function listen(c,fn,onErr){
      (listeners[c]=listeners[c]||[]).push(fn);
      ensureChannel();
      if(loaded[c]) setTimeout(fn,0);
      if(onErr) (errHandlers[c]=errHandlers[c]||[]).push(onErr);
      if(!loaded[c]&&listeners[c].length===1) fetchColl(c).catch(function(e){ (errHandlers[c]||[]).forEach(function(h){ h(e); }); });
      return function(){ listeners[c]=(listeners[c]||[]).filter(function(x){ return x!==fn; }); };
    }
    function snapDoc(c,id){ var d=coll(c)[id]; return {id:id,exists:d!==undefined,data:function(){ return d; }}; }
    function split(path){ var i=path.indexOf('/'); return [path.slice(0,i),path.slice(i+1)]; }
    function writeRow(c,id,nd){
      return sb.from('docs').upsert({coll:c,id:id,data:nd},{onConflict:'coll,id'}).then(function(r){ if(r.error) throw r.error; });
    }
    function docRef(c,id){
      return {
        id:id,
        set:async function(d,o){
          var nd=clone(d);
          if(o&&o.merge){ if(!loaded[c]) await fetchColl(c); nd=merge(clone(coll(c)[id]||{}),nd); }
          await writeRow(c,id,nd); coll(c)[id]=nd; loaded[c]=true; notify(c);
        },
        delete:async function(){
          var r=await sb.from('docs').delete().eq('coll',c).eq('id',id); if(r.error) throw r.error;
          delete coll(c)[id]; notify(c);
        },
        onSnapshot:function(next,err){ return listen(c,function(){ next(snapDoc(c,id)); },err); }
      };
    }
    return {
      doc:function(path){ var p=split(path); return docRef(p[0],p[1]); },
      collection:function(c){
        return {
          doc:function(id){ return docRef(c,id||rid()); },
          onSnapshot:function(next,err){
            return listen(c,function(){ next({docs:Object.keys(coll(c)).map(function(id){ return snapDoc(c,id); })}); },err);
          }
        };
      },
      batch:function(){
        var ops=[];
        return {
          set:function(ref,d){ ops.push([ref,d]); },
          commit:async function(){ for(var i=0;i<ops.length;i++){ await ops[i][0].set(ops[i][1]); } }
        };
      }
    };
  };
})();
