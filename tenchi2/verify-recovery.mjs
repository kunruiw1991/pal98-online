import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
const file=name=>fs.readFileSync(new URL('./'+name,import.meta.url));
const vendor={module:{exports:{}},exports:{},Uint8Array};vendor.exports=vendor.module.exports;
vm.runInNewContext(file('jsnes.min.js').toString(),vendor);
vm.runInNewContext(file('patch.js').toString(),vendor);
const {NES,Controller}=vendor.module.exports;
const rom=vendor.applyIps(file('doae2j.nes'),file('zh-hans.ips'));
const hash=createHash('sha256').update(rom).digest('hex');
const run=(nes,n)=>{for(let i=0;i<n;i++)nes.frame();};
const press=(nes,key)=>{nes.buttonDown(1,Controller['BUTTON_'+key]);run(nes,5);nes.buttonUp(1,Controller['BUTTON_'+key]);run(nes,90);};
// Produce a real registered game slot through the game's own title menus.
const registered=new NES();registered.loadROM(rom);vendor.enableTranslationRam(registered);
run(registered,600);for(const key of ['START','A','A','START'])press(registered,key);
const legacy={format:'tenchi2-web-save',version:1,engine:'jsnes-2.1.0',romSha256:hash,date:'2026-10-14T00:00:00.000Z',state:registered.toJSON()};
const ram=Array.from(registered.cpu.mem.slice(0x6000,0x8000));
assert(new Set(ram).size>5,'fixture must contain a real registered game, not blank SRAM');
// The legacy CPU position is deliberately unusable: cold recovery must take
// only game SRAM, never resume an old stopped/quit screen's CPU position.
legacy.state.cpu.REG_PC=0;
function boot(records,mirror=new Map()){
 const elements=new Map();let browser;const timers=new Map();let timerId=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{disabled:true,textContent:'',value:id==='save-slot'?'manual':'',style:{},classList:{remove(){}}});return elements.get(id);};
 const db={transaction(){const tx={};tx.objectStore=()=>({put(value,key){records.set(key,structuredClone(value));setImmediate(()=>tx.oncomplete?.());},get(key){const request={};setImmediate(()=>{request.result=structuredClone(records.get(key));request.onsuccess?.();});return request;}});return tx;}};
 const context={console,Uint8Array,URLSearchParams,location:{search:'?lang=zh'},Blob,URL,crypto:webcrypto,confirm:()=>true,performance,
  setInterval(){},setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id){timers.delete(id);},ResizeObserver:class{observe(){}},window:{addEventListener(){}},
  localStorage:{getItem:key=>mirror.get(key)??null,setItem:(key,value)=>mirror.set(key,value)},
  indexedDB:{open(){const request={result:db};setImmediate(()=>request.onsuccess?.());return request;}},
  document:{getElementById:element,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({click(){}})},
  fetch:async url=>({ok:true,arrayBuffer:async()=>{const b=file(url.endsWith('.ips')?'zh-hans.ips':'doae2j.nes');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}}),
  jsnes:{Controller,Browser:class{constructor(options){browser=this;this.nes=new NES({onBatteryRamWrite:options.onBatteryRamWrite});this.keyboard={};}start(){}stop(){}fitInParent(){}}}};
 vm.createContext(context);vm.runInContext(file('patch.js').toString(),context);vm.runInContext(file('app.js').toString(),context);
 return{element,context,timers,mirror,get nes(){return browser.nes;},async ready(){for(let i=0;i<100&&element('launch').disabled;i++)await new Promise(r=>setTimeout(r,10));assert(!element('launch').disabled);}};
}
const records=new Map([['auto',structuredClone(legacy)]]);const app=boot(records);await app.ready();
assert.deepEqual(Array.from(app.nes.cpu.mem.slice(0x6000,0x8000)),ram,'legacy snapshot must restore game SRAM on cold boot');
assert.notEqual(app.nes.cpu.REG_PC,0,'must boot ROM instead of restoring quit CPU state');
app.element('launch').onclick();
await app.element('save').onclick();const manual=structuredClone(records.get('manual'));
app.nes.cpu.REG_ACC=77;await vm.runInContext("save('auto',true)",app.context);
assert.equal(app.element('save-slot').value,'manual','automatic saves must not take over manual slot');
await app.element('restore').onclick();assert.equal(app.nes.cpu.REG_ACC,manual.state.cpu.REG_ACC);
app.element('save-slot').value='auto';await app.element('save-slot').onchange();await app.element('restore').onclick();assert.equal(app.nes.cpu.REG_ACC,77,'automatic slot remains explicitly readable');
await app.element('restart').onclick();
assert(records.has('before-restart'),'restart must preserve the previous full snapshot');
assert.deepEqual(Array.from(app.nes.cpu.mem.slice(0x6000,0x8000)),ram,'returning to title must preserve the complete SRAM');
const before=app.nes.cpu.REG_PC;run(app.nes,600);assert.notEqual(app.nes.cpu.REG_PC,before,'game must advance after return to title');
press(app.nes,'START');assert(!app.nes.crashed);
// In-game writes must schedule persistent battery storage, independent of snapshots.
app.nes.mmap.write(0x6010,123);const pending=Array.from(app.timers.values()).find(t=>t.delay===500);assert(pending);await pending.fn();
assert.equal(records.get('battery').ram[16],123);assert.equal(JSON.parse(app.mirror.get('tenchi2-battery-'+hash)).ram[16],123);
const reloaded=boot(records,app.mirror);await reloaded.ready();assert.equal(reloaded.nes.cpu.mem[0x6010],123,'SRAM must survive a browser reload');
assert(records.get('manual').state.cpu.mem[0x6010]!==123,'battery persistence must not overwrite the manual snapshot');
console.log(JSON.stringify({result:'PASS',checks:['migrate game SRAM from a legacy stopped-state snapshot','cold boot never resumes the legacy CPU position','manual snapshot is not displaced by newer automatic snapshots','automatic snapshot remains separately selectable','return-to-title retains all 8192 SRAM bytes and backs up full state','ROM advances and accepts START after return to title','in-game battery writes persist to IndexedDB and synchronous fallback','battery save survives a fresh app instance','manual snapshot remains unchanged'],scope:'Actual page handlers with real JSNES core; DOM/storage adapters are test fixtures'},null,2));
