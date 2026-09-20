const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sharp = require('sharp');
const a1 = require('alt1');
const root = path.resolve(__dirname, '..');
async function pixels(file) {
 const {data,info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 return new a1.ImageData(new Uint8ClampedArray(data),info.width,info.height);
}
async function main() {
 const source = fs.readFileSync(path.join(root,'src/lib/compat/modern-buffs.ts'),'utf8');
 const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module = {exports:{}};
 // Only legacy fallback is stubbed: test the actual compatibility code, font and templates.
 const load = name => name === 'alt1/buffs' ? {__esModule:true,default:class {find(){return false;} read(){return [];}}} :
  name === './modern-font.data.png' ? pixels(path.join(root,'src/lib/compat/modern-font.data.png')) : require(name);
 new Function('require','module','exports',compiled)(load,module,module.exports);
 const {default:Reader,ModernBuff,findModernSlots,ready} = module.exports;
 await ready;
 const buffs = await pixels(path.join(__dirname,'fixtures/modern-buffs.png'));
 const debuffs = await pixels(path.join(__dirname,'fixtures/modern-debuffs.png'));
 const reader = new Reader();
 const values = reader.read(buffs);
 assert.equal(values.length,6);
 assert.deepEqual(values.map(buff=>buff.readTime()),[2,2,6,12,24,14]);
 const names=['residual-soul','split-soul','living-death','Necrosis'];
 const templates=await Promise.all(names.map(name=>pixels(path.join(root,'src/asset/data/buffs/necro',name+'.data.png'))));
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){
  const score=values[i].countMatch(templates[j]).passed;
  assert.ok(i===j?score>400:score===0, `${names[i]} versus ${names[j]}: ${score}`);
 }
 const debuffReader = new Reader();debuffReader.debuffs=true;
 assert.deepEqual(debuffReader.read(debuffs).map(buff=>buff.readTime()),[37,240,426]);
 assert.equal(findModernSlots(buffs,true).length,0);
 assert.equal(findModernSlots(debuffs,false).length,0);
 const moved=new a1.ImageData(700,300);buffs.copyTo(moved,0,0,buffs.width,buffs.height,401,151);
 assert.deepEqual(reader.read(moved).map(buff=>buff.readTime()),[2,2,6,12,24,14]);
 assert.equal(reader.pos.x,findModernSlots(buffs)[0].x+401);
 // Remove every buff and ensure cached stacks are cleared on the next frame.
 assert.deepEqual(reader.read(new a1.ImageData(700,300)),[]);
 // Corrupt a border; it must not become a plausible buff.
 const damaged = buffs.clone({x:0,y:0,width:buffs.width,height:buffs.height});for(let x=0;x<damaged.width;x++) damaged.setPixel(x,2,0,0,0,255);
 assert.equal(findModernSlots(damaged).length,0);
 console.log('Buff compatibility checks passed: identification, stacks, seconds/minutes, moved bars, colour separation and empty frames.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
