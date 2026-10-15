// IPS reader, including RLE and optional output-size extension.
function applyIps(original,patch){
 const p=new Uint8Array(patch);let i=5;let out=new Uint8Array(original);
 const text=(a,n)=>String.fromCharCode(...p.subarray(a,a+n));
 if(text(0,5)!=='PATCH')throw Error('汉化补丁格式错误');
 const ensure=n=>{if(n>4*1024*1024)throw Error('汉化补丁大小异常');if(n>out.length){const next=new Uint8Array(n);next.set(out);out=next;}};
 while(i+3<=p.length){
  if(text(i,3)==='EOF'){i+=3;if(i+3===p.length){const n=(p[i]<<16)|(p[i+1]<<8)|p[i+2];ensure(n);out=out.slice(0,n);}return out;}
  const offset=(p[i]<<16)|(p[i+1]<<8)|p[i+2];i+=3;
  if(i+2>p.length)break;const size=(p[i]<<8)|p[i+1];i+=2;
  if(size){if(i+size>p.length)break;ensure(offset+size);out.set(p.subarray(i,i+size),offset);i+=size;}
  else{if(i+3>p.length)break;const n=(p[i]<<8)|p[i+1];ensure(offset+n);out.fill(p[i+2],offset,offset+n);i+=3;}
 }
 throw Error('汉化补丁不完整');
}
// This translation uses 4 KiB cartridge work RAM at $5000-$5FFF.
// JSNES Mapper 4 treats that area as open bus by default. Keep the adapter
// specific to this verified ROM; CPU memory already serializes the RAM.
// Reference: FCEUX src/boards/mmc3.cpp, M195Power / Mapper198_Init.
function enableTranslationRam(nes){
 if(nes.rom.translationRamEnabled)return;
 const decorate=mapper=>{const load=mapper.load.bind(mapper);mapper.load=address=>address>=0x5000&&address<=0x5fff?nes.cpu.mem[address]:load(address);return mapper;};
 // fromJSON/reset creates a fresh mapper; apply the same mapping every time.
 const create=nes.rom.createMapper.bind(nes.rom);
 nes.rom.createMapper=()=>decorate(create());
 nes.rom.translationRamEnabled=true;
 decorate(nes.mmap);
}
