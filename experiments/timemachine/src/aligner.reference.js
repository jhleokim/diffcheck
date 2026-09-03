/* 조항 정렬 엔진 — 순서 보존 전역 정렬(Needleman-Wunsch)
   탐욕법과 달리 한 번의 오매칭이 연쇄되지 않는다. */
const TOK = /[가-힣]{2,}|[A-Za-z0-9]+/g;
function bag(s){ const m=(s||"").match(TOK)||[], c=new Map();
  for(const t of m) c.set(t,(c.get(t)||0)+1); return c; }
function cos(a,b){ let d=0,na=0,nb=0;
  for(const v of a.values()) na+=v*v;
  for(const [k,v] of b){ nb+=v*v; const x=a.get(k); if(x) d+=x*v; }
  return (na&&nb)? d/Math.sqrt(na*nb) : 0; }

/* 유사도: 제목 0.35 + 본문 0.65.
   번호 근접도는 쓰지 않는다 — 삭제로 번호가 밀린 직후 오히려 오답으로 유도한다.
   순서 정보는 NW의 순서 보존 제약이 이미 담당한다. */
function sim(a,b){
  return 0.35*cos(a._t||(a._t=bag(a.title)), b._t||(b._t=bag(b.title)))
       + 0.65*cos(a._b||(a._b=bag(a.text)),  b._b||(b._b=bag(b.text)));
}

const GAP = 0.40;     // 한쪽을 비우는 비용
const FLOOR = 0.25;   // 이보다 낮으면 짝이 아니라 삭제+신설로 본다

function align(A, B){
  const n=A.length, m=B.length;
  const S=Array.from({length:n+1},()=>new Float64Array(m+1));
  const P=Array.from({length:n+1},()=>new Uint8Array(m+1)); // 1=대각 2=위(삭제) 3=왼쪽(신설)
  for(let i=1;i<=n;i++){ S[i][0]=S[i-1][0]-GAP; P[i][0]=2; }
  for(let j=1;j<=m;j++){ S[0][j]=S[0][j-1]-GAP; P[0][j]=3; }
  const SIM=Array.from({length:n},()=>new Float64Array(m));
  for(let i=0;i<n;i++) for(let j=0;j<m;j++) SIM[i][j]=sim(A[i],B[j]);
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++){
    const dg=S[i-1][j-1]+SIM[i-1][j-1], up=S[i-1][j]-GAP, lf=S[i][j-1]-GAP;
    if(dg>=up && dg>=lf){ S[i][j]=dg; P[i][j]=1; }
    else if(up>=lf){ S[i][j]=up; P[i][j]=2; }
    else { S[i][j]=lf; P[i][j]=3; }
  }
  const out=[]; let i=n,j=m;
  while(i>0||j>0){
    const p = (i>0&&j>0)?P[i][j] : (i>0?2:3);
    if(p===1){
      const s=SIM[i-1][j-1];
      if(s<FLOOR){ out.push({L:A[i-1],R:null,score:0}); out.push({L:null,R:B[j-1],score:0}); }
      else out.push({L:A[i-1],R:B[j-1],score:s});
      i--; j--;
    } else if(p===2){ out.push({L:A[i-1],R:null,score:0}); i--; }
    else { out.push({L:null,R:B[j-1],score:0}); j--; }
  }
  out.reverse();
  return out.map(r=>{
    let status;
    if(!r.R) status="deleted";
    else if(!r.L) status="inserted";
    else if(r.L.title!==r.R.title || r.L.text!==r.R.text) status="edited";
    else if(r.L.label!==r.R.label) status="moved";
    else status="same";
    return {...r, status};
  });
}
module.exports={align,sim};
