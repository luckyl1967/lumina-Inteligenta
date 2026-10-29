import {initializeApp, deleteApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getDatabase, ref, onValue, update, runTransaction, goOffline} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';
const $=id=>document.getElementById(id), KEY='lumina.settings.v1';
let saved=null, app=null, auth=null, db=null, rooms=[], selected='', connected=false, user=null, ready=false, busy=false, offset=0, unsubs=[], authUnsub=null, generation=0;
function notify(text,error=false){$('message').textContent=text;$('message').className=error?'error':'';$('message').style.display='block';clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('message').style.display='none',9000);}
function page(name){$('home').hidden=name!=='home';$('settings').hidden=name!=='settings';}
$('homeNav').onclick=()=>page('home');$('settingsNav').onclick=()=>page('settings');$('emptyAction').onclick=()=>page('settings');
function validKey(s){return typeof s==='string'&&/^[a-z0-9_-]{1,64}$/.test(s);}
function slug(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,64);}
function parseConfig(text){
 const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start<0||end<start)throw Error('Lipsește obiectul firebaseConfig.');
 let body=text.slice(start,end+1), out;
 try{out=JSON.parse(body);}catch{
  out={};const re=/(?:["']?(apiKey|authDomain|databaseURL|projectId|storageBucket|messagingSenderId|appId|measurementId)["']?)\s*:\s*(["'])(.*?)\2/g;
  for(const m of body.matchAll(re))out[m[1]]=m[3];
 }
 const clean={};for(const k of ['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId','measurementId'])if(typeof out[k]==='string')clean[k]=out[k].trim();
 for(const k of ['apiKey','authDomain','databaseURL','projectId'])if(!clean[k])throw Error('Lipsește câmpul '+k);
 const url=new URL(clean.databaseURL);if(url.protocol!=='https:'||!/(\.firebaseio\.com|\.firebasedatabase\.app)$/.test(url.hostname))throw Error('databaseURL trebuie să fie URL-ul HTTPS al Firebase RTDB.');
 if(!/^[a-z0-9.-]+\.firebaseapp\.com$/.test(clean.authDomain))throw Error('authDomain invalid.');
 return clean;
}
function stopListeners(){unsubs.forEach(fn=>fn());unsubs=[];rooms=[];ready=false;connected=false;offset=0;}
function current(){return rooms.find(x=>x.id===selected);}
function presence(room){const t=room?.last_seen;if(typeof t!=='number'||t<=0)return 'unknown';const age=Date.now()+offset-t;return age>=-15000&&age<=90000?'online':'offline';}
function canControl(room){const p=presence(room);return !!room&&!!user&&connected&&ready&&!busy&&(p==='online'||(p==='unknown'&&saved?.allowUnknown));}
function render(){
 $('clientLabel').textContent=saved?.client||'Configurează instalația';$('cloudDot').className='dot '+(connected?'online':'offline');
 $('cloudText').textContent=!app?'Firebase neconfigurat':connected?'Firebase conectat':'Firebase deconectat / conectare';$('userText').textContent=user?.email||'Neautentificat';
 $('loginForm').hidden=!!user;$('account').hidden=!user;$('accountEmail').textContent=user?.email||'';$('addRoom').disabled=!user||!connected||!ready||busy;
 const room=current();$('roomCard').hidden=!room;$('empty').hidden=!!room;
 $('emptyText').textContent=!app?'Configurează Firebase în Setări.':!user?'Autentifică-te din Setări.':!ready?'Se încarcă camerele sau accesul nu este încă disponibil.':'Nu există camere. Adaugă prima cameră din Setări.';
 $('prev').hidden=$('next').hidden=rooms.length<2;
 if(room){const p=presence(room);$('roomName').textContent=room.nume||room.id;$('roomPosition').textContent=(rooms.findIndex(x=>x.id===selected)+1)+' / '+rooms.length;
 $('deviceDot').className='dot '+(p==='unknown'?'':p);$('deviceText').textContent=p==='online'?'Dispozitiv online':p==='offline'?'Dispozitiv offline':'Prezență necunoscută';
 $('lastSeen').textContent=typeof room.last_seen==='number'&&room.last_seen>0?'Ultima comunicare: '+new Date(room.last_seen).toLocaleString('ro-RO'):'ESP-ul nu a publicat încă last_seen.';
 $('deviceWarning').textContent=!connected?'Comenzile sunt dezactivate: Firebase deconectat.':p==='offline'?'Comenzile sunt dezactivate: dispozitivul nu a comunicat recent.':p==='unknown'?(saved.allowUnknown?'Mod compatibilitate: comenzile sunt permise, dar prezența nu este verificată.':'Activează last_seen în firmware sau modul compatibilitate din Setări.') :'';
 for(const [id,value] of [['relay',room.releu===true],['led',room.led_on===true]]){const b=$(id);b.textContent=value?'ON':'OFF';b.className='toggle'+(value?' on':'');b.setAttribute('aria-pressed',String(value));b.disabled=!canControl(room);}
 const level=Math.max(1,Math.min(5,Number(room.led_brightness)||1));$('levelText').textContent='Nivel '+level;
 [...$('levels').children].forEach((b,i)=>{b.className=i+1===level?'selected':'';b.disabled=!canControl(room);b.setAttribute('aria-pressed',String(i+1===level));});
 }
 renderList();
}
function renderList(){const box=$('roomList');box.replaceChildren();if(!rooms.length){box.textContent='Nicio cameră disponibilă.';return;}
 for(const room of rooms){const row=document.createElement('div');row.className='roomitem';const details=document.createElement('div'),name=document.createElement('strong'),id=document.createElement('small');name.textContent=room.nume||room.id;id.textContent='ID: '+room.id;details.append(name,id);const edit=document.createElement('button');edit.textContent='Redenumește';edit.disabled=!connected||!ready||busy;edit.onclick=()=>renameRoom(room);row.append(details,edit);box.append(row);}
}
async function renameRoom(room){const name=prompt('Nume afișat pentru '+room.id,room.nume||room.id)?.trim();if(!name)return;if(name.length>60)return notify('Maximum 60 de caractere.',true);if(!confirm('Redenumești camera în „'+name+'”? ID-ul rămâne '+room.id+'.'))return;try{await update(ref(db,saved.root+'/'+room.id),{nume:name});notify('Numele camerei a fost salvat.');}catch(e){notify(e.message,true);}}
async function switchProject(settings){const gen=++generation;stopListeners();if(authUnsub){authUnsub();authUnsub=null;}user=null;
 if(app){try{await signOut(auth);}catch{}goOffline(db);await deleteApp(app);}app=null;auth=null;db=null;saved=settings;
 app=initializeApp(settings.firebase,'lumina-'+gen);auth=getAuth(app);db=getDatabase(app);await setPersistence(auth,browserSessionPersistence);
 authUnsub=onAuthStateChanged(auth,u=>{if(gen!==generation)return;stopListeners();user=u;
 unsubs.push(onValue(ref(db,'.info/connected'),s=>{connected=s.val()===true;render();}));
 unsubs.push(onValue(ref(db,'.info/serverTimeOffset'),s=>{offset=Number(s.val())||0;}));
 if(u){unsubs.push(onValue(ref(db,settings.root),s=>{const data=s.val()||{};rooms=Object.entries(data).filter(([id,v])=>validKey(id)&&v&&typeof v==='object'&&!Array.isArray(v)).map(([id,v])=>({...v,id})).sort((a,b)=>(Number(a.ordine)||0)-(Number(b.ordine)||0)||(a.nume||a.id).localeCompare(b.nume||b.id,'ro'));if(!rooms.some(r=>r.id===selected))selected=rooms[0]?.id||'';ready=true;render();},e=>{ready=false;rooms=[];notify('Acces la camere refuzat: '+e.message,true);render();}));}render();});render();
}
$('configForm').onsubmit=async e=>{e.preventDefault();try{const root=$('root').value.trim();if(!validKey(root))throw Error('ROOT_NODE: numai litere mici, cifre, _ sau -, maximum 64.');const settings={client:$('client').value.trim(),root,firebase:parseConfig($('configText').value),allowUnknown:$('allowUnknown').checked};
 if(app&&!confirm('Schimbi/salvezi configurația? Sesiunea curentă va fi închisă.'))return;
 await switchProject(settings);localStorage.setItem(KEY,JSON.stringify(settings));notify('Configurație salvată. Autentifică-te pentru verificarea accesului la bază.');
 }catch(err){notify(err.message,true);}};
$('loginForm').onsubmit=async e=>{e.preventDefault();if(!auth)return notify('Configurează mai întâi Firebase.',true);const b=e.submitter;b.disabled=true;try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);$('password').value='';notify('Autentificare reușită.');page('home');}catch(err){notify('Autentificare eșuată: '+err.code,true);}finally{b.disabled=false;}};
$('logout').onclick=async()=>{if(auth)try{await signOut(auth);}catch(e){notify(e.message,true);}};
function navigate(n){if(!rooms.length)return;const index=rooms.findIndex(x=>x.id===selected);selected=rooms[(index+n+rooms.length)%rooms.length].id;render();}
$('prev').onclick=()=>navigate(-1);$('next').onclick=()=>navigate(1);
let touchStart=null;$('roomCard').addEventListener('touchstart',e=>{touchStart=e.touches[0].clientX;},{passive:true});$('roomCard').addEventListener('touchend',e=>{if(touchStart===null||e.target.closest('button'))return;const d=e.changedTouches[0].clientX-touchStart;if(Math.abs(d)>70)navigate(d<0?1:-1);touchStart=null;},{passive:true});
async function command(patch){const room=current();if(!canControl(room))return;const path=saved.root+'/'+room.id;busy=true;render();try{await update(ref(db,path),patch);notify('Comandă trimisă în Firebase. ESP-ul o va citi periodic.');}catch(e){notify('Comandă eșuată: '+e.message,true);}finally{busy=false;render();}}
$('relay').onclick=()=>command({releu:current()?.releu!==true});$('led').onclick=()=>command({led_on:current()?.led_on!==true});
for(let i=1;i<=5;i++){const b=document.createElement('button');b.textContent=i;b.setAttribute('aria-label','Luminozitate nivel '+i);b.onclick=()=>command({led_brightness:i});$('levels').append(b);}
$('addRoom').onclick=()=>{if(!ready||!connected||!user)return;$('newName').value='';$('newId').value='';$('roomDialog').showModal();};$('newName').oninput=()=>{$('newId').value=slug($('newName').value);};$('cancelRoom').onclick=()=>$('roomDialog').close();
$('roomForm').onsubmit=async e=>{e.preventDefault();if(!user||!connected||!ready)return notify('Conectează-te mai întâi.',true);const name=$('newName').value.trim(),id=$('newId').value.trim();if(!name||!validKey(id))return notify('Nume sau ID invalid.',true);const b=e.submitter;b.disabled=true;try{const order=rooms.reduce((m,r)=>Math.max(m,Number(r.ordine)||0),-1)+1;
 const result=await runTransaction(ref(db,saved.root+'/'+id),existing=>existing===null?{nume:name,ordine:order,releu:false,led_on:false,led_brightness:1}:undefined,{applyLocally:false});
 if(!result.committed)throw Error('ID-ul există deja. Datele existente NU au fost suprascrise.');selected=id;$('roomDialog').close();notify('Cameră creată. Configurează ESP-ul cu ROOM_ID "'+id+'".');render();
 }catch(err){notify(err.message,true);}finally{b.disabled=false;}};
setInterval(()=>{if(current())render();},5000);
try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);if(!validKey(s.root))throw Error('Configurație locală invalidă.');s.firebase=parseConfig(JSON.stringify(s.firebase));saved=s;$('client').value=s.client||'';$('root').value=s.root;$('configText').value=JSON.stringify(s.firebase,null,2);$('allowUnknown').checked=!!s.allowUnknown;await switchProject(s);}else{page('settings');}}catch(e){notify('Nu am încărcat configurația: '+e.message,true);page('settings');}render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(console.error);
