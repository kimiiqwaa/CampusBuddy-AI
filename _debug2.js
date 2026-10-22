'use strict';
const fs=require('fs'),vm=require('vm');
function makeEl(id){return {id:id||'',className:'',textContent:'',_innerHTML:'',value:'',checked:false,style:{},dataset:{},min:'',max:'',classList:{add:()=>{},remove:()=>{},toggle:()=>{},contains:()=>false},setAttribute:()=>{},getAttribute:()=>null,removeAttribute:()=>{},addEventListener:()=>{},appendChild:()=>{},remove:()=>{},querySelectorAll:()=>{const a=[];a.forEach=()=>{};return a;},querySelector:()=>null,get innerHTML(){return this._innerHTML;},set innerHTML(v){this._innerHTML=v;},focus:()=>{},reset:()=>{},click:()=>{}};}
let lr='';
const pve=Object.assign(makeEl('planner-view'),{get innerHTML(){return lr;},set innerHTML(v){lr=v;},querySelectorAll:()=>{const a=[];a.forEach=()=>{};return a;},querySelector:()=>null});
let tc='', toastText='';
const te=Object.assign(makeEl('toast'),{
  get textContent(){return toastText;},
  set textContent(v){toastText=v;},
  classList:{add:(c)=>{tc=c; console.log('  [TOAST] add class:', c, '| text:', toastText);}, remove:()=>{}}
});
const sb={window:{},console,confirm:()=>true,setTimeout:(fn)=>{try{fn&&fn();}catch(e){}},clearTimeout:()=>{},setInterval:()=>{},clearInterval:()=>{},Date,Math,JSON,RegExp,parseInt,parseFloat,isNaN,isFinite,String,Number,Boolean,Array,Object,Promise,fetch:()=>Promise.resolve({ok:false}),localStorage:{_s:{},getItem(k){return this._s[k]||null},setItem(k,v){this._s[k]=String(v)}},document:{getElementById:(id)=>{if(id==='planner-view')return pve;if(id==='toast')return te;return makeEl(id);},querySelector:()=>null,querySelectorAll:()=>{const a=[];a.forEach=()=>{};return a;},addEventListener:()=>{},createElement:()=>makeEl(),head:{appendChild:()=>{}},body:{appendChild:()=>{}}}};
sb.window=sb;vm.createContext(sb);
vm.runInContext(fs.readFileSync('planner.js','utf8'),sb,{filename:'planner.js'});
const P=sb.Planner;
const fd=new Date();fd.setDate(fd.getDate()+14);
P.init();
console.log('--- addSubject ---');
P.addSubject({name:'Test',examDate:fd.toISOString().slice(0,10),difficulty:2,priority:2,hoursPerDay:2,goal:'',color:'#60a5fa'});
console.log('toast class:', JSON.stringify(tc));
