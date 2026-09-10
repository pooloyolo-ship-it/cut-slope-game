const assert=require('node:assert/strict'),m=require('./model.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const example=m.createAttempt(m.problems[0]);example.sides[0].stakeX=10.5;
const expected=m.boardTargets(example,example.sides[0],13.4);near(expected.x,10.1);near(expected.distance,.4);assert.equal(expected.direction,'切土側');
assert.equal(m.pointGrade(10.1,10.13),'正解');assert.equal(m.pointGrade(10.1,10.2),'ほぼ正解');assert.equal(m.pointGrade(10.1,10.201),'再調整');
for(const source of m.problems){
 const p=m.createAttempt(source),steps=m.makeSteps(p);
 assert.equal(steps.length,2);assert.ok(steps.every(s=>!s.title.includes("計画法面高")&&!s.title.includes("高低差")));assert.equal(steps.reduce((s,t)=>s+t.score,0),40);
 steps.forEach(s=>{const values=Object.fromEntries(s.fields.map(f=>[f.key,f.value.toFixed(3)]));assert.ok(m.judgeAnswer(s,values).passed);assert.ok(m.judgeAnswer(s,{}).error);});
 for(const side of p.sides){
  assert.equal(side.boardEL,undefined);
  const r=m.getBoardRange(p,side),ref=m.findGroundIntersection(p,side),out=(side.stakeX-ref.x)*side.direction;
  assert.ok(out>0&&out<=2);assert.ok(m.boardHeightValid(p,side,r.min));assert.ok(m.boardHeightValid(p,side,r.max));assert.ok(!m.boardHeightValid(p,side,r.min-.001));assert.ok(!m.boardHeightValid(p,side,r.max+.001));
  const choices=[r.min,r.groundEL+.3,r.max].map(el=>m.boardTargets(p,side,el));
  assert.notEqual(choices[0].x,choices[2].x);
  for(const t of choices){near(m.designElevation(p,t.x,side),t.el);near(t.distance,Math.abs(side.stakeX-t.x));assert.equal(t.direction,'切土側');}
  const t=choices[1];
  const good={posts:[ref.x-.1,ref.x+.1],attached:true,locked:true,boardEL:t.el,cutSolved:true,distanceSolved:true,pointX:t.x,slopeAttached:true,ratio:t.ratio};
  assert.equal(m.validatePosts(p,side,good.posts),'');assert.ok(m.validateCompletion(p,side,good));
  for(const key of ['attached','locked','cutSolved','distanceSolved','slopeAttached'])assert.ok(!m.validateCompletion(p,side,{...good,[key]:false}));
  for(const change of [{posts:[ref.x]},{posts:[ref.x,ref.x]},{boardEL:r.max+.01},{pointX:t.x+.031},{ratio:t.ratio+.02},{pointX:null}])assert.ok(!m.validateCompletion(p,side,{...good,...change}));
  const other={...good,posts:[ref.x-.15,ref.x+.15]};assert.ok(m.validateCompletion(p,side,other));
  console.log(p.id,side.name,'幅杭X',side.stakeX,'板EL範囲',r.min,r.max,'中間EL切出しX',t.x,'距離',t.distance);
 }
}
console.log('PASS: 全9問・幅杭の外側2m以内・複数EL正解・動的X/距離・左右/小段/変更・複数杭配置・点精度・全完成条件・指定例10.100/0.400');

