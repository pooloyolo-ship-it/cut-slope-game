'use strict';
const fmt=n=>n.toFixed(3),ratioFmt=n=>n.toFixed(2);
const $=id=>document.getElementById(id);
let problem=problems[0],steps=[],currentStep=0,results=[],complete=false;
const storageKey='cut-slope-progress-assembly-v1';
let cleared=new Set();
function loadProgress(){try{const data=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(data))cleared=new Set(data.filter(id=>problems.some(p=>p.id===id)));}catch{$('save-status').textContent='進捗保存を利用できません。この画面を開いている間は進捗を保持します。';}}
function saveProgress(){try{localStorage.setItem(storageKey,JSON.stringify([...cleared]));}catch{$('save-status').textContent='進捗を保存できませんでした。この画面を開いている間は進捗を保持します。';}}
function renderSelection(){
 $('selection-list').innerHTML=['初級','中級','上級'].map(level=>{
 const list=problems.filter(p=>p.level===level),done=list.every(p=>cleared.has(p.id));
 return `<section class="panel"><h2>${level}${done?` <span class="clear-label">${level}クリア</span>`:''}</h2><div class="question-buttons">${list.map(p=>`<button type="button" data-problem="${p.id}">${cleared.has(p.id)?'✓':'○'} 問題${p.number}<span>${p.title}</span></button>`).join('')}</div></section>`;
 }).join('');
 $('selection-list').querySelectorAll('[data-problem]').forEach(b=>b.addEventListener('click',()=>selectProblem(b.dataset.problem)));
}
function selectProblem(id){problem=problems.find(p=>p.id===id);$('selection').hidden=true;$('game').hidden=false;resetGame();}
function renderConditions(){
 $('question-position').textContent=`${problem.level} ${problem.number}/3`;
 $('problem-title').textContent=problem.title;
 const rows=[['掘削計画高',`EL=${fmt(problem.excavationElevation)}m`],['センター',`X=${fmt(problem.centerX)}m / 現況EL=${fmt(groundElevation(problem,problem.centerX))}m`]];
 problem.sides.forEach(side=>{
 rows.push([side.name+'側掘削幅',`${fmt(side.width)}m`],[side.name+'幅杭',`X=${fmt(side.stakeX)}m / 現況EL=${fmt(groundElevation(problem,side.stakeX))}m`]);
 rows.push([side.name+'水平板',Number.isFinite(side.boardEL)?`EL=${fmt(side.boardEL)}m（確定）`:'組立フェーズで設定します']);
 side.designSegments.forEach((s,i)=>rows.push([`${side.name} ${i+1}区間`,s.type==='berm'?`小段幅 ${fmt(s.width)}m`:`法勾配1：${ratioFmt(s.ratio)}${s.rise!=null?' / 鉛直高さ '+fmt(s.rise)+'m':''}`]));
 });
 rows.push(['現況地盤点',problem.groundPoints.map(g=>`(${fmt(g.x)}, ${fmt(g.el)})`).join(' → ')]);
 $('conditions').innerHTML=rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
 $('ground-description').textContent=problem.groundPoints.length===2?'現況地盤は指定の2点を結ぶ直線です。幅杭より外側にも同じ直線を延長します。':'現況地盤は指定点を結ぶ折れ線です。両端では端の区間を外側へ延長します。';
}
// 入力・判定・再回答の流れは既存版を維持。STEP定義のみ問題データから取得する。
function displayValue(kind,value){return kind==='ratio'?`1：${ratioFmt(value)}`:`${fmt(value)}m`;}
function renderStep(){
 const s=steps[currentStep],passed=results[currentStep]?.passed;
 $('step-number').textContent=`前半 STEP ${currentStep+1} / 11`;
 $('step-title').textContent=complete?'水平板での切出し位置まで、設置の考え方を確認できました。':s.title;
 $('step-fields').innerHTML=complete?'':s.fields.map(f=>`<label for="${f.key}">${f.label}<span class="input-wrap">${f.kind==='ratio'?'<span class="ratio-prefix">1：</span>':''}<input id="${f.key}" type="number" step="${f.kind==='ratio'?'0.01':'0.001'}" placeholder="未入力" aria-describedby="error tolerance" ${passed?'disabled':''} value="${results[currentStep]?.items.find(i=>i.key===f.key)?.value??''}">${f.kind==='ratio'?'':'<span>m</span>'}</span></label>`).join('');
 $('tolerance').textContent=complete?'全STEP正解で100点です。':`配点 ${s.score}点 · 許容誤差 ±${s.fields[0].tolerance}${s.fields[0].kind==='ratio'?'':'m'}`;
 $('judge').hidden=complete||passed;$('next').hidden=complete||!passed;
 $('next').textContent=currentStep===steps.length-1?'丁張組立ゲームへ →':'次のSTEPへ →';
 $('progress').innerHTML=steps.map((s,i)=>`<span class="${results[i]?.passed?'done':i===currentStep?'active':''}" ${i===currentStep&&!complete?'aria-current="step"':''}>${results[i]?.passed?'✓':'○'} STEP ${i+1}</span>`).join('');
 $('score-value').textContent=Math.round(calculateScore(results)+assemblyScore());
 const levelDone=problems.filter(p=>p.level===problem.level).every(p=>cleared.has(p.id));
 $('level-clear').hidden=!complete||!levelDone;$('level-clear').textContent=problem.level+'クリア';
}
function renderResults(){
 $('result').hidden=!results.some(Boolean);
 $('result-list').innerHTML=results.map((r,index)=>r?`<article class="result-item"><div class="panel-heading"><h3>STEP ${index+1} · ${r.passed?'正解':'もう一度考えましょう'}</h3><b>${r.score} / ${steps[index].score}点</b></div>${r.items.map(i=>`<div class="answer-row"><b>${i.label}</b><span>あなた：${displayValue(i.kind,i.value)}</span><span>正解：${displayValue(i.kind,i.correct)}</span><span>誤差：${i.difference<0?'−':'+'}${Math.abs(i.difference).toFixed(i.kind==='ratio'?2:3)}${i.kind==='ratio'?'':'m'}</span></div>`).join('')}<p>${steps[index].explanation}</p></article>`:'').join('');
}
function submitStep(e){
 e.preventDefault();if(complete||results[currentStep]?.passed)return;
 const s=steps[currentStep],values=Object.fromEntries(s.fields.map(f=>[f.key,$(f.key).value]));
 const r=s.fields.some(f=>$(f.key).validity.badInput)?{error:'入力値を確認してください。'}:judgeAnswer(s,values);
 $('error').textContent=r.error||'';if(r.error)return;
 results[currentStep]=r;
 renderStep();renderResults();drawCrossSection();
 $('step-message').textContent=r.passed?(complete?'全STEP正解です。100点で丁張イメージが完成しました。':'正解です。下の解説を確認し、次のSTEPへ進んでください。'):'許容誤差を超えています。下の正解・解説を確認して、再回答してください。';
}
function resetGame(){problem=createAttempt(problem);steps=makeSteps(problem);currentStep=0;results=[];complete=false;resetAssembly();$('error').textContent='';$('step-message').textContent='';renderConditions();renderStep();renderResults();drawCrossSection();}
let view;
// 実座標で計算し、描画時だけY反転。同じscaleで法勾配を保つ。
function worldToScreenX(x){return 70+(x-view.minX)*view.scale;}
function worldToScreenY(el){return 440-(el-view.minEL)*view.scale;}
function line(x1,y1,x2,y2,cls){return `<line x1="${worldToScreenX(x1)}" y1="${worldToScreenY(y1)}" x2="${worldToScreenX(x2)}" y2="${worldToScreenY(y2)}" class="${cls}"/>`;}
function textAt(x,y,text,extra=''){return `<text x="${x}" y="${y}" class="diagram-label" ${extra}>${text}</text>`;}
function mark(point,label,cls='base-dot'){return `<circle cx="${worldToScreenX(point.x)}" cy="${worldToScreenY(point.el)}" r="5" class="${cls}"/>`+textAt(worldToScreenX(point.x)+7,worldToScreenY(point.el)+20,label);}
function drawCutSlope(side,index){
 const groundCut=findGroundIntersection(problem,side),cut=Number.isFinite(side.boardEL)?getBoardCutout(problem,side):groundCut,segments=buildDesignSegments(problem,side);
 let svg='';
 for(const s of segments){
  const end=s.end||groundCut;
  svg+=line(s.start.x,s.start.el,end.x,end.el,s.type==='berm'?'excavation-line':'board-slope-line');
  // 地盤より板が高い場合は同じ勾配の延長も描き、板との交点を見せる。
  if(!s.end&&cut.el>groundCut.el)svg+=line(groundCut.x,groundCut.el,cut.x,cut.el,'board-slope-extension');
  if(s.end){
   const isStart=segments[s.index+1]?.type==='berm';
   const label=s.type==='berm'?'小段終了':isStart?'小段開始':'勾配変化点';
   svg+=`<circle cx="${worldToScreenX(s.end.x)}" cy="${worldToScreenY(s.end.el)}" r="5" class="base-dot"/>`;
   svg+=textAt(worldToScreenX(s.end.x)+(isStart?-8:8),worldToScreenY(s.end.el)+(isStart?-14:24),label,isStart?'text-anchor="end"':'');
  }
 }
 return svg;
}
function drawWidthStake(side){
 const x=worldToScreenX(side.stakeX),y=worldToScreenY(groundElevation(problem,side.stakeX));
 return `<g class="width-stake"><path d="M${x},${y+8} V${y-20} M${x-6},${y-20} H${x+6}" class="survey-stake"/></g>`+textAt(x,y-30,side.name+'幅杭','text-anchor="middle"');
}
function drawCrossSection(){
 const toes=problem.sides.map(s=>getToePosition(problem,s)),cuts=problem.sides.flatMap(s=>[findGroundIntersection(problem,s),{x:s.stakeX,el:groundElevation(problem,s.stakeX)}]);
 const points=[{x:problem.centerX,el:groundElevation(problem,problem.centerX)},...toes,...cuts,...problem.groundPoints];
 const minX=Math.min(...points.map(p=>p.x))-1,maxX=Math.max(...points.map(p=>p.x))+3;
 const minEL=problem.excavationElevation-1,maxEL=Math.max(...points.map(p=>p.el))+2;
 view={minX,minEL,scale:Math.min(600/(maxX-minX),350/(maxEL-minEL))};
 const right=minX+600/view.scale,top=minEL+350/view.scale;
 const tick=Math.max(1,Math.ceil(Math.max(right-minX,top-minEL)/10));
 let svg='<title>現況地盤と計画法面の横断図</title><defs><clipPath id="plot"><rect x="70" y="90" width="600" height="350"/></clipPath></defs>';
 for(let x=Math.ceil(minX/tick)*tick;x<=right;x+=tick)svg+=line(x,minEL,x,top,'grid')+`<text x="${worldToScreenX(x)}" y="460" class="tick" text-anchor="middle">${x}</text>`;
 for(let el=Math.ceil(minEL/tick)*tick;el<=top;el+=tick)svg+=line(minX,el,right,el,'grid')+`<text x="55" y="${worldToScreenY(el)+4}" class="tick" text-anchor="end">${el}</text>`;
 svg+='<text x="25" y="55" class="axis-title">高さ EL (m)</text><text x="430" y="490" class="axis-title">センターからの距離 X (m)</text><g clip-path="url(#plot)">';
 for(const g of getGroundSegments(problem)){const x1=Math.max(minX,g.min),x2=Math.min(right,g.max);if(x1<x2)svg+=line(x1,g.a*x1+g.b,x2,g.a*x2+g.b,'ground-line');}
 svg+='</g>';
 const left=Math.min(problem.centerX,...toes.map(p=>p.x)),end=Math.max(problem.centerX,...toes.map(p=>p.x));
 svg+=line(left,problem.excavationElevation,end,problem.excavationElevation,'excavation-line');
 problem.sides.forEach((s,i)=>{svg+=mark(toes[i],s.name+'法尻')+drawCutSlope(s,i)+drawWidthStake(s);});
 const cx=worldToScreenX(problem.centerX),cy=worldToScreenY(groundElevation(problem,problem.centerX));
 svg+=`<path id="center-stake" d="M${cx} ${cy+8} V${cy-18}" class="survey-stake"/>`+textAt(cx+8,cy-33,'センター');
 $('cross-section').innerHTML=svg;
 $('drawing-status').textContent='幅杭は外側の固定基準点です。前半の計算を終えたら、下の組立画面で杭・水平板・法板を設置します。';
 $('completion').hidden=true;$('completion').innerHTML='';
}
function init(){document.getElementById('reset-game').addEventListener('click',resetGame);loadProgress();renderSelection();initAssembly();$('placement-form').addEventListener('submit',submitStep);$('next').addEventListener('click',()=>{if(!results[currentStep]?.passed||complete)return;if(currentStep===steps.length-1){startAssembly();return;}currentStep++;$('error').textContent='';$('step-message').textContent='';renderStep();$(steps[currentStep].fields[0].key).focus();});$('reset').addEventListener('click',resetGame);$('back-selection').addEventListener('click',()=>{$('game').hidden=true;$('selection').hidden=false;renderSelection();});}
init();



