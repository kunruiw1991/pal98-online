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
 const elements=new Map();let browser;const events=new Map();const timers=new Map();let timerId=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{disabled:true,textContent:'',value:id==='save-slot'?'manual':'',style:{},classList:{remove(){}}});return elements.get(id);};
 const db={transaction(){const tx={};tx.objectStore=()=>({put(value,key){records.set(key,structuredClone(value));setImmediate(()=>tx.oncomplete?.());},get(key){const request={};setImmediate(()=>{request.result=structuredClone(records.get(key));request.onsuccess?.();});return request;}});return tx;}};
 const context={console,Uint8Array,URLSearchParams,location:{search:'?lang=zh'},Blob,URL,crypto:webcrypto,confirm:()=>true,performance,
  setInterval(){},setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id){timers.delete(id);},ResizeObserver:class{observe(){}},window:{addEventListener:(type,fn)=>events.set('window:'+type,fn),requestAnimationFrame:()=>1,cancelAnimationFrame(){}},
  localStorage:{getItem:key=>mirror.get(key)??null,setItem:(key,value)=>mirror.set(key,value)},
  indexedDB:{open(){const request={result:db};setImmediate(()=>request.onsuccess?.());return request;}},
  document:{hidden:false,getElementById:element,querySelectorAll:()=>[],addEventListener:(type,fn)=>events.set('document:'+type,fn),createElement:()=>({click(){}})},
  fetch:async url=>({ok:true,arrayBuffer:async()=>{const b=file(url.endsWith('.ips')?'zh-hans.ips':'doae2j.nes');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}}),
  jsnes:{Controller,Browser:class{constructor(options){browser=this;this.nes=new NES({onBatteryRamWrite:options.onBatteryRamWrite});this.keyboard={};this.starts=0;this.stops=0;this._frameTimer=new context.FrameTimer({onGenerateFrame:()=>this.nes.frame(),onWriteFrame:()=>{}});}start(){this.starts++;this._frameTimer.start();}stop(){this.stops++;this._frameTimer.stop();}fitInParent(){}}}};
 vm.createContext(context);vm.runInContext(file('qa/jsnes-frame-timer.js').toString().replace('export default class FrameTimer','globalThis.FrameTimer = class FrameTimer'),context);vm.runInContext(file('patch.js').toString(),context);vm.runInContext(file('app.js').toString(),context);
 return{element,context,timers,mirror,events,get browser(){return browser;},get nes(){return browser.nes;},async ready(){for(let i=0;i<100&&element('launch').disabled;i++)await new Promise(r=>setTimeout(r,10));assert(!element('launch').disabled);}};
}

const app=boot(new Map());await app.ready();
const emit=(target,type)=>app.events.get(target+':'+type)?.();
const hidden=value=>{app.context.document.hidden=value;emit('document','visibilitychange');};
hidden(true);hidden(false);assert.equal(app.browser.starts,0,'must not start before launch');
app.element('launch').onclick();run(app.nes,300);
const timer=app.browser._frameTimer;
const before=JSON.stringify(app.nes.toJSON());
hidden(true);assert.equal(vm.runInContext('running',app.context),false);
timer.generateFrame();assert.equal(JSON.stringify(app.nes.toJSON()),before,'queued frame cannot run while hidden');
hidden(false);assert.equal(vm.runInContext('running',app.context),true);
assert.equal(JSON.stringify(app.nes.toJSON()),before,'return must retain exact current state');
timer.onAnimationFrame(100);timer.onAnimationFrame(120);
assert.notEqual(JSON.stringify(app.nes.toJSON()),before,'frames continue after return');
for(let i=0;i<50;i++){hidden(true);hidden(true);hidden(false);emit('window','focus');}
assert.equal(app.browser.starts,52,'one start per return, no duplicate focus start');
app.element('pause').onclick();hidden(true);hidden(false);emit('window','focus');
assert.equal(vm.runInContext('running',app.context),false,'manual pause must remain paused');
app.element('pause').onclick();
timer.onAnimationFrame(200);timer.onAnimationFrame(220);
const queued=app.timers.size;
timer.onAnimationFrame(3600220);
assert.equal(app.timers.size,queued,'one-hour idle gap must not enqueue catch-up frames');
timer.onAnimationFrame(3600240);assert(!app.nes.crashed);
let audioResumes=0;app.browser._speakers={audioCtx:{state:'suspended',resume(){audioResumes++;return Promise.resolve();}}};
emit('document','keydown');assert.equal(audioResumes,1,'first input must wake suspended audio');
hidden(true);emit('window','pageshow');assert.equal(vm.runInContext('running',app.context),false);
app.context.document.hidden=false;emit('window','pageshow');assert.equal(vm.runInContext('running',app.context),true);
const report={result:'PASS',checks:['no automatic start before first launch','hidden page pauses and blocks stale queued frames','return resumes exact CPU/PPU/RAM state without loading ROM or snapshots','50 repeated tab switches resume without duplicate focus starts','manual pause survives tab switching','one-hour foreground animation gap produces no timeout backlog','first input wakes suspended audio','pageshow recovers suspended page only when visible'],scope:'Actual app lifecycle handlers and official JSNES 2.1.0 FrameTimer with real Chinese NES core; browser visibility/audio adapters are fixtures'};
fs.writeFileSync(new URL('./IDLE_RESUME_VERIFICATION.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
