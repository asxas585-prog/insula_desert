// Личный код — идентификатор; пароль и гостевой секрет здесь не сохраняются.
export function rememberedLogin(storage) {
  try { const code=storage.getItem('imperiumCode')||''; return {name:storage.getItem('imperiumName')||'',code:/^\d{5}$/.test(code)?code:''}; }
  catch { return {name:'',code:''}; }
}
export function rememberAuthenticated(storage, code) {
  try { if (/^\d{5}$/.test(code||'')) storage.setItem('imperiumCode',code); else storage.removeItem('imperiumCode'); } catch {}
}
export function generateLoginCode(random=globalThis.crypto) {
  // Отбрасывание остатка исключает смещение при переводе в пять цифр.
  const word=new Uint32Array(1), limit=Math.floor(4294967296/100000)*100000;
  do { random.getRandomValues(word); } while(word[0]>=limit);
  return String(word[0]%100000).padStart(5,'0');
}
export function initLoginCode({codeInput,codeHint,newCodeBtn,passwordInput},storage) {
  codeInput.value=rememberedLogin(storage).code;
  const hint=()=>{ codeHint.textContent=codeInput.value ? 'Код виден цифрами. Введите пароль этого персонажа; для нового кода задайте свой пароль.' : 'Сохранённого кода нет. Для прежнего персонажа введите его 5 цифр. Новый код создаёт отдельного персонажа. Без кода — вход в гостевого персонажа этого браузера.'; };
  codeInput.oninput=hint;
  newCodeBtn.onclick=()=>{codeInput.value=generateLoginCode();passwordInput.value='';hint();passwordInput.focus();};
  hint();
}
