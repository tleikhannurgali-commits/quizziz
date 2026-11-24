/* Settings for independent answer-bank extension */
'use strict';
const $=id=>document.getElementById(id);
let savedKey='';
function preview(){
 const v=Math.max(0,Math.min(100,Number($('visibility').value)||0));
 $('percent').textContent=v+'%';
 $('preview').style.outline=`1.5px solid rgba(68,196,143,${(.8*v/100).toFixed(3)})`;
 $('preview').style.backgroundColor=`rgba(59,172,127,${(.11*v/100).toFixed(3)})`;
}
$('visibility').addEventListener('input',preview);
async function load(){
 try{
  const s=await browser.storage.local.get(['autoSolve','highlightVisibility','semanticAI','geminiKey','geminiModel']);
  $('autoSolve').checked=s.autoSolve!==false;
  $('semanticAI').checked=s.semanticAI!==false;
  $('visibility').value=Number.isFinite(s.highlightVisibility)?s.highlightVisibility:50;
  $('model').value=s.geminiModel||'gemini-3.1-flash-lite';
  savedKey=String(s.geminiKey||'');
  if(savedKey)$('apiKey').placeholder='Ключ уже сохранён — введи новый для замены';
  preview();
 }catch(_){$('message').textContent='Не удалось прочитать настройки';}
}
$('save').addEventListener('click',async()=>{
 const model=$('model').value.trim();
 if(!/^[\w./-]{3,100}$/.test(model)){$('message').textContent='Проверь название модели';return;}
 try{
  const newKey=$('apiKey').value.trim();
  await browser.storage.local.set({autoSolve:$('autoSolve').checked,semanticAI:$('semanticAI').checked,
   geminiModel:model,geminiKey:newKey||savedKey,highlightVisibility:Math.max(0,Math.min(100,Number($('visibility').value)))});
  if(newKey){savedKey=newKey;$('apiKey').value='';$('apiKey').placeholder='Ключ уже сохранён — введи новый для замены';}
  $('message').textContent='✓ Сохранено. На открытой странице изменения применятся автоматически.';
 }catch(_){$('message').textContent='Ошибка сохранения';}
});
load();
