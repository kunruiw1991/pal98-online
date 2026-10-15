'use strict';
const JAPANESE=new URLSearchParams(location.search).get('lang')==='ja';
const ORIGINAL_HASH='2bc5970f8e2b6ddd0172e900b78d5234ed1919954cf00434a86ca18166a6f4bf';
const HASH=JAPANESE?ORIGINAL_HASH:'92e96a551a1b07cfb4b72852a2a23f52618e254f63a7b0aad5188a347cbfe66e';
const EDITION=JAPANESE?'日文原版':'中文汉化 · 同能网版';
const $=id=>document.getElementById(id);
let player,rom,running=false,ready=false,lastSave,batteryTimer;
const BATTERY_KEY='tenchi2-battery-'+HASH;
const dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(JAPANESE?'tenchi2-original':'tenchi2-chinese',1);request.onupgradeneeded=()=>request.result.createObjectStore('saves');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
dbPromise.catch(()=>{});
async function store(key,value){const database=await dbPromise;return new Promise((resolve,reject)=>{const tx=database.transaction('saves','readwrite');tx.objectStore('saves').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function read(key){const database=await dbPromise;return new Promise((resolve,reject)=>{const request=database.transaction('saves').objectStore('saves').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
const message=text=>{$('status').textContent=text;};
function release(){if(!player)return;for(let i=0;i<10;i++)player.nes.buttonUp(1,i);document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
function pause(){if(!running)return;player.stop();running=false;release();$('pause').textContent='继续';message('已暂停');}
function resume(){if(!ready||running)return;player.start();running=true;$('cover').hidden=true;$('cover').style.display='none';$('pause').textContent='暂停';message('游戏进行中 · '+EDITION);}
function snapshot(){return{format:'tenchi2-web-save',version:1,engine:'jsnes-2.1.0',romSha256:HASH,date:new Date().toISOString(),state:player.nes.toJSON()};}
function validate(data){if(!data||data.format!=='tenchi2-web-save'||data.version!==1||data.engine!=='jsnes-2.1.0'||data.romSha256!==HASH||!Array.isArray(data.state?.cpu?.mem)||data.state.cpu.mem.length!==65536||!data.state.ppu||!data.state.mmap||!data.state.papu)throw Error('存档格式不匹配，请选择本网页导出的存档。');}
const SAVE_KEYS=['manual','auto','before-restart'];
async function updateDate(){
 const values=await Promise.all(SAVE_KEYS.map(read));const selected=$('save-slot').value;
 SAVE_KEYS.forEach((key,i)=>{$('slot-'+key).disabled=!values[i];});
 // A later automatic capture must not silently replace the manual slot.
 let index=SAVE_KEYS.indexOf(selected);
 if(index<0||!values[index])index=values.findIndex(Boolean);
 lastSave=index>=0?values[index]:undefined;
 if(index>=0)$('save-slot').value=SAVE_KEYS[index];
 $('restore').disabled=!lastSave;
 $('savedate').textContent=lastSave?'所选网页存档：'+new Date(lastSave.date).toLocaleString():'尚无网页存档；游戏内记录会另外保留';
}
function batteryRecord(){return{format:'tenchi2-battery',romSha256:HASH,date:new Date().toISOString(),ram:Array.from(player.nes.cpu.mem.slice(0x6000,0x8000))};}
function validBattery(data){return data?.romSha256===HASH&&Array.isArray(data.ram)&&data.ram.length===8192&&data.ram.every(n=>Number.isInteger(n)&&n>=0&&n<=255);}
async function persistBattery(){
 if(!ready)return;const data=batteryRecord();
 // Small synchronous mirror protects in-game saves during page shutdown.
 try{localStorage.setItem(BATTERY_KEY,JSON.stringify(data));}catch(e){}
 await store('battery',data);
}
function batteryWritten(){
 if(!ready)return;clearTimeout(batteryTimer);
 batteryTimer=setTimeout(()=>persistBattery().catch(()=>message('游戏内记录暂未写入浏览器，请导出网页存档备份。')),500);
}
async function recoverBattery(){
 const values=await Promise.all(['battery',...SAVE_KEYS].map(read));const candidates=[];
 try{candidates.push(JSON.parse(localStorage.getItem(BATTERY_KEY)));}catch(e){}
 for(const data of values){
  if(validBattery(data))candidates.push(data);
  else if(data?.romSha256===HASH&&Array.isArray(data.state?.cpu?.mem)&&data.state.cpu.mem.length===65536)candidates.push({romSha256:HASH,date:data.date,ram:data.state.cpu.mem.slice(0x6000,0x8000)});
 }
 return candidates.filter(validBattery).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
}
function loadCartridge(ram){
 player.nes.loadROM(rom);if(!JAPANESE)enableTranslationRam(player.nes);
 if(ram)for(let i=0;i<8192;i++)player.nes.cpu.mem[0x6000+i]=ram[i];
}
async function restartTitle(){
 if(!ready)return;pause();clearTimeout(batteryTimer);const backup=snapshot();const ram=batteryRecord().ram;
 try{
  await store('before-restart',backup);await persistBattery();
  loadCartridge(ram);release();resume();await updateDate();
  message('已回到标题，游戏内记录已保留；按 START 后选择「开始游戏」读取记录。');
 }catch(e){message('未能保存回标题前的备份，当前画面已保留。请先导出存档。');}
}
async function save(key='manual',quiet=false){if(!ready)return;try{const data=snapshot();await store(key,data);await persistBattery();if(key==='manual')$('save-slot').value='manual';await updateDate();if(!quiet)message('网页进度已保存到手动存档');}catch(e){message('无法保存：浏览器存储不可用，请导出存档备份。');}}
function restoreData(data){validate(data);const previous=player.nes.toJSON();pause();try{player.nes.fromJSON(data.state);release();batteryWritten();resume();message('已恢复 '+new Date(data.date).toLocaleString()+' 的网页存档；若仍是「再见」，点「回到标题」读取游戏内记录。');}catch(e){player.nes.fromJSON(previous);release();throw Error('存档损坏，当前进度已保留。');}}
$('edition').textContent=EDITION;$('language').value=JAPANESE?'ja':'zh';$('language').onchange=e=>{location.search='?lang='+e.target.value;};
$('launch').onclick=resume;
$('pause').onclick=()=>running?pause():resume();
$('save').onclick=()=>save();
$('restore').onclick=async()=>{try{await updateDate();if(lastSave)restoreData(lastSave);}catch(e){message(e.message);}};
$('save-slot').onchange=()=>updateDate().catch(()=>message('读取存档列表失败'));
$('restart').onclick=restartTitle;
$('export').onclick=()=>{try{const blob=new Blob([JSON.stringify(snapshot())],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='tenchi2-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('存档已导出，请保留下载的 JSON 文件');}catch(e){message('导出失败：'+e.message);}};
$('import').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>16*1024*1024)throw Error('存档过大，请选择本网页导出的 JSON 文件。');const data=JSON.parse(await file.text());validate(data);if(running&&!confirm('读取存档会替换当前进度，是否继续？'))return;restoreData(data);await save();}catch(e){message('导入失败：'+e.message);}finally{event.target.value='';}};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('screen-wrap').requestFullscreen)await $('screen-wrap').requestFullscreen();else message('此浏览器不支持全屏，可横屏游玩');}catch(e){message('无法进入全屏：'+e.message);}};
new ResizeObserver(()=>player?.fitInParent()).observe($('screen'));
document.addEventListener('fullscreenchange',()=>player?.fitInParent());
document.querySelectorAll('[data-key]').forEach(button=>{const code=jsnes.Controller['BUTTON_'+button.dataset.key];button.onpointerdown=event=>{event.preventDefault();if(!running)return;button.setPointerCapture(event.pointerId);button.classList.add('pressed');player.nes.buttonDown(1,code);};const up=event=>{event.preventDefault();button.classList.remove('pressed');player?.nes.buttonUp(1,code);};button.onpointerup=up;button.onpointercancel=up;button.onlostpointercapture=up;});
window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready){save('auto',true);pause();}});
window.addEventListener('pagehide',()=>{if(ready){persistBattery().catch(()=>{});save('auto',true);}});
setInterval(()=>{if(running)save('auto',true);},60000);
(async()=>{try{const response=await fetch('doae2j.nes');if(!response.ok)throw Error('游戏数据下载失败（'+response.status+'）');rom=new Uint8Array(await response.arrayBuffer());const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rom)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==ORIGINAL_HASH)throw Error('游戏数据校验失败，请刷新后重试。');if(!JAPANESE){const patchResponse=await fetch('zh-hans.ips');if(!patchResponse.ok)throw Error('汉化补丁下载失败');rom=applyIps(rom,await patchResponse.arrayBuffer());const zhDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rom)),b=>b.toString(16).padStart(2,'0')).join('');if(zhDigest!==HASH)throw Error('汉化结果校验失败');}player=new jsnes.Browser({container:$('screen'),onBatteryRamWrite:batteryWritten,onError:e=>{running=false;release();$('pause').textContent='继续';message('游戏运行错误：'+e.message);}});let recovered;try{recovered=await recoverBattery();}catch(e){}loadCartridge(recovered?.ram);player.keyboard.keys={13:[1,3],17:[1,2],37:[1,6],38:[1,4],39:[1,7],40:[1,5],88:[1,0],90:[1,1]};ready=true;for(const id of ['launch','pause','save','export','import','restart'])$(id).disabled=false;$('loading').textContent='游戏数据已校验 · 键盘 / 触屏 / 手柄';message('已就绪 · 点击开始游戏');try{await updateDate();if(lastSave||recovered)$('launch').textContent='进入游戏 →';}catch(e){$('savedate').textContent='浏览器存储不可用；可导出存档备份。';}}catch(e){$('loading').textContent=e.message;message('载入失败，请刷新重试');}})();

