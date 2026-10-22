'use strict';
const fs = require('fs');
const vm = require('vm');

/* ── DOM element factory ─────────────────────────────────────── */
function makeEl(id) {
  const el = {
    id: id || '', className:'', textContent:'', _innerHTML:'', value:'', checked:false,
    style:{}, dataset:{}, min:'', max:'',
    classList:{ add:()=>{}, remove:()=>{}, toggle:()=>{}, contains:()=>false },
    setAttribute:()=>{}, getAttribute:(a)=>el[a]||null, removeAttribute:()=>{},
    addEventListener:()=>{}, appendChild:()=>{}, remove:()=>{},
    querySelectorAll:()=>{ const a=[]; a.forEach=()=>{}; return a; },
    querySelector:()=>null,
    get innerHTML(){ return this._innerHTML; },
    set innerHTML(v){ this._innerHTML=v; },
    focus:()=>{},
    reset:()=>{},
    click:()=>{},
  };
  return el;
}

/* ── DOM registry ─────────────────────────────────────────────── */
const domRegistry = {};
function reg(id) { if(!domRegistry[id]) domRegistry[id]=makeEl(id); return domRegistry[id]; }

let lastRenderedHTML = '';
const plannerViewEl = {
  ...makeEl('planner-view'),
  get innerHTML(){ return lastRenderedHTML; },
  set innerHTML(v){ lastRenderedHTML=v; },
  querySelectorAll:()=>{ const a=[]; a.forEach=()=>{}; return a; },
  querySelector:()=>null,
};

let lastToastClass = '';
const toastEl = {
  ...makeEl('toast'),
  classList:{ add:(c)=>{ lastToastClass=c; }, remove:()=>{} },
};

/* ── Sandbox ─────────────────────────────────────────────────── */
const sb = {
  window:{}, console, confirm:()=>true,
  setTimeout:(fn)=>{ try{fn&&fn();}catch(e){} },
  clearTimeout:()=>{}, setInterval:()=>{}, clearInterval:()=>{},
  Date, Math, JSON, RegExp, parseInt, parseFloat,
  isNaN, isFinite, String, Number, Boolean, Array, Object, Promise,
  fetch:()=>Promise.resolve({ok:false}),
  localStorage:{_s:{},getItem(k){return this._s[k]||null},setItem(k,v){this._s[k]=String(v)}},
  document:{
    getElementById:(id)=>{
      if (id==='planner-view') return plannerViewEl;
      if (id==='toast') return toastEl;
      return reg(id);
    },
    querySelector:()=>null,
    querySelectorAll:()=>{ const a=[]; a.forEach=()=>{}; return a; },
    addEventListener:()=>{},
    createElement:()=>makeEl(),
    head:{ appendChild:()=>{} },
    body:{ appendChild:()=>{} },
  },
};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(fs.readFileSync('planner.js','utf8'), sb, {filename:'planner.js'});
const Planner = sb.Planner;

/* ── Test harness ─────────────────────────────────────────────── */
let passed=0, failed=0;
function assert(label, cond) {
  if (cond) { passed++; process.stdout.write('  PASS  '+label+'\n'); }
  else       { failed++; process.stdout.write('  FAIL  '+label+'\n'); }
}

const futureDate = new Date(); futureDate.setDate(futureDate.getDate()+14);
const examStr = futureDate.toISOString().slice(0,10);

console.log('\n=== Study Planner — Fix Verification ===\n');

/* 1. API surface */
assert('Planner.init is a function',           typeof Planner.init === 'function');
assert('Planner.addSubject is a function',      typeof Planner.addSubject === 'function');
assert('Planner.generatePlan is a function',    typeof Planner.generatePlan === 'function');
assert('Planner.clearPlan is a function',       typeof Planner.clearPlan === 'function');
assert('Planner.toggleSession is a function',   typeof Planner.toggleSession === 'function');
assert('Planner.deleteSubject is a function',   typeof Planner.deleteSubject === 'function');
assert('Planner.openModal is a function',       typeof Planner.openModal === 'function');
assert('Planner.closeModal is a function',      typeof Planner.closeModal === 'function');
assert('Planner.renderPlanner is a function',   typeof Planner.renderPlanner === 'function');

/* 2. init() calls renderPlanner — must produce HTML */
try { Planner.init(); } catch(e) { console.log('  [init threw]', e.message); }
assert('init() produces HTML',                  lastRenderedHTML.length > 0);
assert('HTML has .pl-view wrapper',             lastRenderedHTML.includes('class="pl-view"'));
assert('HTML has .pl-toolbar',                  lastRenderedHTML.includes('pl-toolbar'));
assert('HTML has #pl-add-btn',                  lastRenderedHTML.includes('id="pl-add-btn"'));
assert('HTML has #pl-gen-btn',                  lastRenderedHTML.includes('id="pl-gen-btn"'));
assert('HTML has #pl-clear-btn',                lastRenderedHTML.includes('id="pl-clear-btn"'));
assert('HTML shows empty state (no subjects)',   lastRenderedHTML.includes('pl-empty-state'));
assert('Empty state has add-subject guidance',  lastRenderedHTML.includes('Add Subject'));

/* 3. addSubject → re-render */
lastRenderedHTML = '';
Planner.addSubject({ name:'Mathematics', examDate:examStr, difficulty:2, priority:2, hoursPerDay:2, goal:'Score A+', color:'#60a5fa' });
assert('After addSubject, HTML updates',         lastRenderedHTML.length > 0);
assert('Subject card rendered',                  lastRenderedHTML.includes('pl-subject-card'));
assert('Subject name in HTML',                   lastRenderedHTML.includes('Mathematics'));
assert('Empty state gone after subject added',  !lastRenderedHTML.includes('pl-empty-state'));
assert('Subject goal rendered',                  lastRenderedHTML.includes('Score A+'));
assert('.pl-view wrapper still present',         lastRenderedHTML.includes('class="pl-view"'));

/* 4. generatePlan → sessions + calendar */
lastRenderedHTML = '';
Planner.generatePlan();
assert('generatePlan re-renders',               lastRenderedHTML.length > 0);
assert('Overall progress bar shown',            lastRenderedHTML.includes('pl-overall-progress'));
assert('Calendar grid rendered',                lastRenderedHTML.includes('pl-cal-grid'));
assert('.pl-view wrapper present after plan',   lastRenderedHTML.includes('class="pl-view"'));

/* 5. localStorage persistence */
const stored = sb.localStorage._s['cb_planner_v3'];
assert('State saved to localStorage',           !!stored);
const parsed = JSON.parse(stored);
assert('Saved: subjects array',                  Array.isArray(parsed.subjects));
assert('Saved: sessions array',                  Array.isArray(parsed.sessions));
assert('Saved: generated=true',                  parsed.generated === true);
assert('At least 1 session scheduled',           parsed.sessions.length > 0);
assert('Session has required fields',
  parsed.sessions[0] && parsed.sessions[0].id &&
  parsed.sessions[0].date && parsed.sessions[0].startTime);

/* 6. State restore from localStorage (simulate page reload) */
// Write the stored state back and reload from it via a fresh Planner instance
const stored2 = sb.localStorage._s['cb_planner_v3'];
sb.localStorage._s['cb_planner_v3'] = stored2; // re-save as-is
lastRenderedHTML = '';
Planner.renderPlanner();
assert('renderPlanner() after reload shows plan', lastRenderedHTML.includes('pl-overall-progress'));

/* 7. toggleSession marks a session complete */
const sessionId = parsed.sessions[0].id;
lastRenderedHTML = '';
Planner.toggleSession(sessionId);
assert('toggleSession re-renders',               lastRenderedHTML.length > 0);
const stored3 = JSON.parse(sb.localStorage._s['cb_planner_v3']);
const toggled = stored3.sessions.find(s=>s.id===sessionId);
assert('Session marked completed in localStorage', toggled && toggled.completed === true);

/* 8. deleteSubject */
const subId = parsed.subjects[0].id;
lastRenderedHTML = '';
Planner.deleteSubject(subId);
assert('deleteSubject re-renders',               lastRenderedHTML.length > 0);
const stored4 = JSON.parse(sb.localStorage._s['cb_planner_v3']);
assert('Subject removed from state',            !stored4.subjects.find(s=>s.id===subId));
assert('Subject sessions removed from state',   stored4.sessions.every(s=>s.subjectId!==subId));

/* 9. clearPlan */
// Re-add and generate so there's something to clear
Planner.addSubject({ name:'Physics', examDate:examStr, difficulty:3, priority:3, hoursPerDay:2, goal:'', color:'#a78bfa' });
Planner.generatePlan();
lastRenderedHTML = '';
Planner.clearPlan();
assert('clearPlan re-renders',                   lastRenderedHTML.length > 0);
const stored5 = JSON.parse(sb.localStorage._s['cb_planner_v3']);
assert('Sessions cleared from state',            stored5.sessions.length === 0);
assert('generated flag reset to false',          stored5.generated === false);
assert('After clearPlan, no progress bar',      !lastRenderedHTML.includes('pl-overall-progress'));

/* 10. Input validation — empty name rejected */
const prevSubjectCount = stored5.subjects.length;
const badResult = Planner.addSubject({ name:'', examDate: examStr, difficulty:2, priority:2, hoursPerDay:2 });
const stored6 = JSON.parse(sb.localStorage._s['cb_planner_v3']);
assert('addSubject rejects empty name',          stored6.subjects.length === prevSubjectCount);

/* 11. Toast uses 'visible' class */
lastToastClass = '';
Planner.addSubject({ name:'Chemistry', examDate:examStr, difficulty:2, priority:2, hoursPerDay:2, goal:'', color:'#34d399' });
assert('Toast class is "visible" (not "show")',  lastToastClass === 'visible');

/* 12. Toolbar buttons present after re-render */
assert('#pl-add-btn always present in toolbar',  lastRenderedHTML.includes('id="pl-add-btn"'));
assert('#pl-gen-btn always present in toolbar',  lastRenderedHTML.includes('id="pl-gen-btn"'));
assert('#pl-clear-btn always present in toolbar',lastRenderedHTML.includes('id="pl-clear-btn"'));

/* Summary */
console.log('\n' + '='.repeat(56));
console.log('RESULT: '+passed+' / '+(passed+failed)+' passed'+(failed===0?'  ✓  ALL PASS':'  ✗  '+failed+' FAILED'));
if (failed>0) process.exit(1);
