'use strict';
const HASH='2bc5970f8e2b6ddd0172e900b78d5234ed1919954cf00434a86ca18166a6f4bf';
const $=id=>document.getElementById(id);
let player,rom,running=false,ready=false,db,lastSave;
const dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open('tenchi2-original',1);request.onupgradeneeded=()=>request.result.createObjectStore('saves');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
dbPromise.catch(()=>{});
async function store(key,value){const database=await dbPromise;return new Promise((resolve,reject)=>{const tx=database.transaction('saves','readwrite');tx.objectStore('saves').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function read(key){const database=await dbPromise;return new Promise((resolve,reject)=>{const request=database.transaction('saves').objectStore('saves').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
const message=text=>{$('status').textContent=text;};
function release(){if(!player)return;for(let i=0;i<10;i++)player.nes.buttonUp(1,i);document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
function pause(){if(!running)return;player.stop();running=false;release();$('pause').textContent='继续';message('已暂停');}
function resume(){if(!ready||running)return;player.start();running=true;$('cover').hidden=true;$('cover').style.display='none';$('pause').textContent='暂停';message('游戏进行中 · 日文原版');}
function snapshot(){return{format:'tenchi2-web-save',version:1,engine:'jsnes-2.1.0',romSha256:HASH,date:new Date().toISOString(),state:player.nes.toJSON()};}
function validate(data){if(!data||data.format!=='tenchi2-web-save'||data.version!==1||data.engine!=='jsnes-2.1.0'||data.romSha256!==HASH||!Array.isArray(data.state?.cpu?.mem)||data.state.cpu.mem.length!==65536||!data.state.ppu||!data.state.mmap||!data.state.papu)throw Error('存档格式不匹配，请选择本网页导出的存档。');}
async function updateDate(){const values=await Promise.all([read('manual'),read('auto')]);lastSave=values.filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date))[0];$('restore').disabled=!lastSave;$('savedate').textContent=lastSave?'最近保存：'+new Date(lastSave.date).toLocaleString():'尚无浏览器存档';}
async function save(key='manual',quiet=false){if(!ready)return;try{const data=snapshot();await store(key,data);await updateDate();if(!quiet)message('进度已保存到当前浏览器');}catch(e){message('无法保存：浏览器存储不可用，请导出存档备份。');}}
function restoreData(data){validate(data);const previous=player.nes.toJSON();pause();try{player.nes.fromJSON(data.state);release();resume();message('已恢复 '+new Date(data.date).toLocaleString()+' 的进度');}catch(e){player.nes.fromJSON(previous);release();throw Error('存档损坏，当前进度已保留。');}}
$('launch').onclick=resume;
$('pause').onclick=()=>running?pause():resume();
$('save').onclick=()=>save();
$('restore').onclick=async()=>{try{await updateDate();if(lastSave)restoreData(lastSave);}catch(e){message(e.message);}};
$('export').onclick=()=>{try{const blob=new Blob([JSON.stringify(snapshot())],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='tenchi2-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('存档已导出，请保留下载的 JSON 文件');}catch(e){message('导出失败：'+e.message);}};
$('import').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>16*1024*1024)throw Error('存档过大，请选择本网页导出的 JSON 文件。');const data=JSON.parse(await file.text());validate(data);if(running&&!confirm('读取存档会替换当前进度，是否继续？'))return;restoreData(data);await save();}catch(e){message('导入失败：'+e.message);}finally{event.target.value='';}};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('screen-wrap').requestFullscreen)await $('screen-wrap').requestFullscreen();else message('此浏览器不支持全屏，可横屏游玩');}catch(e){message('无法进入全屏：'+e.message);}};
new ResizeObserver(()=>player?.fitInParent()).observe($('screen'));
document.addEventListener('fullscreenchange',()=>player?.fitInParent());
document.querySelectorAll('[data-key]').forEach(button=>{const code=jsnes.Controller['BUTTON_'+button.dataset.key];button.onpointerdown=event=>{event.preventDefault();if(!running)return;button.setPointerCapture(event.pointerId);button.classList.add('pressed');player.nes.buttonDown(1,code);};const up=event=>{event.preventDefault();button.classList.remove('pressed');player?.nes.buttonUp(1,code);};button.onpointerup=up;button.onpointercancel=up;button.onlostpointercapture=up;});
window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready){save('auto',true);pause();}});
window.addEventListener('pagehide',()=>{if(ready)save('auto',true);});
setInterval(()=>{if(running)save('auto',true);},60000);
(async()=>{try{const response=await fetch('doae2j.nes');if(!response.ok)throw Error('游戏数据下载失败（'+response.status+'）');rom=new Uint8Array(await response.arrayBuffer());const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rom)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==HASH)throw Error('游戏数据校验失败，请刷新后重试。');player=new jsnes.Browser({container:$('screen'),onError:e=>{running=false;release();$('pause').textContent='继续';message('游戏运行错误：'+e.message);}});player.nes.loadROM(rom);player.keyboard.keys={13:[1,3],17:[1,2],37:[1,6],38:[1,4],39:[1,7],40:[1,5],88:[1,0],90:[1,1]};ready=true;for(const id of ['launch','pause','save','export','import'])$(id).disabled=false;$('loading').textContent='原版数据已校验 · 键盘 / 触屏 / 手柄';message('已就绪 · 点击开始游戏');try{await updateDate();if(lastSave)$('launch').textContent='开始新游戏 →';}catch(e){$('savedate').textContent='浏览器存储不可用；可导出存档备份。';}}catch(e){$('loading').textContent=e.message;message('载入失败，请刷新重试');}})();
