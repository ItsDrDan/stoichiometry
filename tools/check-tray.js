#!/usr/bin/env node
/* Limiting-Reactant Tray checks: runs the TRAY-LOGIC block of index.html in Node with the game's
   equations and checks every tray and apply question against a calculation written here.
   Usage: node tools/check-tray.js [draws per equation] (default 3000) */
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i=src.indexOf('const eqs=['),j=src.indexOf('];',i)+2,a=src.indexOf('/*TRAY-LOGIC-START'),b=src.indexOf('/*TRAY-LOGIC-END*/');
const ctx={Math,Number,String,Object,Array,JSON,RegExp,console};vm.createContext(ctx);
vm.runInContext(src.slice(i,j)+'\n'+src.slice(a,b)+'\nthis.eqs=eqs;this.traySpec=traySpec;',ctx);
const N=+process.argv[2]||3000;let fails=0,checks=0,counter=0,total=0;const ok=(c,m)=>{checks++;if(!c){fails++;if(fails<30)console.log('FAIL',m)}};
/* independent: atom balance of each equation used */
const atoms=f=>{const o={};for(const [,el,n] of f.matchAll(/([A-Z][a-z]?)(\d*)/g))o[el]=(o[el]||0)+(+n||1);return o};
const side=s=>s.reduce((o,[f,c])=>{for(const [el,n] of Object.entries(atoms(f)))o[el]=(o[el]||0)+n*c;return o},{});
const sf=s=>{s=String(s);const d=s.replace('.','').replace(/^0+/,'');return s.includes('.')?d.length:d.replace(/0+$/,'').length};
for(const e of ctx.eqs.filter(x=>x.lhs.length===2)){ok(JSON.stringify(Object.entries(side(e.lhs)).sort())===JSON.stringify(Object.entries(side(e.rhs)).sort()),e.name+': equation not balanced');
 for(let r=0;r<N;r++){const s=ctx.traySpec(e);total++;if(s.counter)counter++;const [[A,ca],[B,cb]]=e.lhs,tag=e.name+' '+s.nA+A+'/'+s.nB+B;
  /* sets: simulate set by set, independently */
  let nA=s.nA,nB=s.nB,sets=0;while(nA>=ca&&nB>=cb){nA-=ca;nB-=cb;sets++}
  const lim=s.nA/ca<s.nB/cb?A:s.nB/cb<s.nA/ca?B:'tie';
  ok(Math.floor((s.lim===A?s.nB/cb:s.nA/ca))>sets,tag+': excess reactant could not make more sets, so the table would show a tie');
  ok(sets===s.sets&&sets>=2&&sets<=5,tag+': sets '+s.sets+' vs '+sets);
  ok(lim===s.lim&&lim!=='tie',tag+': limiting '+s.lim+' vs '+lim);
  ok((s.lim===A?nA:nB)===0,tag+': limiting reactant not used up exactly');
  ok((s.lim===A?nB:nA)===s.leftover&&s.leftover>0,tag+': leftover');
  ok(s.nA+s.nB<=22,tag+': too many particles to draw');
  ok(s.counter===((s.lim===A?s.nA:s.nB)>(s.lim===A?s.nB:s.nA)),tag+': counter flag');
  /* apply: theoretical yield in moles, from the numbers in the prompt */
  const ap=s.apply,[P,cp]=e.rhs[0],m=[...ap.prompt.matchAll(/([\d.]+) mol/g)].map(x=>x[1]);
  ok(m.length===2&&sf(m[0])===3&&sf(m[1])===3,tag+': apply amounts not 3 sig figs: '+m.join(', '));
  const yA=+m[0]/ca*cp,yB=+m[1]/cb*cp,want=Math.min(yA,yB);
  ok(Math.abs(ap.answer-want)<=1e-12*want,tag+': apply answer');
  ok(Math.abs(yA-yB)>=.05*Math.max(yA,yB)*.9,tag+': apply too close to a tie');
  ok(ap.unit==='mol '+P,tag+': unit');
  for(const t of ap.traps)ok(Math.abs(t.v-ap.answer)>Math.abs(ap.answer)*.02,tag+': trap within 2%');
  ok(!/NaN|undefined|e[+-]\d/.test(ap.prompt+ap.steps.join(' ')),tag+': junk text');}}
console.log(checks+' checks on '+total+' trays ('+Math.round(100*counter/total)+'% where the limiting reactant starts with MORE particles): '+(fails?fails+' FAILED':'all passed'));process.exit(fails?1:0);
