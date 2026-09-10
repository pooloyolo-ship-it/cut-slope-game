'use strict';
// 条件と出題構造をデータで定義する。地盤点はX順、最初・最後の区間は外側へ延長する。
function basicProblem(id, level, number, el, width, ratio, stakeX, centerEL, stakeEL) {
  return { id, level, number, title: `${level}問題${number}`, centerX:0, excavationElevation:el,
    groundPoints:[{x:0,el:centerEL},{x:stakeX,el:stakeEL}],
    sides:[{name:'右',direction:1,width,stakeX,designSegments:[{type:'slope',ratio}]}] };
}
const problems = [
  basicProblem('b1','初級',1,10,5,1.5,7,13,13),
  basicProblem('b2','初級',2,10,5,.5,7,15,15),
  basicProblem('b3','初級',3,10,5,2,7,12.5,12.5),
  basicProblem('m1','中級',1,20,6,1.5,9,23,24.8),
  basicProblem('m2','中級',2,15,4.5,1,8,19.5,18.7),
  basicProblem('m3','中級',3,30,7,2,10,33,34.5)
];
function getGroundSegments(p) {
  return p.groundPoints.slice(0,-1).map((point,i)=>{
    const next=p.groundPoints[i+1];
    const a=(next.el-point.el)/(next.x-point.x);
    return {a,b:point.el-a*point.x,min:i===0?-Infinity:point.x,max:i===p.groundPoints.length-2?Infinity:next.x};
  });
}
function groundElevation(p,x) { const s=getGroundSegments(p).find(s=>x>=s.min&&x<=s.max);return s.a*x+s.b; }
function getToePosition(p,side=p.sides[0]) {return {x:p.centerX+side.direction*side.width,el:p.excavationElevation};}
function buildDesignSegments(p,side=p.sides[0]) {
  let start=getToePosition(p,side);
  return side.designSegments.map((s,index)=>{
    const end=s.type==='berm'?{x:start.x+side.direction*s.width,el:start.el}:s.rise!=null?{x:start.x+side.direction*s.rise*s.ratio,el:start.el+s.rise}:null;
    const result={...s,index,start:{...start},end,direction:side.direction};
    if(end)start=end;
    return result;
  });
}
function segmentContains(s,x) {const distance=(x-s.start.x)*s.direction;return distance>=-1e-9&&(!s.end||distance<=Math.abs(s.end.x-s.start.x)+1e-9);}
function designElevation(p,x,side=p.sides[0]) {
  const s=buildDesignSegments(p,side).find(s=>segmentContains(s,x));
  if(!s)throw Error('法面区間外のXです');
  return s.start.el+(s.type==='berm'?0:(x-s.start.x)*s.direction/s.ratio);
}
// 地盤との交点は描画範囲専用。正解・採点からは呼び出さない。
function findGroundIntersection(p,side=p.sides[0]) {
  const candidates=[];
  // 各計画区間と各地盤区間の一次式を連立し、両区間内にある交点だけを採用。
  for(const s of buildDesignSegments(p,side)) {
    const a=s.type==='berm'?0:s.direction/s.ratio,b=s.start.el-a*s.start.x;
    for(const g of getGroundSegments(p)) {
      if(Math.abs(a-g.a)<1e-12)continue;
      const x=(g.b-b)/(a-g.a);
      if(x>=g.min-1e-9&&x<=g.max+1e-9&&segmentContains(s,x))candidates.push({x,el:a*x+b,distance:(x-getToePosition(p,side).x)*side.direction});
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  if(!candidates.length)throw Error(`${p.id}:描画用の地盤交点がありません`);
  return candidates[0];
}
function createAttempt(source) {
  const p=JSON.parse(JSON.stringify(source));
  p.sides.forEach(side=>{
    delete side.boardEL;delete side.boardOffset;
    const reference=findGroundIntersection(p,side);
    // 幅杭は地盤上の切出し付近より外側、2m以内。板設定上限よりも外側に置く教材データ。
    const last=buildDesignSegments(p,side).at(-1);
    side.stakeX=reference.x+side.direction*Math.min(2,.5*last.ratio+.5);
  });
  return p;
}
function getBoardCutout(p,side=p.sides[0]) {
  if(!Number.isFinite(side.boardEL))throw Error('水平板ELが未設定です');
  const s=buildDesignSegments(p,side).find(s=>s.type==='slope'&&side.boardEL>=s.start.el&&(!s.end||side.boardEL<=s.end.el));
  if(!s)throw Error('水平板ELに対応する法面区間がありません');
  // ΔX=ΔEL×n。小段等の水平距離は区間開始Xに既に含まれる。
  return {x:s.start.x+side.direction*(side.boardEL-s.start.el)*s.ratio,el:side.boardEL,segment:s};
}
function boardExplanation(p,side) {
  const c=getBoardCutout(p,side),toe=getToePosition(p,side),s=c.segment,F=n=>n.toFixed(3);
  const intro=`法尻から水平板までの高さ差は ${F(side.boardEL)} − ${F(toe.el)} = ${F(side.boardEL-toe.el)}mです。`;
  const sections=side.designSegments.length>1?`小段・勾配変更があるため、下段の水平距離と小段幅を積み上げ、上段開始点（X=${F(s.start.x)}m、EL=${F(s.start.el)}m）を基準に残りの高さ差を計算します。`:'';
  return intro+sections+`法勾配1：${s.ratio.toFixed(2)}より、水平距離は ΔEL × n = (${F(side.boardEL)} − ${F(s.start.el)}) × ${s.ratio.toFixed(2)} = ${F((side.boardEL-s.start.el)*s.ratio)}m。${sections?'区間開始':'法尻'}Xに${side.direction===1?'加える':'左側なので引く'}と、水平板での切出し位置X=${F(c.x)}mです。`;
}
const field=(key,label,value,tolerance=.01,kind='length')=>({key,label,value,tolerance,kind});
const step=(title,score,fields,explanation,reveal=null)=>({title,score,fields,explanation,reveal});
function makeSteps(p) {
 const positions=p.sides.flatMap((s,i)=>{const t=getToePosition(p,s);return [field('toe'+i+'X',s.name+'法尻 X',t.x),field('toe'+i+'EL',s.name+'法尻 EL',t.el)];});
 const distances=p.sides.map((s,i)=>field('distance'+i,s.name+' 幅杭から法尻までの水平距離',Math.abs(s.stakeX-getToePosition(p,s).x)));
 return [
 step('法尻位置を求めましょう。',20,positions,'法尻Xはセンターから掘削幅だけ左右へ進んだ位置です。法尻ELは掘削計画高です。'),
 step('幅杭から法尻までの水平距離はいくらでしょう？',20,distances,'幅杭Xと法尻Xの差の絶対値を求めます。')];
}
function getBoardRange(p,side=p.sides[0]) {
 const reference=findGroundIntersection(p,side);
 return {groundEL:reference.el,min:reference.el+.1,max:reference.el+.5,referenceX:reference.x};
}
function boardHeightValid(p,side,el){const r=getBoardRange(p,side);return Number.isFinite(el)&&el>=r.min-1e-9&&el<=r.max+1e-9;}
function boardTargets(p,side,el){
 const cut=getBoardCutout(p,{...side,boardEL:el});
 return {x:cut.x,el,distance:Math.abs(side.stakeX-cut.x),direction:(side.stakeX-cut.x)*side.direction>=0?'切土側':'外側',ratio:cut.segment.ratio};
}
function pointGrade(target,x){if(!Number.isFinite(x))return '未設置';const e=Math.abs(target-x);return e<=.03+1e-9?'正解':e<=.1+1e-9?'ほぼ正解':'再調整';}
function getAssemblyZone(p,side){
 const r=getBoardRange(p,side),outer=boardTargets(p,side,r.max).x;
 const span=Math.max(1,Math.abs(side.stakeX-r.referenceX));
 return {min:Math.min(r.referenceX,side.stakeX,outer)-span*.3,max:Math.max(r.referenceX,side.stakeX,outer)+span*.3,minSeparation:span*.08};
}
function validatePosts(p,side,posts){
 const z=getAssemblyZone(p,side);
 if(posts.length!==2)return '丁張杭を2本設置してください。';
 if(posts.some(x=>!Number.isFinite(x)||x<z.min||x>z.max))return '図の設置エリア内で幅杭の近くに設置してください。';
 if(Math.abs(posts[0]-posts[1])<z.minSeparation)return '2本の杭が近すぎます。画面上で間隔を広げてください。';
 return '';
}
function validateCompletion(p,side,a){
 if(validatePosts(p,side,a.posts))return false;
 if(!a.attached||!a.locked||!boardHeightValid(p,side,a.boardEL))return false;
 const t=boardTargets(p,side,a.boardEL);
 return a.posts.every(x=>groundElevation(p,x)<a.boardEL)&&a.cutSolved&&a.distanceSolved&&pointGrade(t.x,a.pointX)==='正解'&&a.slopeAttached&&Number.isFinite(a.ratio)&&Math.abs(a.ratio-t.ratio)<=.01+1e-9;
}
function validateAnswer(s,values) {
  if(s.fields.some(f=>values[f.key]==null||String(values[f.key]).trim()===''))return 'このSTEPの項目をすべて入力してください。';
  if(s.fields.some(f=>!Number.isFinite(Number(values[f.key]))||(f.kind==='ratio'&&Number(values[f.key])<=0)))return '入力値を確認してください。法勾配は0より大きい数値を入力してください。';
  return '';
}
function judgeAnswer(s,values) {
  const error=validateAnswer(s,values);if(error)return {error};
  const items=s.fields.map(f=>{const value=Number(values[f.key]),difference=value-f.value;
    const epsilon=8*Number.EPSILON*Math.max(1,Math.abs(value),Math.abs(f.value));
    return {...f,value,correct:f.value,difference,passed:Math.abs(difference)<=f.tolerance+epsilon};});
  const passed=items.every(i=>i.passed);return {items,passed,score:passed?s.score:0};
}
function calculateScore(results){return results.reduce((sum,r)=>sum+(r?.score||0),0);}
if(typeof module!=='undefined')module.exports={problems,getGroundSegments,groundElevation,getToePosition,buildDesignSegments,designElevation,findGroundIntersection,createAttempt,getBoardCutout,makeSteps,getBoardRange,boardHeightValid,boardTargets,pointGrade,getAssemblyZone,validatePosts,validateCompletion,validateAnswer,judgeAnswer,calculateScore};
// ユーザー承認済みの教材用補完条件。板や杭の実務寸法は規定しない。
problems.push(
 {id:'a1',level:'上級',number:1,title:'左右両側切土',centerX:0,excavationElevation:50,
  groundPoints:[{x:-7,el:55},{x:0,el:55},{x:8,el:55}],
  sides:[{name:'左',direction:-1,width:4.5,stakeX:-7,designSegments:[{type:'slope',ratio:1}]},{name:'右',direction:1,width:5.5,stakeX:8,designSegments:[{type:'slope',ratio:1.5}]}]},
 {id:'a2',level:'上級',number:2,title:'小段あり',centerX:0,excavationElevation:10,
  groundPoints:[{x:0,el:16},{x:10,el:16}],
  sides:[{name:'右',direction:1,width:5,stakeX:10,designSegments:[{type:'slope',ratio:1,rise:3},{type:'berm',width:1.5},{type:'slope',ratio:1.5}]}]},
 {id:'a3',level:'上級',number:3,title:'途中で法勾配が変わる',centerX:0,excavationElevation:10,
  groundPoints:[{x:0,el:16},{x:10,el:16}],
  sides:[{name:'右',direction:1,width:5,stakeX:10,designSegments:[{type:'slope',ratio:1,rise:2},{type:'slope',ratio:1.5}]}]}
);



