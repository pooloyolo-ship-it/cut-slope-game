'use strict';
let assemblyStates=[],assemblyIndex=0,assemblyActive=false,assemblyView=null,assemblyDrag=null;
const assemblyPoints={3:5,4:5,5:10,6:10,7:10,8:10,9:5,10:5};
function newAssemblyState(){return {stage:3,posts:[],armed:false,attached:false,boardEL:null,locked:false,cutSolved:false,distanceSolved:false,pointX:null,pointPassed:false,slopeAttached:false,ratio:null,done:[],finished:false,message:'「丁張杭を打つ」を押し、地盤をクリック・タップしてください。'};}
function resetAssembly(){assemblyStates=problem.sides.map(()=>newAssemblyState());assemblyIndex=0;assemblyActive=false;assemblyDrag=null;$('assembly-panel').hidden=true;$('calculation-panel').hidden=false;$('assembly-finals').innerHTML='';}
function assemblyScore(){return assemblyStates.reduce((sum,a)=>sum+a.done.reduce((v,s)=>v+(assemblyPoints[s]||0),0),0)/Math.max(1,assemblyStates.length);}
function activeAssembly(){return assemblyStates[assemblyIndex];}
function activeSide(){return problem.sides[assemblyIndex];}
function startAssembly(){assemblyActive=true;$('assembly-panel').hidden=false;$('calculation-panel').hidden=true;renderAssembly();$('assembly-panel').scrollIntoView({behavior:'auto',block:'start'});}
function awardAndAdvance(stage,message){const a=activeAssembly();if(!a.done.includes(stage))a.done.push(stage);a.stage=stage+1;a.message=message;renderAssembly();renderStep();}
function assemblyMessage(message){activeAssembly().message=message;$('assembly-feedback').textContent=message;}
function previousAssemblyStep(){
 const a=activeAssembly(),target=a.stage-1;
 // 配置・入力は下書きとして残し、戻ったSTEP以降だけ再確認する。
 a.done=a.done.filter(stage=>stage<target);a.finished=false;complete=false;
 a.armed=false;a.movingPost=null;
 if(target<=9)a.slopeAttached=false;
 if(target<=8)a.pointPassed=false;
 if(target<=7)a.distanceSolved=false;
 if(target<=6)a.cutSolved=false;
 if(target<=5){a.locked=false;delete activeSide().boardEL;}
 if(target<=4)a.attached=false;
 a.stage=Math.max(3,target);
 a.message=`STEP ${a.stage}に戻りました。残っている入力・配置を修正して進めてください。`;
 if(target===2){
  assemblyActive=false;currentStep=1;
  if(results[1])results[1]={...results[1],passed:false,score:0};
  $('assembly-panel').hidden=true;$('calculation-panel').hidden=false;
  $('error').textContent='';$('step-message').textContent='STEP 2に戻りました。入力値を修正して再判定できます。';
  renderResults();
 }
 renderAssembly();renderStep();renderConditions();drawCrossSection();renderFinalAssemblies();
}
function renderAssembly(){
 const a=activeAssembly(),s=activeSide(),range=getBoardRange(problem,s);
 const titles={3:'丁張杭を2本打つ',4:'水平板を取り付ける',5:'水平板ELを設定する',6:'水平板上の切出し位置Xを求める',7:'幅杭から法板取付点までの距離を求める',8:'水平板上に法板取付点を設置する',9:'法板を取り付ける',10:'法勾配 1:n を設定する',11:'丁張完成判定'};
 $('assembly-title').textContent=`後半 STEP ${a.stage} / 11 · ${s.name}側 — ${titles[a.stage]}`;
 $('assembly-feedback').textContent=a.message;
 $('assembly-score').textContent=`獲得 ${Math.round(calculateScore(results)+assemblyScore())} / 100点`;
 $('assembly-instructions').textContent={3:'設置エリア内の地盤を2か所選びます。杭は地盤から鉛直に立ちます。位置は一意の正解ではありません。',4:'設置した2本の杭をまたぐ水平板を取り付けます。',5:`水平板を上下にドラッグしてください。許容範囲 EL=${fmt(range.min)}～${fmt(range.max)}m（付近の地盤EL=${fmt(range.groundEL)}mの0.10～0.50m上）。0.01m単位で調整できます。`,6:'現在設定した水平板ELにおける切出し位置は、センターから何mの位置でしょう？左側のXは負の値です。',7:'水平板上の切出し位置は、幅杭から何mでしょう？',8:'水平板をクリック・タップして点を設置します。点のXと幅杭からの距離を見て、左右ボタンで0.01m・0.001mずつ微調整できます。',9:'法板は、あなたが設置した法板取付点を通るように取り付けます。',10:'法勾配の水平値nを入力すると、法板の傾きがリアルタイムに変わります。',11:'杭・水平板・高さ・計算・点・法板・法勾配をまとめて確認します。'}[a.stage];
 const button=(action,text)=>`<button type="button" data-action="${action}">${text}</button>`;
 let controls='';
 if(a.stage===3)controls=(a.posts.length<2?button('arm',a.armed?'地盤を選択中…':'丁張杭を打つ'):'')+a.posts.map((x,i)=>button(`move-post-${i}`,`杭${i+1}の位置を修正`)).join('')+button('undo','最後の杭を戻す')+(a.posts.length===2?button('posts-confirm','2本の杭で進む'):'');
 if(a.stage===4)controls=button('attach-board','水平板を取り付ける');
 if(a.stage===5)controls=button('board-down','EL −0.01m')+button('board-up','EL ＋0.01m')+button('lock','この高さに決定');
 if(a.stage===6||a.stage===7)controls=`<label>${a.stage===6?'X':'幅杭からの距離'}<span class="input-wrap"><input id="assembly-answer" type="number" step="0.001" placeholder="未入力"><span>m</span></span></label><button type="submit" class="primary">判定する</button>`;
 if(a.stage===8)controls='<div class="point-adjustments">'+button('point-left','← 0.01m')+button('point-right','→ 0.01m')+button('point-left-mm','← 0.001m')+button('point-right-mm','→ 0.001m')+'</div>'+button('check-point','点を判定する');
 if(a.stage===9)controls=button('attach-slope','法板を取り付ける');
 if(a.stage===10)controls=`<label>法勾配<span class="input-wrap"><span class="ratio-prefix">1：</span><input id="assembly-ratio" type="number" min="0" step="0.01" placeholder="未入力" value="${Number.isFinite(a.ratio)?a.ratio:''}"></span></label><button type="submit" class="primary">法勾配を設定する</button>`;
 if(a.stage===11)controls=a.finished?(assemblyIndex<problem.sides.length-1?button('next-side','次の側を組み立てる'):''):button('finish','丁張完成判定');
 $('assembly-controls').innerHTML=controls;
 if($('assembly-answer')){
  a.answers??={};$('assembly-answer').value=a.answers[a.stage]??'';
  $('assembly-answer').addEventListener('input',e=>{a.answers[a.stage]=e.target.value;});
 }
 $('assembly-ratio')?.addEventListener('input',()=>{const val=$('assembly-ratio').value;a.ratio=val===''?null:Number(val);renderAssemblyDrawing();});
 configureAssemblyView();renderAssemblyDrawing();
}
function configureAssemblyView(){
 const z=getAssemblyZone(problem,activeSide()),r=getBoardRange(problem,activeSide());
 const minX=z.min-.25,maxX=z.max+.25;
 const minEL=Math.min(groundElevation(problem,minX),groundElevation(problem,maxX),r.groundEL)-.35;
 const maxEL=Math.max(r.max+.45,groundElevation(problem,minX)+.6,groundElevation(problem,maxX)+.6);
 const scale=Math.min(650/(maxX-minX),290/(maxEL-minEL));
 assemblyView={minX,minEL,scale,width:650/scale,height:290/scale};
}
function ax(x){return 65+(x-assemblyView.minX)*assemblyView.scale;}
function ay(el){return 360-(el-assemblyView.minEL)*assemblyView.scale;}
function aLine(x1,y1,x2,y2,cls,more=''){return `<line x1="${ax(x1)}" y1="${ay(y1)}" x2="${ax(x2)}" y2="${ay(y2)}" class="${cls}" ${more}/>`;}
function boardExtent(){
 const a=activeAssembly(),s=activeSide(),r=getBoardRange(problem,s);
 const choices=[...a.posts,boardTargets(problem,s,r.min).x,boardTargets(problem,s,r.max).x];
 const margin=(getAssemblyZone(problem,s).max-getAssemblyZone(problem,s).min)*.04;
 return {min:Math.min(...choices)-margin,max:Math.max(...choices)+margin};
}
function renderAssemblyDrawing(){
 const a=activeAssembly(),s=activeSide(),r=getBoardRange(problem,s),z=getAssemblyZone(problem,s),v=assemblyView;
 if(!v)return;
 let svg='<title>操作して切土丁張を組み立てる拡大図</title>';
 for(let x=Math.ceil(v.minX*4)/4;x<v.minX+v.width;x+=.25)svg+=aLine(x,v.minEL,x,v.minEL+v.height,'grid')+`<text x="${ax(x)}" y="385" text-anchor="middle" class="tick">${x.toFixed(2)}</text>`;
 svg+='<text x="65" y="34" class="axis-title">高さEL・横方向X：実座標、縦横同縮尺</text><text x="480" y="413" class="axis-title">センターからの距離 X (m)</text>';
 if(a.stage===3)svg+=`<rect x="${ax(z.min)}" y="55" width="${(z.max-z.min)*v.scale}" height="305" class="placement-zone"/>`;
 const gs=getGroundSegments(problem);
 for(const g of gs){const lo=Math.max(v.minX,g.min),hi=Math.min(v.minX+v.width,g.max);if(lo<hi)svg+=aLine(lo,g.a*lo+g.b,hi,g.a*hi+g.b,'ground-line');}
 svg+=`<text x="${ax(v.minX+v.width)-8}" y="${ay(groundElevation(problem,v.minX+v.width))+22}" text-anchor="end" class="diagram-label">現況地盤</text>`;
 const wx=ax(s.stakeX),wy=ay(groundElevation(problem,s.stakeX));
 svg+=`<path d="M${wx} ${wy+9} V${wy-24} M${wx-7} ${wy-24} H${wx+7}" class="survey-stake fixed-width-stake"/><text x="${wx}" y="${wy+30}" text-anchor="middle" class="diagram-label">幅杭 X=${fmt(s.stakeX)}</text>`;
 a.posts.forEach((x,i)=>{const el=groundElevation(problem,x),top=Math.max(r.max+.15,el+.25);svg+=aLine(x,el-.08,x,top,'assembly-post')+`<text x="${ax(x)+6}" y="${ay(top)-7}" class="diagram-label">杭${i+1}</text>`;});
 if(a.attached){
  const b=boardExtent();
  svg+=aLine(b.min,a.boardEL,b.max,a.boardEL,'cross-horizontal-board');
  svg+=`<text x="${ax(b.min)}" y="${ay(a.boardEL)-12}" class="diagram-label">水平板</text>`;
  svg+=aLine(b.min,a.boardEL,b.max,a.boardEL,'board-hit','data-board="true"');
 }
 if(a.stage>=8&&Number.isFinite(a.pointX))svg+=`<g class="player-point"><circle cx="${ax(a.pointX)}" cy="${ay(a.boardEL)}" r="6"/><path d="M${ax(a.pointX)-10} ${ay(a.boardEL)} H${ax(a.pointX)+10} M${ax(a.pointX)} ${ay(a.boardEL)-10} V${ay(a.boardEL)+10}"/></g><text x="${ax(a.pointX)+9}" y="${ay(a.boardEL)+24}" class="diagram-label">法板取付点</text>`;
 if(a.slopeAttached){
  const valid=Number.isFinite(a.ratio)&&a.ratio>0;
  if(valid){const half=.45,dx=half*a.ratio/Math.hypot(1,a.ratio),dy=half/Math.hypot(1,a.ratio);svg+=aLine(a.pointX-s.direction*dx,a.boardEL-dy,a.pointX+s.direction*dx,a.boardEL+dy,'slope-board');}
  else svg+=`<circle cx="${ax(a.pointX)}" cy="${ay(a.boardEL)}" r="12" class="pending-slope"/>`;
  svg+=`<text x="${ax(a.pointX)+12}" y="${ay(a.boardEL)-28}" class="diagram-label">法板 1:${valid?ratioFmt(a.ratio):'未設定'}</text>`;
 }
 $('assembly-svg').innerHTML=svg;
 $('assembly-live').textContent=a.attached?`水平板 EL = ${fmt(a.boardEL)}m ${a.locked?'（確定）':'（調整中）'}`:'水平板は未設置です。';
 const t=a.locked?boardTargets(problem,s,a.boardEL):null;
 $('point-live').textContent=a.stage>=8&&Number.isFinite(a.pointX)?`点 X=${fmt(a.pointX)}m ／ 幅杭から${(s.stakeX-a.pointX)*s.direction>=0?'切土側':'外側'}へ${fmt(Math.abs(s.stakeX-a.pointX))}m`:(a.distanceSolved?`幅杭から${t.direction}へ${fmt(t.distance)}mに法板取付点を設置してください。`:'');
}
function adjustBoard(el){const a=activeAssembly(),r=getBoardRange(problem,activeSide());if(a.stage!==5||a.locked)return;a.boardEL=Math.round(Math.max(r.groundEL-.05,Math.min(r.max+.2,el))*100)/100;renderAssemblyDrawing();}
function tryPlacePost(x){
 const a=activeAssembly(),s=activeSide(),z=getAssemblyZone(problem,s);
 if(!a.armed||a.stage!==3)return;
 if(x<z.min||x>z.max){assemblyMessage('幅杭の近くの設置エリア内を選んでください。');return;}
 const moving=Number.isInteger(a.movingPost)&&a.movingPost<a.posts.length;
 if(a.posts.length>=2&&!moving){assemblyMessage('位置を変える杭の「位置を修正」を押してください。');return;}
 if(a.posts.some((p,i)=>(!moving||i!==a.movingPost)&&Math.abs(p-x)<z.minSeparation)){assemblyMessage('杭同士が近すぎます。画面上で間隔を広げてください。');return;}
 if(moving)a.posts[a.movingPost]=x;else a.posts.push(x);
 a.armed=false;a.movingPost=null;a.message=moving?'杭の位置を修正しました。':`${a.posts.length}本目の丁張杭を設置しました。`;renderAssembly();
}
function placePoint(x){const a=activeAssembly(),b=boardExtent();if(a.stage!==8||!Number.isFinite(x))return;
 // クリック位置・板端もmm格子へ揃え、表示と判定に同じ値を使う。
 const mm=Math.max(Math.ceil(b.min*1000),Math.min(Math.floor(b.max*1000),Math.round(x*1000)));
 a.pointX=mm/1000;a.pointPassed=false;renderAssemblyDrawing();}
function adjustPointMM(delta){const a=activeAssembly();if(Number.isFinite(a.pointX))placePoint((Math.round(a.pointX*1000)+delta)/1000);}
function handleAssemblyAction(action){
 const a=activeAssembly(),s=activeSide();
 if(action.startsWith('move-post-')&&a.stage===3){const i=Number(action.slice(10));if(Number.isInteger(i)&&i>=0&&i<a.posts.length){a.movingPost=i;a.armed=true;a.message=`杭${i+1}の新しい位置を地盤上で選んでください。`;renderAssembly();}}
 if(action==='arm'&&a.stage===3){a.movingPost=null;a.armed=true;a.message='地盤の位置をクリック・タップしてください。';renderAssembly();}
 if(action==='undo'&&a.stage===3){a.posts.pop();a.movingPost=null;a.armed=false;a.message='最後の杭を取り消しました。';renderAssembly();}
 if(action==='posts-confirm'&&a.stage===3){const error=validatePosts(problem,s,a.posts);if(error)return assemblyMessage(error);awardAndAdvance(3,'2本の丁張杭を設置しました。水平板を取り付けてください。');}
 if(action==='attach-board'&&a.stage===4){a.attached=true;if(!Number.isFinite(a.boardEL))a.boardEL=Math.floor(getBoardRange(problem,s).min*100)/100-.05;awardAndAdvance(4,'水平板を取り付けました。上下にドラッグして水平板ELを設定してください。');}
 if(action==='board-up')adjustBoard(a.boardEL+.01);
 if(action==='board-down')adjustBoard(a.boardEL-.01);
 if(action==='lock'&&a.stage===5){
  if(!boardHeightValid(problem,s,a.boardEL))return assemblyMessage('水平板ELが許容範囲外です。表示された範囲に調整してください。');
  if(a.posts.some(x=>groundElevation(problem,x)>=a.boardEL))return assemblyMessage('この高さでは杭位置の地盤に板が埋まります。高さを上げるか、「一つ前に戻す」でSTEP 3まで戻って杭を調整してください。');
  a.locked=true;s.boardEL=a.boardEL;awardAndAdvance(5,'水平板ELを確定しました。この高さの切出し位置Xを求めてください。');renderConditions();drawCrossSection();
 }
 if(action==='point-left')adjustPointMM(-10);
 if(action==='point-right')adjustPointMM(10);
 if(action==='point-left-mm')adjustPointMM(-1);
 if(action==='point-right-mm')adjustPointMM(1);
 if(action==='check-point'&&a.stage===8){const t=boardTargets(problem,s,a.boardEL),grade=pointGrade(t.x,a.pointX);if(grade!=='正解')return assemblyMessage(`${grade}：点の誤差は${Number.isFinite(a.pointX)?fmt(Math.abs(a.pointX-t.x))+'m':'未設置'}です。±0.03m以内に調整してください。`);a.pointPassed=true;awardAndAdvance(8,'法板取付点は正解です。法板を取り付けてください。');}
 if(action==='attach-slope'&&a.stage===9){a.slopeAttached=true;awardAndAdvance(9,'法板を取り付けました。法勾配を入力して設定してください。');}
 if(action==='finish'&&a.stage===11){
  if(!validateCompletion(problem,s,a))return assemblyMessage('完成条件が揃っていません。「一つ前に戻す」で戻って確認してください。');
  a.finished=true;a.message=`${s.name}側：切土丁張 完成！`;
  if(assemblyStates.every((state,i)=>validateCompletion(problem,problem.sides[i],state)&&state.finished)){
   complete=true;cleared.add(problem.id);saveProgress();a.message='切土丁張 完成！ 全ての条件を満たしました。';
  }
  renderAssembly();renderStep();renderFinalAssemblies();
 }
 if(action==='next-side'&&a.finished&&assemblyIndex<problem.sides.length-1){assemblyIndex++;renderAssembly();}
}
function submitAssembly(e){
 e.preventDefault();const a=activeAssembly(),s=activeSide();
 if(a.stage===6||a.stage===7){
  const input=$('assembly-answer');if(input.value===''||!Number.isFinite(Number(input.value)))return assemblyMessage('数値を入力してください。');
  const t=boardTargets(problem,s,a.boardEL),answer=a.stage===6?t.x:t.distance;
  if(Math.abs(Number(input.value)-answer)>.01+1e-9)return assemblyMessage(a.stage===6?boardExplanation(problem,{...s,boardEL:a.boardEL}):`幅杭からの距離は |${fmt(s.stakeX)} − ${fmt(t.x)}| = ${fmt(t.distance)}m。方向は${t.direction}です。`);
  if(a.stage===6){a.cutSolved=true;awardAndAdvance(6,'切出し位置は正解です。幅杭からの距離を求めてください。');}
  else {a.distanceSolved=true;awardAndAdvance(7,`正解です。幅杭から${t.direction}へ${fmt(t.distance)}mに法板取付点を設置してください。`);}
 }else if(a.stage===10){
  const t=boardTargets(problem,s,a.boardEL);if(!Number.isFinite(a.ratio)||a.ratio<=0||Math.abs(a.ratio-t.ratio)>.01+1e-9)return assemblyMessage(`法勾配を確認してください。取付点を通る区間の設計法勾配は1:${ratioFmt(t.ratio)}です。`);
  awardAndAdvance(10,'法勾配を設定しました。丁張完成判定をしてください。');
 }
}
function renderFinalAssemblies(){
 const previous=assemblyIndex;
 $('assembly-finals').innerHTML=assemblyStates.map((a,i)=>{if(!a.finished)return '';assemblyIndex=i;configureAssemblyView();renderAssemblyDrawing();const s=activeSide(),distance=Math.abs(s.stakeX-a.pointX),direction=(s.stakeX-a.pointX)*s.direction>=0?'切土側':'外側';return `<article class="panel"><h3>${s.name}側 最終丁張図</h3><p>水平板 EL=${fmt(a.boardEL)}m ／ 設置した法板取付点まで幅杭から${direction}へ${fmt(distance)}m ／ 法勾配 1:${ratioFmt(a.ratio)}</p><svg viewBox="0 0 800 440" role="img" aria-label="完成した丁張">${$('assembly-svg').innerHTML}</svg></article>`;}).join('');
 assemblyIndex=previous;configureAssemblyView();renderAssemblyDrawing();
}
function initAssembly(){
 const svg=$('assembly-svg');
 const fingers=new Map();
 let multiTouch=false,pendingTap=null,blockedClickUntil=0;
 function releaseDrag(restore=false){
  if(!assemblyDrag)return;
  const drag=assemblyDrag;assemblyDrag=null;
  if(restore)adjustBoard(drag.start);
  if(svg.hasPointerCapture(drag.id))svg.releasePointerCapture(drag.id);
 }
 // 2本目が図の外に入った場合も検知する。全指が離れるまでゲーム操作を再開しない。
 document.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;
  fingers.set(e.pointerId,{x:e.clientX,y:e.clientY,target:e.target,moved:false});
  if(fingers.size>1){multiTouch=true;blockedClickUntil=performance.now()+700;pendingTap=null;releaseDrag(true);}
 },true);
 document.addEventListener('pointermove',e=>{
  const f=fingers.get(e.pointerId);
  if(f&&Math.hypot(e.clientX-f.x,e.clientY-f.y)>10)f.moved=true;
 },true);
 document.addEventListener('pointerup',e=>{fingers.delete(e.pointerId);});
 document.addEventListener('pointercancel',e=>{fingers.delete(e.pointerId);pendingTap=null;releaseDrag();});
 // pointercancel後もブラウザのジェスチャーは続くため、実際の指が離れた時点で解除。
 const finishTouches=e=>{if(e.touches.length===0){if(multiTouch)blockedClickUntil=performance.now()+700;multiTouch=false;fingers.clear();pendingTap=null;}};
 document.addEventListener('touchend',finishTouches,{passive:true});
 document.addEventListener('touchcancel',finishTouches,{passive:true});
 $('assembly-form').addEventListener('submit',submitAssembly);
 // タッチドラッグ直後の互換クリック待ちに依存しない。後続クリックは二重実行しない。
 let lastTouchActivation=-Infinity;
 $('assembly-form').addEventListener('pointerup',e=>{
  const button=e.target.closest('button');
  const finger=fingers.get(e.pointerId);
  if(e.pointerType!=='touch'||!button||multiTouch||!finger||finger.moved||!button.contains(finger.target))return;
  e.preventDefault();lastTouchActivation=performance.now();
  if(button.type==='submit')submitAssembly(e);
  else if(button.dataset.action)handleAssemblyAction(button.dataset.action);
 });
 $('assembly-form').addEventListener('click',e=>{
  if(e.detail>0&&(multiTouch||performance.now()<blockedClickUntil||performance.now()-lastTouchActivation<600)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 $('assembly-controls').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button)handleAssemblyAction(button.dataset.action);});
 $('previous-step').addEventListener('click',()=>{if(multiTouch||performance.now()<blockedClickUntil)return;pendingTap=null;releaseDrag();previousAssemblyStep();});
 function coordinates(e){const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const p=point.matrixTransform(svg.getScreenCTM().inverse());return {x:assemblyView.minX+(p.x-65)/assemblyView.scale,el:assemblyView.minEL+(360-p.y)/assemblyView.scale};}
 function placeAt(e,stage){
  const p=coordinates(e);
  if(stage===3){if(Math.abs(p.el-groundElevation(problem,p.x))*assemblyView.scale>30)return assemblyMessage('地盤線の近くをクリック・タップしてください。');tryPlacePost(p.x);}
  else {placePoint(p.x);assemblyMessage('法板取付点を設置しました。必要なら左右ボタンで微調整してください。');}
 }
 svg.addEventListener('pointerdown',e=>{
  if(!assemblyActive||multiTouch)return;const a=activeAssembly(),p=coordinates(e);
  if((a.stage===3&&a.armed)||(a.stage===8&&e.target.closest('[data-board]'))){
   if(e.pointerType==='touch')pendingTap={id:e.pointerId,stage:a.stage};
   else if(e.button===0)placeAt(e,a.stage);
  }
  else if(a.stage===5&&e.target.closest('[data-board]')&&(e.pointerType==='touch'||e.button===0)){
   assemblyDrag={id:e.pointerId,el:p.el,start:a.boardEL};svg.setPointerCapture(e.pointerId);
  }
 });
 svg.addEventListener('pointermove',e=>{if(!multiTouch&&assemblyDrag?.id===e.pointerId){const p=coordinates(e);adjustBoard(assemblyDrag.start+p.el-assemblyDrag.el);}});
 svg.addEventListener('pointerup',e=>{
  const tap=pendingTap,finger=fingers.get(e.pointerId);pendingTap=null;
  if(tap?.id===e.pointerId&&!multiTouch&&finger&&!finger.moved&&activeAssembly().stage===tap.stage)placeAt(e,tap.stage);
  if(assemblyDrag?.id===e.pointerId)releaseDrag();
 });
 svg.addEventListener('pointercancel',()=>{pendingTap=null;releaseDrag();});
}



