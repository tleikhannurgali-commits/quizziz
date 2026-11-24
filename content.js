/* nur1k_2§ v1.0.4 — robust public-question matcher; no hidden keys. */
(() => {
  'use strict';
  if (window.__nur1k2SectionLoaded) return;
  window.__nur1k2SectionLoaded = true;

  const normalize = str => String(str || '').replace(/\s+/g, ' ').trim();
  const text = el => normalize(el?.innerText || el?.textContent || '');
  const excluded = /^(back|next|previous|home|start|skip|submit|join|menu|settings|sound|close|share|report|play|bonus|hint|check|continue|назад|далее|отправить|пропустить|начать|настройки|келесі|артқа)$/i;
  const MAX_OPTIONS = 12;
  let lastReadOptions = [];
  let targetElements = [];
  let targetQuestion = '';
  let targetQuestionElement = null;
  let highlightSnapshot = null;
  const savedStyles = new Map();

  function visible(el,extended=false) {
    if(!el || !el.isConnected || el.closest('#nur1k-2-section-root') || el.closest('[inert],[aria-hidden="true"]')) return false;
    const style=getComputedStyle(el),r=el.getBoundingClientRect();
    if(style.visibility==='hidden'||style.display==='none'||Number(style.opacity)<=.05)return false;
    // Wayground puts the last answer below the phone viewport. Do not drop it:
    // DOM presence/geometry are checked, but extended scan covers one scroll pane.
    const reach=extended?Math.min(innerHeight*1.8,1400):0;
    return r.width>=45&&r.height>=18&&r.bottom> -reach && r.top<innerHeight+reach &&
      r.right>0 && r.left<innerWidth;
  }

  // On the results screen Wayground shows a large dialog over earlier questions.
  // Prefer that active dialog over the dimmed background; otherwise the scanner
  // can mistakenly read a different question or the header "Question 6".
  function activeReviewLayer() {
    const selectors='[role="dialog"],[aria-modal="true"],dialog,[class*="modal"],[class*="Modal"],[class*="drawer"],[class*="Drawer"],[class*="sheet"],[class*="Sheet"]';
    let best=null, bestScore=-Infinity;
    for(const el of document.querySelectorAll(selectors)){
      if(!visible(el))continue;
      const r=el.getBoundingClientRect(),t=text(el);
      if(r.width<innerWidth*.45 || r.height<180 || t.length<50 || t.length>14000)continue;
      const review=/\b(?:question|вопрос)\s*\d+\b/i.test(t) || /правильные ответы|ваш ответ|your answer|correct answers?/i.test(t);
      if(!review)continue;
      // Prefer the actual sheet over huge wrapper/backdrop containers.
      const score=100-(r.width*r.height)/(innerWidth*innerHeight)*20 + Math.min(10,r.top/innerHeight*10);
      if(score>bestScore){best=el;bestScore=score;}
    }
    if(best)return best;
    // Some mobile Wayground result sheets have no dialog role or modal class.
    // Locate the smallest large ancestor of the visible "Question N" header.
    for(const h of document.querySelectorAll('h1,h2,h3,span,div,p')){
      if(!visible(h)||!/^(?:question|вопрос)\s*#?\s*\d+$/i.test(text(h)))continue;
      let a=h.parentElement;
      for(let depth=0;a&&depth<9;depth++,a=a.parentElement){
        if(a===document.body||a===document.documentElement)break;
        const r=a.getBoundingClientRect(),t=text(a);
        if(r.width<innerWidth*.52||r.height<240||t.length<50||t.length>9000)continue;
        if(!/ваш ответ|правильные ответы|your answer|correct answer|pts|сч[её]т/i.test(t))continue;
        const area=(r.width*r.height)/(innerWidth*innerHeight);
        const score=80-Math.min(65,area*13)+(r.top>=0?5:0)+(getComputedStyle(a).position==='fixed'?14:0);
        if(score>bestScore){best=a;bestScore=score;}
        // A smaller ancestor containing the review content is preferred.
        break;
      }
    }
    return best;
  }
  function cleanChoice(value) {
    // Labels in completed-question review cards are not part of the answer.
    let t=normalize(value).replace(/[✓✔✅]/gu,'').trim();
    const label=/^(?:(?:ваш(?:и)? ответ(?:ы)?|правильн(?:ый|ые) ответ(?:ы)?|верн(?:ый|ые) ответ(?:ы)?|your answer|correct answer(?:s)?|дұрыс жауап(?:тар)?|сіздің жауабыңыз)\s*[:：]?\s*)+/i;
    for(let i=0;i<3;i++){
      const next=t.replace(label,'').trim();
      if(next===t)break;
      t=next;
    }
    return t;
  }
  function extract() {
    const layer=activeReviewLayer();
    const inLayer=el=>!layer||layer.contains(el);
    const found=[];
    const selector='button,[role="button"],[role="radio"],[role="checkbox"],label,[data-testid*="option"],[data-testid*="answer"],[data-testid*="choice"],[data-cy*="option"],[class*="option"],[class*="Option"],[class*="answer"],[class*="Answer"],[class*="choice"],[class*="Choice"]';
    const collect=(selector,max=180)=>{
      for(const el of document.querySelectorAll(selector)){
        if(found.length>=max)break;
        if(!inLayer(el)||!visible(el,true)||el.closest('nav,header,footer,[role="navigation"],form[role="search"]'))continue;
        const t=cleanChoice(text(el)),r=el.getBoundingClientRect();
        if(selector.startsWith('li,div') && el.matches('[data-testid*="question"],[class*="question"],[class*="Question"],[role="heading"],h1,h2,h3'))continue;
        if(!t||t.length>230||excluded.test(t)||/^(?:ваш(?:и)? ответ(?:ы)?|правильн(?:ый|ые) ответ(?:ы)?|correct answers?|your answer)$/i.test(t)||/^(?:question|вопрос|сұрақ)\s*#?\s*\d+\b/i.test(t)||
          /^(?:\d+(?:\.\d+)?\s*s|\d+\s*\/\s*\d+\s*pts|сч[её]т\s*[:：]?\s*\d+)$/i.test(t)||
          r.height>Math.max(230,innerHeight*.42)||r.width<Math.min(90,innerWidth*.24))continue;
        found.push({el,t,r});
      }
    };
    collect(selector);
    // Some Wayground review cards are plain DIVs with no answer/option class.
    // Only try this fallback inside the isolated dialog, never over the whole page.
    if(found.length<3){
      // Structural fallback: mobile Wayground often uses plain DIV answer rows.
      // In review mode it is confined to the identified result sheet.
      collect('li,div,[role="option"]',420);
    }
    if(found.length<2)throw new Error('Не вижу вариантов ответа. Открой вопрос или обзор результатов.');
    const items=found.filter(a=>{
      const nestedControls=a.el.querySelectorAll('button,[role="button"],[role="checkbox"],[role="radio"],input[type="checkbox"],input[type="radio"]');
      if(nestedControls.length>=2)return false;
      const nested=found.filter(b=>b!==a&&a.el.contains(b.el) && b.t && b.t!==a.t);
      // A box containing two independently placed answer rows is a group,
      // not a selectable answer itself.
      if(new Set(nested.map(b=>b.t)).size>=2 &&
         new Set(nested.map(b=>Math.round(b.r.top/12))).size>=2)return false;
      return !found.some(b=>b!==a&&a.el.contains(b.el)&&b.t===a.t);
    });
    const groups=new Map();
    for(const item of items){
      let ancestor=item.el;
      for(let level=1;level<=4;level++){
        ancestor=ancestor?.parentElement;
        if(!ancestor||ancestor===document.body||ancestor===document.documentElement)break;
        if(layer && !layer.contains(ancestor))break;
        const arr=groups.get(ancestor)||[];arr.push(item);groups.set(ancestor,arr);
      }
    }
    let best=null,bestScore=-Infinity;
    for(const group of groups.values()){
      const unique=[],seen=new Set();
      for(const item of group){if(seen.has(item.t))continue;seen.add(item.t);unique.push(item);}
      if(unique.length<2||unique.length>MAX_OPTIONS)continue;
      if(!unique.some(x=>x.r.bottom>0&&x.r.top<innerHeight))continue;
      const meanWidth=unique.reduce((sum,x)=>sum+x.r.width,0)/unique.length;
      const sameSize=unique.filter(x=>x.r.width>=meanWidth*.62).length;
      const semantic=unique.filter(x=>x.el.matches('[role="radio"],[role="checkbox"],button,[class*="option"],[class*="Option"],[class*="answer"],[class*="Answer"]')).length;
      const maxY=Math.max(...unique.map(x=>x.r.bottom));
      const minY=Math.min(...unique.map(x=>x.r.top));
      const sameColumn=unique.filter(x=>Math.abs(x.r.left-unique[0].r.left)<28).length;
      const score=Math.min(unique.length,6)*9+sameSize*6+semantic*4+
        sameColumn*3+(maxY-minY>=60?8:0)+(meanWidth>innerWidth*.4?10:0)
        -Math.max(0,unique.length-6)*13;
      if(score>bestScore){best=unique;bestScore=score;}
    }
    if(!best)throw new Error('Не удалось определить группу вариантов ответа.');
    best.sort((a,b)=>a.r.top-b.r.top||a.r.left-b.r.left);
    const firstY=Math.min(...best.map(x=>x.r.top));
    const qSelectors='[data-testid*="question"],[class*="questionText"],[class*="question-text"],h1,h2,h3,[role="heading"],[class*="question"],p,div,span,section,article';
    let qText='',qElement=null,topScore=-Infinity;
    for(const el of document.querySelectorAll(qSelectors)){
      if(!inLayer(el)||!visible(el,true)||best.some(x=>el.contains(x.el)))continue;
      const t=text(el),r=el.getBoundingClientRect();
      if(t.length<10||t.length>420||r.top>=firstY||r.bottom>firstY+6)continue;
      // Ignore the numbered review header and score/time boxes.
      if(/^(?:question|вопрос|сұрақ)\s*#?\s*\d+\b/i.test(t)||
         /\b(?:pts|сч[её]т)\b/i.test(t) && t.length<80||
         /^(?:ваш ответ|правильные ответы|your answer)$/i.test(t))continue;
      const gap=Math.max(0,firstY-r.bottom);
      const cyrillic=/[а-яәғқңөұүһіё]/i.test(t)?18:-8;
      const likely=/[?？]|қаған|түр[іик]|тайпа|мемлекет|орда|кім|жыл|себеб|бағын|орналас|жүйес/i.test(t)?12:0;
      const semantic=/question/i.test(String(el.className))?9:el.matches('h1,h2,h3,[role="heading"]')?3:0;
      const score=cyrillic+likely+semantic+Math.min(t.length,140)/8-gap*.12;
      if(score>topScore){topScore=score;qText=t;qElement=el;}
    }
    if(!qText)throw new Error('Вопрос не распознан. Открой его полностью в обзоре.');
    const context=[qText,text(qElement?.parentElement).slice(0,520)].join(' ');
    const saysMultiple=/select\s+(?:all|multiple|more than one|two|three|[2-9])|choose\s+(?:all|multiple|two|three|[2-9])|pick\s+(?:two|three|[2-9])|more than one|multiple answers?|нескольк(?:о|их)\s+(?:правильн(?:ых)?\s+)?ответ|выбер(?:и|ите)\s+(?:все|два|три|[2-9])|два и более|бірнеше\s+жауап|барлық дұрыс/i.test(context);
    const checkboxes=best.some(x=>x.el.matches('[role="checkbox"],input[type="checkbox"]')||!!x.el.querySelector('[type="checkbox"],[role="checkbox"]'));
    const radios=best.some(x=>x.el.matches('[role="radio"],input[type="radio"]')||!!x.el.querySelector('[type="radio"],[role="radio"]'));
    const multiGroup=best.some(x=>x.el.closest('[aria-multiselectable="true"]'));
    const detectedMode=saysMultiple||checkboxes||multiGroup?'multiple':radios?'single':'auto';
    targetElements=best.map(x=>x.el);targetQuestion=qText;targetQuestionElement=qElement;lastReadOptions=best.map(x=>x.t);
    return {question:qText,options:best.map(x=>x.t),mode:detectedMode};
  }

  // Liquid Glass panel lives in a closed shadow root. Page CSS cannot override its controls.
  const host = document.createElement('div');
  host.id = 'nur1k-2-section-root';
  const shadow = host.attachShadow({mode:'closed'});
  const style = document.createElement('style');
  style.textContent = `
    :host {all:initial;position:fixed;z-index:2147483647;top:auto;left:auto;right:12px;bottom:18px;pointer-events:none;color:#f7f3ff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;line-height:1.45;width:min(330px,calc(100vw - 20px));}
    *{box-sizing:border-box}
    button{font-family:inherit;-webkit-tap-highlight-color:transparent;cursor:pointer}
    #panel{pointer-events:auto;position:relative;width:min(330px,calc(100vw - 20px));max-height:min(82dvh,680px);overflow:auto;overscroll-behavior:contain;padding:13px;border-radius:25px;border:1px solid rgba(235,223,255,.49);color:#f6f0ff;
      background:linear-gradient(140deg,rgba(174,164,205,.30) 0%,rgba(81,75,110,.75) 23%,rgba(33,29,49,.85) 67%,rgba(108,97,144,.64) 100%);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -1px 0 rgba(244,231,255,.11),0 16px 45px rgba(23,15,43,.47),0 2px 9px rgba(16,13,29,.30);
      backdrop-filter:blur(22px) saturate(146%);-webkit-backdrop-filter:blur(22px) saturate(146%);
      transition:opacity .32s cubic-bezier(.22,.8,.22,1),transform .42s cubic-bezier(.16,1,.3,1),visibility 0s;transform-origin:82% 85%;}
    #panel::before{content:'';position:absolute;pointer-events:none;inset:1px 1px auto 1px;height:54px;border-radius:24px 24px 44% 44%;background:linear-gradient(180deg,rgba(255,255,255,.18),transparent)}
    #row{position:relative;display:flex;align-items:center;gap:7px;min-height:38px;touch-action:none;user-select:none}
    .brand{font-size:13px;font-weight:800;letter-spacing:-.3px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab;touch-action:none;text-shadow:0 1px 8px #16122480}
    .ctrl{width:34px;height:34px;flex:none;display:grid;place-items:center;border-radius:12px;border:1px solid #e8dcff3d;color:#fcf9ff;background:linear-gradient(145deg,#ffffff28,#ffffff09);font-size:17px;transition:transform .22s cubic-bezier(.2,.8,.2,1),background .24s ease;box-shadow:inset 0 1px #fff2}
    .ctrl:active,.pill:active,#solve:active{transform:scale(.96)}
    #toolbar{position:relative;display:flex;gap:7px;margin-top:12px}
    .pill{flex:1;min-height:34px;padding:7px 6px;border-radius:11px;border:1px solid #d9c9fc2e;color:#e8defa;background:#ffffff14;font-weight:680;font-size:11px;transition:background .25s,transform .22s,color .25s}
    .pill.on{background:linear-gradient(140deg,#bbaffc49,#a295df40);border-color:#d9ccff70;color:white}
    #solve{position:relative;width:100%;min-height:45px;margin-top:11px;border-radius:14px;border:1px solid #e9deffc4;color:#231b34;background:linear-gradient(125deg,#e5dafe,#b5a4e9 56%,#a99bce);font-weight:840;font-size:15px;box-shadow:inset 0 1px #ffffffa8,0 7px 18px #20133c55;transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .25s,opacity .25s}
    #solve:disabled{opacity:.58;cursor:progress}
    #status{display:none;margin-top:9px;padding:9px 11px;border:1px solid #ffffff20;border-radius:11px;background:#ffffff0d;color:#e6dffa;white-space:normal;overflow-wrap:anywhere;font-size:12px}
    #result{display:none;margin-top:9px;padding:11px;border:1px solid #f1eaff29;border-radius:15px;background:linear-gradient(150deg,#ffffff16,#b6a9dd12);box-shadow:inset 0 1px #fff1;max-height:36vh;overflow:auto;overflow-wrap:anywhere;font-size:12px;color:#eee5fd}
    #result strong{display:block;color:#fff;font-size:13px;margin-bottom:5px}
    .result-meta{margin-top:7px;color:#c9bbd8;font-size:11px}
    .model-item{margin-top:8px;border-top:1px solid #f0e6ff21;padding-top:7px}
    .model-name{font-size:11px;font-weight:800;color:#daccff}
    .model-answer{color:#dbf7e6;font-size:11px}
    .result-btn{margin:8px 8px 0 0;padding:8px 9px;border-radius:9px;border:1px solid #e9dafa40;color:#ece3fc;background:#ffffff17;font-weight:680;font-size:11px}
    #hint{font-size:10px;color:#cfc3dcae;text-align:center;margin:8px 0 0;line-height:1.4}
    #visibilityBar{position:relative;margin-top:12px;padding:10px 11px 9px;border:1px solid #eee0ff29;border-radius:14px;background:linear-gradient(125deg,#ffffff0c,#b1a0db0d)}
    #visibilityLabel{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#dbd0f5;font-size:11px;font-weight:660}
    #visibilityPercent{font-variant-numeric:tabular-nums;color:#f4ecff}
    #visibilityRange{display:block;width:100%;margin:9px 0 3px;accent-color:#b7a8ff;touch-action:auto;cursor:pointer}
    #visibilityBar small{display:block;font-size:10px;color:#baaace}
    #launcher{position:absolute;top:0;left:0;pointer-events:none;visibility:hidden;opacity:0;display:grid;place-items:center;width:55px;height:55px;border-radius:50%;border:1px solid #f0e9ff7b;color:#fff;font-size:25px;user-select:none;touch-action:none;
      background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.42),transparent 52%),linear-gradient(145deg,rgba(173,158,210,.80),rgba(58,49,84,.87));
      box-shadow:inset 0 2px 1px #fffa,inset 0 -1px 0 #fff2,0 8px 23px #21172e96;backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);
      transform:scale(.66) translateY(5px);transition:opacity .28s ease,transform .44s cubic-bezier(.16,1,.3,1),visibility 0s linear .3s;}
    #launcher::after{position:absolute;content:'';top:8px;right:8px;width:7px;height:7px;border-radius:50%;opacity:0;transition:opacity .3s ease,background .3s ease;pointer-events:none;background:#d3e2ee}
    #launcher[data-state="working"]::after{opacity:.88;animation:ql-pulse 1.8s ease-in-out infinite}
    #launcher[data-state="ready"]::after{opacity:.86;background:#a9e6c9}
    #launcher[data-state="warning"]::after{opacity:.86;background:#efd49c}
    #launcher[data-state="error"]::after{opacity:.86;background:#f3afbd}
    @keyframes ql-pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:.95;transform:scale(1.14)}}
    :host(.collapsed){width:55px;height:55px}
    :host(.collapsed) #panel{position:absolute;visibility:hidden;pointer-events:none;opacity:0;transform:translateY(13px) scale(.88);transition:opacity .25s ease,transform .35s cubic-bezier(.2,.8,.2,1),visibility 0s linear .33s}
    :host(.collapsed) #launcher{visibility:visible;opacity:.56;pointer-events:auto;transform:scale(1) translateY(0);transition:opacity .32s ease,transform .42s cubic-bezier(.16,1,.3,1),visibility 0s}
    :host(.collapsed) #launcher:active{opacity:.86}
    @media(max-width:420px){#panel{width:min(295px,calc(100vw - 20px))}}
    @media(prefers-reduced-motion:reduce){#panel,#launcher,#launcher::after,.ctrl,.pill,#solve{transition:none!important;animation:none!important}}
  `;
  shadow.appendChild(style);
  const launcher = document.createElement('button'); launcher.id='launcher'; launcher.type='button'; launcher.textContent='✦';
  const panel = document.createElement('section'); panel.id='panel';
  const row = document.createElement('div'); row.id='row';
  const brand = document.createElement('span'); brand.className='brand'; brand.textContent='✦ nur1k_2§';
  const settingsBtn = document.createElement('button'); settingsBtn.className='ctrl'; settingsBtn.type='button'; settingsBtn.textContent='⚙'; settingsBtn.title='Настройки';
  const hideBtn = document.createElement('button'); hideBtn.className='ctrl'; hideBtn.type='button'; hideBtn.textContent='−'; hideBtn.title='Свернуть';
  row.append(brand, settingsBtn, hideBtn);
  const toolbar = document.createElement('div'); toolbar.id='toolbar';
  const autoBtn = document.createElement('button'); autoBtn.className='pill'; autoBtn.type='button'; autoBtn.textContent='Авто: выкл';
  const bankBadge=document.createElement('span');bankBadge.className='pill on';bankBadge.textContent='База: 30';bankBadge.style.textAlign='center';
  const quickDiag=document.createElement('button');quickDiag.className='pill';quickDiag.type='button';quickDiag.textContent='Диаг.';quickDiag.title='Скопировать считанный вопрос и варианты';
  toolbar.append(autoBtn,bankBadge,quickDiag);
  const solve = document.createElement('button');solve.id='solve';solve.type='button';solve.textContent='✦ Найти ответ';
  const visibilityBar = document.createElement('div');visibilityBar.id='visibilityBar';
  const visibilityLabel = document.createElement('label');visibilityLabel.id='visibilityLabel';visibilityLabel.htmlFor='visibilityRange';
  const visibilityText = document.createElement('span');visibilityText.textContent='Видимость обводки';
  const visibilityPercent = document.createElement('span');visibilityPercent.id='visibilityPercent';visibilityPercent.textContent='50%';
  visibilityLabel.append(visibilityText,visibilityPercent);
  const visibilityRange = document.createElement('input');visibilityRange.id='visibilityRange';visibilityRange.type='range';
  visibilityRange.min='0';visibilityRange.max='100';visibilityRange.step='5';visibilityRange.value='50';
  visibilityRange.setAttribute('aria-label','Видимость подсветки ответа');
  const visibilityHelp = document.createElement('small');visibilityHelp.textContent='0% — скрыта · 100% — заметная';
  visibilityBar.append(visibilityLabel,visibilityRange,visibilityHelp);
  const status = document.createElement('div');status.id='status';status.setAttribute('role','status');
  const result = document.createElement('div');result.id='result';
  const hint = document.createElement('div');hint.id='hint';hint.textContent='30 записей • локальный поиск по смысловым формулировкам и вариантам.';
  panel.append(row,toolbar,solve,visibilityBar,status,result,hint);
  shadow.append(launcher,panel);
  (document.body || document.documentElement).append(host);

  quickDiag.addEventListener('click',async()=>{
    let p,why='';
    try{p=extract();}catch(err){why=err?.message||'Не удалось прочитать страницу';}
    const data=['nur1k_2§ 1.0.4','URL: '+location.origin+location.pathname,
      'Вопрос: '+(p?.question||targetQuestion||'не найден'),
      'Варианты: '+(p?.options||lastReadOptions).map((v,i)=>(i+1)+'. '+v).join(' | '),
      'Ошибка чтения: '+(why||'нет')].join('\n');
    try{await navigator.clipboard.writeText(data);showStatus('Диагностика скопирована — пришли текст в чат.');}
    catch(_){result.replaceChildren();const area=document.createElement('textarea');area.value=data;area.readOnly=true;
      area.rows=6;area.style.cssText='width:100%;font-size:11px;color:#231d33;';result.append(area);result.style.display='block';
      area.focus();area.select();showStatus('Скопируй выделенную диагностику вручную.');}
  });

  const config = {autoSolve:true,highlightVisibility:50};
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  let lastAutoSignature='';
  let autoTimer=0;
  let autoBusy=false;
  let currentRun=0;
  let activeRequestId='';
  let expanded=true;
  function setState(name) {
    launcher.dataset.state=name;
    const descriptions={
      working:'Поиск в базе',ready:'Подсказка найдена',
      warning:'Нужно проверить совпадение',error:'Ошибка поиска',idle:'Открыть nur1k_2§'
    };
    launcher.title=descriptions[name]||descriptions.idle;
    launcher.setAttribute('aria-label',launcher.title);
  }
  function showStatus(message,error=false) {
    status.textContent=message||'';
    status.style.display=message?'block':'none';
    status.style.color=error?'#ffd0db':'#e6dffa';
  }
  function refreshToggles() {
    autoBtn.textContent=config.autoSolve?'Авто: вкл':'Авто: выкл';
    autoBtn.classList.toggle('on',config.autoSolve);
    hint.textContent=config.autoSolve?'Автопоиск активен — панель можно свернуть':'Нажми «Найти ответ» или включи Авто.';
  }
  function updateVisibilityControl() {
    visibilityRange.value=String(config.highlightVisibility);
    visibilityPercent.textContent=String(config.highlightVisibility)+'%';
  }
  let visibilitySaveTimer=0;
  visibilityRange.addEventListener('input',()=>{
    config.highlightVisibility=clamp(Number(visibilityRange.value)||0,0,100);
    updateVisibilityControl();
    for(const el of savedStyles.keys())if(el.isConnected)applyHighlightStyle(el);
    clearTimeout(visibilitySaveTimer);
    visibilitySaveTimer=setTimeout(()=>{
      browser.storage.local.set({highlightVisibility:config.highlightVisibility}).catch(()=>{});
    },180);
  });
  function highlightOpacity() {
    const v=clamp(Number(config.highlightVisibility)||0,0,100)/100;
    return {border:(.80*v).toFixed(3),fill:(.11*v).toFixed(3),inset:(.20*v).toFixed(3)};
  }
  function clearHighlights() {
    for (const [el,original] of savedStyles.entries()) {
      if (!el.isConnected) continue;
      for (const [prop,value] of Object.entries(original)) {
        if(value.value) el.style.setProperty(prop,value.value,value.priority);
        else el.style.removeProperty(prop);
      }
    }
    savedStyles.clear();
    highlightSnapshot=null;
  }
  function saveStyle(el,prop) {return {value:el.style.getPropertyValue(prop),priority:el.style.getPropertyPriority(prop)};}
  function applyHighlightStyle(el) {
    if (config.highlightVisibility === 0) {
      const original=savedStyles.get(el);
      if(original)for(const [prop,value] of Object.entries(original)){
        if(value.value)el.style.setProperty(prop,value.value,value.priority);
        else el.style.removeProperty(prop);
      }
      return;
    }
    const a=highlightOpacity();
    el.style.setProperty('outline',`1.5px solid rgba(68,196,143,${a.border})`,'important');
    el.style.setProperty('outline-offset','-1px','important');
    el.style.setProperty('box-shadow',`inset 0 0 0 1px rgba(111,223,166,${a.inset})`,'important');
    el.style.setProperty('background-color',`rgba(59,172,127,${a.fill})`,'important');
    el.style.setProperty('transition','outline-color .38s ease,box-shadow .38s ease,background-color .38s ease','important');
  }
  function highlight(indices,snapshot) {
    clearHighlights();
    const props=['outline','outline-offset','box-shadow','background-color','transition'];
    let applied=0;
    for (const i of new Set(indices)) {
      const el=snapshot.elements[i];
      if (!el?.isConnected) continue;
      const old={}; for (const p of props) old[p]=saveStyle(el,p);
      savedStyles.set(el,old);applyHighlightStyle(el);applied++;
    }
    if(applied) highlightSnapshot=snapshot;
    return applied;
  }
  function sameQuestion(snapshot) {
    return !!(snapshot?.questionElement?.isConnected &&
      text(snapshot.questionElement)===snapshot.question &&
      snapshot.elements.length===snapshot.texts.length &&
      snapshot.elements.every((el,i)=>el.isConnected && cleanChoice(text(el))===snapshot.texts[i]));
  }
  function makeSnapshot(payload) {
    return {question:payload.question,questionElement:targetQuestionElement,texts:[...payload.options],elements:[...targetElements]};
  }
  function makeSignature(payload) {
    return JSON.stringify([payload.question,payload.options,payload.mode]);
  }
  const positionKeys={panel:'qlPanelPosition',bubble:'qlBubblePosition'};
  let positionReq=0;
  function place(x,y,which) {
    const el=which==='panel'?panel:launcher;
    host.style.left=clamp(x,4,innerWidth-el.offsetWidth-4)+'px';
    host.style.top=clamp(y,4,innerHeight-el.offsetHeight-4)+'px';
    host.style.right='auto';host.style.bottom='auto';
  }
  async function restorePosition(which) {
    const request=++positionReq;
    try {
      const key=positionKeys[which];
      const settings=await browser.storage.local.get(key);
      if(request!==positionReq)return;
      const pos=settings[key];
      if(pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) place(pos.left,pos.top,which);
      else {host.style.left='auto';host.style.top='auto';host.style.right='12px';host.style.bottom='18px';}
    } catch (_) {}
  }
  function collapse(collapsed) {
    if(expanded===!collapsed)return;
    expanded=!collapsed;
    host.classList.toggle('collapsed',collapsed);
    browser.storage.local.set({qlCollapsed:collapsed}).catch(()=>{});
    restorePosition(collapsed?'bubble':'panel');
  }
  hideBtn.addEventListener('click',()=>collapse(true));
  let suppressBubbleClick=false;
  launcher.addEventListener('click',e=>{
    if(suppressBubbleClick){e.preventDefault();suppressBubbleClick=false;return;}
    collapse(false);
  });
  settingsBtn.addEventListener('click',()=>{
    browser.runtime.sendMessage({type:'QL_SETTINGS'}).catch(()=>showStatus('Настройки можно открыть в меню расширений Firefox',true));
  });
  function installDrag(handle,which) {
    const isPanel=which==='panel';
    let drag=null;
    const point=e=>e.touches?e.touches[0]:e;
    function down(e) {
      if(isPanel && e.target.closest('button'))return;
      if(drag || (e.pointerType==='mouse' && e.button!==0))return;
      if(e.touches && e.touches.length!==1)return;
      const p=point(e), rect=(isPanel?panel:launcher).getBoundingClientRect();
      if(!p)return;
      drag={id:e.pointerId,x:p.clientX,y:p.clientY,left:rect.left,top:rect.top,moved:false};
      if(e.pointerId!==undefined)try{handle.setPointerCapture(e.pointerId);}catch(_){}
    }
    function move(e) {
      if(!drag||(e.pointerId!==undefined&&drag.id!==undefined&&e.pointerId!==drag.id))return;
      const p=point(e);if(!p)return;
      const dx=p.clientX-drag.x,dy=p.clientY-drag.y;
      if(!drag.moved && Math.hypot(dx,dy)<7)return;
      drag.moved=true;place(drag.left+dx,drag.top+dy,which);
      if(e.cancelable)e.preventDefault();
    }
    function up(e) {
      if(!drag||(e.pointerId!==undefined&&drag.id!==undefined&&e.pointerId!==drag.id))return;
      if(drag.moved){
        if(!isPanel){suppressBubbleClick=true;setTimeout(()=>{suppressBubbleClick=false;},450);}
        const rect=(isPanel?panel:launcher).getBoundingClientRect();
        browser.storage.local.set({[positionKeys[which]]:{left:rect.left,top:rect.top}}).catch(()=>{});
      }
      drag=null;
    }
    if(window.PointerEvent){
      handle.addEventListener('pointerdown',down);handle.addEventListener('pointermove',move);
      handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
    } else {
      handle.addEventListener('touchstart',down,{passive:true});
      handle.addEventListener('touchmove',move,{passive:false});
      handle.addEventListener('touchend',up);handle.addEventListener('touchcancel',up);
      handle.addEventListener('mousedown',down);window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
    }
  }
  installDrag(row,'panel');installDrag(launcher,'bubble');
  window.addEventListener('resize',()=>{
    if(host.style.left && host.style.left!=='auto') {
      const mode=expanded?'panel':'bubble';
      const rect=(expanded?panel:launcher).getBoundingClientRect();
      place(rect.left,rect.top,mode);
    }
  });
  setState('idle');

  const make = (tag,className,content) => {
    const el=document.createElement(tag);if(className)el.className=className;
    if(content!=null)el.textContent=content;
    return el;
  };
  function displayResult(data) {
    result.replaceChildren();
    result.append(make('strong','',data.selectedIndices?.length?'✦ Совпадение найдено':'◇ Нет надёжного совпадения'));
    result.append(make('div','',data.summary||'Нужна проверка.'));
    if(data.bankQuestion) result.append(make('div','result-meta','В базе: '+data.bankQuestion));
    if(data.bankAnswers?.length) result.append(make('div','result-meta','Записанные ответы: '+data.bankAnswers.join(' / ')));
    if(data.matchMethod) result.append(make('div','result-meta','Поиск: '+({bank_exact:'точный, локально',bank_fuzzy:'по похожему вопросу и вариантам, локально',bank_ai:'по смыслу, Gemini'}[data.matchMethod]||data.matchMethod)));
    if(data.selectedIndices?.length)result.append(make('div','result-meta','Подходящие варианты: '+data.selectedIndices.map(i=>i+1).join(', ')+(data.questionType==='multiple'?' · Несколько ответов':'')));
    result.append(make('div','result-meta','Считан вопрос: '+targetQuestion));
    if(!data.selectedIndices?.length) result.append(make('div','result-meta','Варианты: '+(lastReadOptions||[]).join(' | ')));
    if(data.explanation)result.append(make('div','result-meta',data.explanation));
    if(data.suggestions?.length){
      result.append(make('div','result-meta','Ближайшие записи: '+data.suggestions.map(x=>'№'+x.id+' ('+Math.round(x.score*100)+'%)').join(', ')));
    }
    if(Number.isFinite(data.totalMs))result.append(make('div','result-meta','Время: '+(data.totalMs/1000).toFixed(2)+' с'));
    const clear=make('button','result-btn','Убрать подсветку');
    clear.addEventListener('click',()=>{clearHighlights();setState('idle');showStatus('Подсветка убрана');});
    result.append(clear);
    const diagnostic=make('button','result-btn','📋 Скопировать диагностику');
    diagnostic.addEventListener('click',async()=>{
      const dataText=['nur1k_2§ 1.0.4','URL: '+location.origin+location.pathname,
        'Вопрос: '+targetQuestion,'Варианты: '+lastReadOptions.map((v,i)=>(i+1)+'. '+v).join(' | '),
        'Определённая запись: '+(data.matchedId??'нет'),
        'Кандидаты: '+(data.suggestions||[]).map(x=>'#'+x.id+' '+x.score+' '+x.question).join(' || '),
        'Режим: '+(data.matchMethod||data.agreement||'?'),
        'Причина: '+(data.explanation||data.summary||'')].join('\n');
      try{
        await navigator.clipboard.writeText(dataText);
        showStatus('Диагностика скопирована. Пришли её в чат — без API-ключей.');
      }catch(_){
        const area=make('textarea','',dataText);area.readOnly=true;area.rows=5;area.style.cssText='width:100%;font-size:11px;color:#231d33;border-radius:7px;';
        result.append(area);area.focus();area.select();
        showStatus('Выделил диагностику. Скопируй текст вручную.');
      }
    });
    result.append(diagnostic);result.style.display='block';
  }
  async function runSolve(trigger) {
    const manual=trigger==='manual';
    let payload,snapshot,signature;
    try {
      payload=extract();snapshot=makeSnapshot(payload);signature=makeSignature(payload);
    } catch(err) {
      if(manual){setState('error');showStatus(err?.message||'Не удалось распознать вопрос',true);}
      return;
    }
    if(!manual && (!config.autoSolve || signature===lastAutoSignature))return;
    if(!manual)lastAutoSignature=signature;
    const run=++currentRun;
    const requestId='ql-'+Date.now().toString(36)+'-'+run;
    activeRequestId=requestId;
    clearHighlights();
    result.style.display='none';result.replaceChildren();
    setState('working');
    showStatus('Сопоставляю текст вопроса и варианты с базой…');
    solve.disabled=true;
    if(!manual)autoBusy=true;
    try {
      const response=await browser.runtime.sendMessage({type:'QL_SOLVE',payload,requestId});
      if(run!==currentRun)return;
      if(!response?.ok)throw new Error(response?.error||'Ошибка поиска');
      if(!sameQuestion(snapshot)) {
        setState('idle');showStatus('Вопрос изменился во время анализа — результат не подсвечен');
        return;
      }
      const data=response.result||{};
      const applied=data.selectedIndices?.length?highlight(data.selectedIndices,snapshot):0;
      setState(applied?'ready':'warning');
      showStatus(applied?'Найдено вариантов: '+applied+' · '+(data.matchMethod==='bank_ai'?'через Gemini':'локально'):(data.matchedId?'Сходный вопрос есть в базе; открой панель и проверь варианты.':'Не найдено совпадение. Открой панель и скопируй диагностику.'));
      displayResult(data);
    } catch(err) {
      if(run!==currentRun)return;
      setState('error');showStatus(err?.message||'Не получилось получить подсказку',true);
    } finally {
      if(run===currentRun){solve.disabled=false;autoBusy=false;activeRequestId='';}
    }
  }
  function scheduleAuto() {
    if(!config.autoSolve)return;
    clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>runSolve('auto'),600);
  }
  autoBtn.addEventListener('click',()=>{
    config.autoSolve=!config.autoSolve;refreshToggles();
    browser.storage.local.set({autoSolve:config.autoSolve}).catch(()=>{});
    if(config.autoSolve){lastAutoSignature='';scheduleAuto();showStatus('Автоанализ включён');}
    else {clearTimeout(autoTimer);showStatus('Автоанализ выключен');}
  });
  solve.addEventListener('click',()=>runSolve('manual'));

  let changeTimer=0;
  const observer=new MutationObserver(()=>{
    clearTimeout(changeTimer);
    changeTimer=setTimeout(()=>{
      if(savedStyles.size && !sameQuestion(highlightSnapshot)){
        clearHighlights();setState('idle');result.style.display='none';
        showStatus(config.autoSolve?'Новый вопрос — запускаю автоанализ':'Новый вопрос — нажми Solve');
      }
      scheduleAuto();
    },360);
  });
  observer.observe(document.body || document.documentElement,{subtree:true,childList:true,characterData:true});
  window.addEventListener('pageshow',scheduleAuto);
  window.addEventListener('popstate',scheduleAuto);
  window.addEventListener('hashchange',scheduleAuto);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleAuto();});
  browser.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes.autoSolve){config.autoSolve=!!changes.autoSolve.newValue;refreshToggles();if(config.autoSolve){lastAutoSignature='';scheduleAuto();}else clearTimeout(autoTimer);}
    if(changes.highlightVisibility){
      config.highlightVisibility=clamp(Number(changes.highlightVisibility.newValue)||0,0,100);
      updateVisibilityControl();
      for(const el of savedStyles.keys())if(el.isConnected)applyHighlightStyle(el);
    }
  });
  browser.storage.local.get(['qlCollapsed','autoSolve','highlightVisibility']).then(x=>{
    config.autoSolve=x.autoSolve!==false;
    config.highlightVisibility=Number.isFinite(x.highlightVisibility)?clamp(x.highlightVisibility,0,100):50;
    updateVisibilityControl();refreshToggles();
    if(x.qlCollapsed){expanded=false;host.classList.add('collapsed');restorePosition('bubble');}
    else restorePosition('panel');
    scheduleAuto();
  }).catch(()=>{refreshToggles();restorePosition('panel');});
})();
