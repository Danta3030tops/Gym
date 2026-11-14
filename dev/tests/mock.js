window.supabase={createClient(url,key,opts){
 const prof=opts.auth.storageKey.replace('gym-auth-',''), uid='uid-'+prof, session={user:{id:uid,email:prof+'@x.com'}};
 const bc=new BroadcastChannel('mockrt');
 const db=()=>JSON.parse(localStorage.getItem('mock.db')||'{"gym_state":{},"gym_public":{}}'), put=d=>localStorage.setItem('mock.db',JSON.stringify(d));
 const from=t=>{const q={_eq:null,select(){return q},eq(c,v){q._eq=v;return q},async maybeSingle(){return {data:db()[t][q._eq]||null,error:null}},
   then(res){res({data:Object.values(db()[t]),error:null})},
   async upsert(row){const d=db();d[t][row.user_id]=row;put(d);setTimeout(()=>bc.postMessage({type:'pg',table:t,new:row}),150);return {error:null}}};return q};
 return {from,
  channel(){const hs=[];const ch={on(type,f,cb){hs.push({type,f,cb});return ch},subscribe(cb){bc.addEventListener('message',e=>{const m=e.data;for(const h of hs){if(m.type==='pg'&&h.type==='postgres_changes'&&h.f.table===m.table)h.cb({new:m.new});if(m.type==='bc'&&h.type==='broadcast'&&h.f.event===m.event)h.cb({payload:m.payload})}});setTimeout(()=>cb&&cb('SUBSCRIBED'),50);return ch},
   send(m){bc.postMessage({type:'bc',event:m.event,payload:m.payload});return Promise.resolve('ok')}};return ch},
  removeChannel(){},
  auth:{getSession:async()=>({data:{session}}),onAuthStateChange(){},signOut:async()=>({})},
  storage:{from:()=>({upload:async()=>({error:null}),download:async()=>({data:null,error:'x'}),remove:async()=>({})})}};
}};
