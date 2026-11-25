import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberedLogin, rememberAuthenticated, generateLoginCode, initLoginCode } from '../public/rpg/login.js';
const storage=values=>{const data=new Map(Object.entries(values));return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
const controls=()=>({codeInput:{value:''},codeHint:{textContent:''},newCodeBtn:{},passwordInput:{value:'',focus(){this.focused=true;}}});
test('opening login restores the exact saved code, including leading zeroes',()=>{
 const mem=storage({imperiumCode:'00123',imperiumName:'Марк'}),ui=controls();initLoginCode(ui,mem);
 assert.equal(ui.codeInput.value,'00123');assert.equal(rememberedLogin(mem).name,'Марк');assert.match(ui.codeHint.textContent,/Код виден/);
});
test('missing code is explained and no new account is generated automatically',()=>{
 const mem=storage({}),ui=controls();initLoginCode(ui,mem);assert.equal(ui.codeInput.value,'');assert.match(ui.codeHint.textContent,/Сохранённого кода нет/);assert.equal(mem.getItem('imperiumCode'),null);
});
test('editing or generating a code cannot overwrite the last authenticated code',()=>{
 const mem=storage({imperiumCode:'12345'}),ui=controls();initLoginCode(ui,mem);ui.codeInput.value='99999';ui.codeInput.oninput();assert.equal(mem.getItem('imperiumCode'),'12345');
 ui.passwordInput.value='old-password';ui.newCodeBtn.onclick();assert.match(ui.codeInput.value,/^\d{5}$/);assert.equal(ui.passwordInput.value,'');assert(ui.passwordInput.focused);assert.equal(mem.getItem('imperiumCode'),'12345');
 rememberAuthenticated(mem,'99999');assert.equal(mem.getItem('imperiumCode'),'99999');
});
test('guest login clears stale named code and unavailable browser storage is tolerated',()=>{
 const mem=storage({imperiumCode:'12345'});rememberAuthenticated(mem,null);assert.equal(mem.getItem('imperiumCode'),null);
 assert.deepEqual(rememberedLogin(undefined),{name:'',code:''});assert.doesNotThrow(()=>rememberAuthenticated(undefined,'12345'));assert.doesNotThrow(()=>initLoginCode(controls(),undefined));
});
test('code generation retains zeroes and rejects biased random tail',()=>{
 const sequence=[4294967295,7];assert.equal(generateLoginCode({getRandomValues(a){a[0]=sequence.shift();return a;}}),'00007');assert.equal(sequence.length,0);
});
