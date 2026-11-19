#!/usr/bin/env node
/* Deep-link checks: loads index.html?… in Chromium (Playwright) at a phone size (390×844, touch) and a
   desktop size, and checks that each demo link opens its lab, that the plain URL still opens the normal
   start screen, and that nothing logs a console error. Shared scripts from itsdrdan.github.io are served
   from the sibling clones (../games, ../questionbank); track.js is stubbed so tests send no stats.
   Usage: NODE_PATH=/path/to/node_modules node tools/check-deeplink.js   (needs the playwright package) */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..'),SIB=path.join(ROOT,'..');
const page0='file://'+path.join(ROOT,'index.html');
const SIZES=[['phone',{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3}],['desktop',{viewport:{width:1280,height:900}}]];
const inView=sel=>`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return r.height>0&&r.top>=-4&&r.top<innerHeight*.6;})()`;
let fails=0,checks=0;const ok=(c,m)=>{checks++;if(!c){fails++;console.log('FAIL',m);}};
async function run(CASES){
 const browser=await chromium.launch();
 for(const [size,opts] of SIZES){
  for(const [query,tests] of CASES){
   const ctx=await browser.newContext({...opts,reducedMotion:'reduce'});const page=await ctx.newPage();const errs=[];
   await ctx.route('https://itsdrdan.github.io/**',r=>{const u=new URL(r.request().url()),p=path.join(SIB,decodeURIComponent(u.pathname));
    if(u.pathname.endsWith('/track.js'))return r.fulfill({status:200,contentType:'text/javascript',body:''});
    if(fs.existsSync(p)&&fs.statSync(p).isFile())return r.fulfill({path:p});return r.abort();});
   await ctx.route(/^https?:\/\/(?!itsdrdan\.github\.io)/,r=>r.abort());
   page.on('console',m=>{if(m.type()==='error'&&!/net::ERR_FAILED|ERR_INTERNET|Failed to load resource/.test(m.text()))errs.push(m.text());});
   page.on('pageerror',e=>errs.push(String(e)));
   await page.goto(page0+query,{waitUntil:'load'});await page.waitForTimeout(400);
   const tag=size+' '+(query||'(plain)');
   for(const [expr,msg] of tests){let v;try{v=await page.evaluate(expr);}catch(e){v='threw '+e.message;}ok(v===true,tag+': '+msg+' ('+JSON.stringify(v)+')');}
   ok(errs.length===0,tag+': console errors: '+errs.join(' | '));
   await ctx.close();
  }
 }
 await browser.close();
 console.log((fails?'FAILED ':'OK ')+checks+' checks, '+fails+' failures');process.exit(fails?1:0);
}
const shown=id=>`(()=>{const e=document.getElementById('${id}');return !!e&&!e.hidden&&e.getClientRects().length>0;})()`;
/* every question in the quest is a tray lab: draw 12 more with the same code the Next button uses */
const allTray="(()=>{for(let i=0;i<12;i++){newQuestion();if(!state.q.lab||byId('trayQ').hidden)return false;}return true;})()";
const trayQuest=[[shown('practiceView'),'Practice Quests view is showing'],["state.mode==='limiting'",'Limiting Reactants quest is selected'],
 ["document.querySelector('#modeGrid [data-quest-mode=\"limiting\"]').classList.contains('active')",'Limiting Reactants card is highlighted'],
 ["!!state.q.lab&&state.q.stage==='predict'",'first question is a Tray lab at Predict'],[shown('trayQ'),'tray lab is showing'],[inView('#play'),'quest area is scrolled into view'],
 [allTray,'next 12 questions are all Tray labs']];
run([
 ['',[[shown('learnView'),'plain URL opens the Learn Trail'],["state.course==='3A'",'default course 3A'],["byId('trayQ').hidden===true",'no tray question'],["!state.trayOnly",'tray not forced']]],
 ['?quest=limiting&tray=1',[...trayQuest,["state.course==='3A'",'course 3A']]],
 ['?course=1A&quest=limiting&tray=1',[...trayQuest,["state.course==='1A'",'course 1A kept']]],
 ['?quest=limiting',[[shown('practiceView'),'Practice view'],["state.mode==='limiting'",'Limiting Reactants quest selected'],["!state.trayOnly",'tray mixed in, not forced'],
  ["(()=>{let t=0;for(let i=0;i<60;i++){newQuestion();if(state.q.lab)t++;}return t>0&&t<60;})()",'without tray=1, tray labs are mixed with regular questions']]],
 ['?quest=limiting&tray=1',[["(()=>{document.querySelector('#modeGrid [data-quest-mode=\"mixed\"]').click();let t=0;for(let i=0;i<40;i++){newQuestion();if(state.q.lab)t++;}return t<40;})()",'switching to Mixed Practice stops forcing the tray']]],
 ['?quest=challenge',[[shown('learnView'),'CHEM 1A-only quest is ignored on CHEM 3A'],["state.mode!=='challenge'",'mode not set']]],
]);
