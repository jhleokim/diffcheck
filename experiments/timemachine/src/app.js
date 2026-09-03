const DATA = __DATA__;
const $ = id => document.getElementById(id);

/* ═══ 1. 정렬 엔진 — 순서 보존 전역 정렬(Needleman-Wunsch) ═══
   탐욕적 매칭은 조항 하나를 잘못 붙이면 그 뒤가 줄줄이 밀린다.
   NW는 전체 점수를 최적화하므로 그 연쇄가 생기지 않는다. */
const TOK=/[가-힣]{2,}|[A-Za-z0-9]+/g;
function bag(s){const m=(s||"").match(TOK)||[],c=new Map();for(const t of m)c.set(t,(c.get(t)||0)+1);return c;}
function cos(a,b){let d=0,na=0,nb=0;for(const v of a.values())na+=v*v;
  for(const[k,v]of b){nb+=v*v;const x=a.get(k);if(x)d+=x*v;}return(na&&nb)?d/Math.sqrt(na*nb):0;}
function sim(a,b){
  a._t=a._t||bag(a.title); b._t=b._t||bag(b.title);
  a._b=a._b||bag(a.text);  b._b=b._b||bag(b.text);
  return 0.35*cos(a._t,b._t)+0.65*cos(a._b,b._b);
}
const GAP=0.40, FLOOR=0.25;
function align(A,B){
  const n=A.length,m=B.length;
  const S=Array.from({length:n+1},()=>new Float64Array(m+1));
  const P=Array.from({length:n+1},()=>new Uint8Array(m+1));
  for(let i=1;i<=n;i++){S[i][0]=S[i-1][0]-GAP;P[i][0]=2;}
  for(let j=1;j<=m;j++){S[0][j]=S[0][j-1]-GAP;P[0][j]=3;}
  const SIM=Array.from({length:n},()=>new Float64Array(m));
  for(let i=0;i<n;i++)for(let j=0;j<m;j++)SIM[i][j]=sim(A[i],B[j]);
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
    const dg=S[i-1][j-1]+SIM[i-1][j-1],up=S[i-1][j]-GAP,lf=S[i][j-1]-GAP;
    if(dg>=up&&dg>=lf){S[i][j]=dg;P[i][j]=1;}
    else if(up>=lf){S[i][j]=up;P[i][j]=2;}else{S[i][j]=lf;P[i][j]=3;}
  }
  const out=[];let i=n,j=m;
  while(i>0||j>0){
    const p=(i>0&&j>0)?P[i][j]:(i>0?2:3);
    if(p===1){const s=SIM[i-1][j-1];
      if(s<FLOOR){out.push({L:A[i-1],R:null,score:0});out.push({L:null,R:B[j-1],score:0});}
      else out.push({L:A[i-1],R:B[j-1],score:s});
      i--;j--;
    }else if(p===2){out.push({L:A[i-1],R:null,score:0});i--;}
    else{out.push({L:null,R:B[j-1],score:0});j--;}
  }
  out.reverse();
  return out.map(r=>{
    let status;
    if(!r.R)status="deleted"; else if(!r.L)status="inserted";
    else if(r.L.title!==r.R.title||r.L.text!==r.R.text)status="edited";
    else if(r.L.label!==r.R.label)status="moved"; else status="same";
    const o={...r,status};
    if(r.L&&r.R){const d=wdiff(r.L.text,r.R.text);o.lh=d[0];o.rh=d[1];}
    return o;
  });
}
function esc(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}
function wdiff(a,b){
  const at=a.match(/\S+|\s+/g)||[],bt=b.match(/\S+|\s+/g)||[];
  const n=at.length,m=bt.length;
  const D=Array.from({length:n+1},()=>new Uint32Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
    D[i][j]=at[i]===bt[j]?D[i+1][j+1]+1:Math.max(D[i+1][j],D[i][j+1]);
  let i=0,j=0,ah="",bh="",da="",db="";
  const flush=()=>{ if(da)ah+="<del>"+esc(da)+"</del>"; if(db)bh+="<ins>"+esc(db)+"</ins>"; da=db=""; };
  while(i<n&&j<m){
    if(at[i]===bt[j]){flush();ah+=esc(at[i]);bh+=esc(bt[j]);i++;j++;}
    else if(D[i+1][j]>=D[i][j+1]){da+=at[i++];}
    else{db+=bt[j++];}
  }
  while(i<n)da+=at[i++];
  while(j<m)db+=bt[j++];
  flush();
  return[ah,bh];
}

/* ═══ 2. 조문 파서 — 붙여넣기·드롭한 텍스트를 조 단위로 ═══ */
function parseArticles(raw){
  let t=raw.replace(/\r/g,"");
  if(/<[a-z][\s\S]*>/i.test(t)){const d=document.createElement("div");d.innerHTML=t;t=d.textContent;}
  const re=/제\s*(\d+)\s*조(?:의\s*(\d+))?\s*\(([^)\n]{1,60})\)/g;
  const hits=[...t.matchAll(re)];
  if(!hits.length)return[];
  const arts=[];
  hits.forEach((h,k)=>{
    const start=h.index+h[0].length;
    const end=k+1<hits.length?hits[k+1].index:t.length;
    arts.push({
      label:`제${h[1]}조`+(h[2]?`의${h[2]}`:""),
      title:h[3].trim(),
      text:t.slice(start,end).replace(/\s+/g," ").trim().slice(0,1400)
    });
  });
  return arts;
}

/* ═══ 계약서 파일 판독 — hwpx / docx는 ZIP+XML이라 JSZip으로 직접 연다 ═══ */
function xmlText(xml, tag, paraEnd){
  // 태그 안의 텍스트만 모으고, 문단 끝에서 줄바꿈
  const out=[];
  const re=new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>|<\\/${paraEnd}>`,"g");
  let m;
  while((m=re.exec(xml))!==null){
    if(m[1]!==undefined) out.push(m[1].replace(/<[^>]+>/g,""));
    else out.push("\n");
  }
  return out.join("")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"')
    .replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&amp;/g,"&");
}
function needZip(){
  if(typeof JSZip==="undefined"){
    const e=new Error("압축 해제 모듈(JSZip)을 불러오지 못했습니다. 네트워크가 차단된 환경이면 hwpx·docx 판독과 .docx 추출을 쓸 수 없습니다.");
    e.title="모듈 로드 실패"; e.guide=true; throw e;
  }
}
async function readHwpx(buf){
  needZip();
  const z=await JSZip.loadAsync(buf);
  const names=Object.keys(z.files)
    .filter(n=>/^Contents\/section\d+\.xml$/i.test(n))
    .sort((a,b)=>(+a.match(/\d+/)[0])-(+b.match(/\d+/)[0]));
  if(!names.length) throw new Error("hwpx 구조가 아닙니다");
  let t="";
  for(const n of names) t += xmlText(await z.file(n).async("string"),"hp:t","hp:p")+"\n";
  return t;
}
async function readDocx(buf){
  needZip();
  const z=await JSZip.loadAsync(buf);
  const f=z.file("word/document.xml");
  if(!f) throw new Error("docx 구조가 아닙니다");
  return xmlText(await f.async("string"),"w:t","w:p");
}
const LEGACY={hwp:["한글(HWP) 구버전","한글에서 열고 [다른 이름으로 저장] → 형식을 «한글 문서 (*.hwpx)»로 저장한 뒤 다시 올려주세요."],
              doc:["Word 구버전(DOC)","Word에서 열고 [다른 이름으로 저장] → 형식을 «Word 문서 (*.docx)»로 저장한 뒤 다시 올려주세요."],
              pdf:["PDF","현재 버전은 PDF 본문 추출을 지원하지 않습니다. 원본 hwpx·docx가 있으면 그쪽을 올려주세요."]};
async function readContract(file){
  const ext=(file.name.match(/\.([a-z0-9]+)$/i)||[,""])[1].toLowerCase();
  if(LEGACY[ext]){ const [n,how]=LEGACY[ext]; const e=new Error(how); e.title=n; e.guide=true; throw e; }
  if(ext==="hwpx") return await readHwpx(await file.arrayBuffer());
  if(ext==="docx") return await readDocx(await file.arrayBuffer());
  if(["txt","md","html","htm","xml"].includes(ext)) return await file.text();
  const e=new Error("지원하지 않는 형식입니다. hwpx 또는 docx로 올려주세요."); e.title=ext.toUpperCase(); e.guide=true; throw e;
}

/* ═══ 3. 상태 ═══ */
const VS = DATA.versions.map(v=>({...v}));
let L=0, R=1, hover=-1, opened=new Set(), tab="hist", merge=new Map(), rows=[];
const SYM={same:"=",moved:"⇅",edited:"~",inserted:"+",deleted:"−"};
const NAME={same:"동일",moved:"번호 이동",edited:"내용 변경",inserted:"신설",deleted:"삭제"};
$("src").textContent=DATA.source;

/* ═══ 4. 렌더 ═══ */
function recompute(){ rows=align(VS[L].articles, VS[R].articles); }

function render(){
  recompute();
  renderSeg(); renderRail(); renderHead(); renderRows(); renderInspector();
  hover=-1;
}
function renderSeg(){
  const s=$("seg"); s.innerHTML="";
  VS.forEach((v,i)=>{ if(i===0)return;
    const b=document.createElement("button"); b.type="button";
    b.textContent=`${VS[i-1].short} → ${v.short}`;
    b.setAttribute("aria-pressed", (L===i-1&&R===i)?"true":"false");
    b.onclick=()=>{L=i-1;R=i;opened=new Set();render();};
    s.appendChild(b);
  });
  const b=document.createElement("button"); b.type="button"; b.textContent="처음 → 끝";
  b.setAttribute("aria-pressed",(L===0&&R===VS.length-1&&VS.length>2)?"true":"false");
  b.onclick=()=>{L=0;R=VS.length-1;opened=new Set();render();};
  s.appendChild(b);
}
function renderHead(){
  $("hl").textContent=VS[L].label; $("hlm").textContent=`${VS[L].date} · ${VS[L].actor} · ${VS[L].articles.length}개 조`;
  $("hr").textContent=VS[R].label; $("hrm").textContent=`${VS[R].date} · ${VS[R].actor} · ${VS[R].articles.length}개 조`;
  const st={}; rows.forEach(r=>st[r.status]=(st[r.status]||0)+1);
  $("tally").innerHTML=`<span class="t-del">−${st.deleted||0}</span>`+
    `<span class="t-add">+${st.inserted||0}</span>`+
    `<span class="t-mod">~${(st.edited||0)+(st.moved||0)}</span>`;
  const pairs=rows.filter(r=>r.L&&r.R);
  const ver=pairs.filter(r=>r.L.uid&&r.R.uid);
  const ok=ver.filter(r=>r.L.uid===r.R.uid).length;
  const a=$("acc");
  if(ver.length){ a.textContent=`정렬 ${ok}/${ver.length}`+(ok<ver.length?` · 검수필요 ${ver.length-ok}`:"");
    a.className="acc"+(ok<ver.length?" bad":""); }
  else { a.textContent=`정렬쌍 ${pairs.length}`; a.className="acc"; }
}
function rowHTML(r,i){
  const long=d=>d&&d.text.length>190;
  const bad=(r.L&&r.R&&r.L.uid&&r.R.uid&&r.L.uid!==r.R.uid);
  const cell=(side,d,html)=> d
    ? `<div class="cell ${side}" data-row="${i}"><div><span class="ano">${d.label}</span><span class="atl">${esc(d.title)}</span></div>`+
      `<div class="atx${long(d)?" clamp":""}">${html||esc(d.text)}</div></div>`
    : `<div class="cell ${side} void" data-row="${i}"><span class="voidm">${side==="r"?"삭제됨":"이 버전에 없음"}</span></div>`;
  return cell("l",r.L,r.lh)+
    `<div class="gut s-${r.status}" data-row="${i}" title="${NAME[r.status]}${bad?" · 정렬 검수 필요":""}">`+
    `<span class="sym">${SYM[r.status]}</span>${r.L&&r.R?`<span>${r.score.toFixed(2)}</span>`:""}</div>`+
    cell("r",r.R,r.rh);
}
function renderRows(){
  const g=$("grid"); const out=[]; let run=[];
  const flush=()=>{ if(!run.length)return;
    if(run.length>=3 && !opened.has(run[0])){
      const a=rows[run[0]],b=rows[run[run.length-1]];
      out.push(`<div class="fold"><button type="button" data-fold="${run[0]}">▸ 동일한 조 ${run.length}개`+
        `<span style="opacity:.6">${(a.L||a.R).label}–${(b.L||b.R).label}</span></button></div>`);
    } else run.forEach(i=>out.push(rowHTML(rows[i],i)));
    run=[]; };
  rows.forEach((r,i)=>{ if(r.status==="same")run.push(i); else{flush();out.push(rowHTML(r,i));} });
  flush(); g.innerHTML=out.join("");
}
$("grid").addEventListener("click",e=>{
  const f=e.target.closest("[data-fold]");
  if(f){opened.add(+f.dataset.fold);renderRows();return;}
  const c=e.target.closest(".cell"); if(!c)return;
  document.querySelectorAll(`.cell[data-row="${c.dataset.row}"] .atx`).forEach(t=>t.classList.toggle("clamp"));
});

/* ═══ 5. 마우스 트래킹 + 좌우 동시 하이라이트 ═══ */
const sc=$("scroll"), ruler=$("ruler"); let raf=null,my=0;
function rowAt(y){
  const sr=sc.getBoundingClientRect();
  const el=document.elementFromPoint(sr.left+22,y); if(!el)return -1;
  const c=el.closest("[data-row]"); if(!c||c.parentElement!==$("grid"))return -1;
  return +c.dataset.row;
}
function select(i){
  $("grid").querySelectorAll(".is-track").forEach(e=>e.classList.remove("is-track"));
  hover=i;
  if(i<0){status(null);if(tab==="hist")renderInspector();return;}
  $("grid").querySelectorAll(`[data-row="${i}"]`).forEach(e=>e.classList.add("is-track"));
  status(rows[i]); if(tab==="hist")renderInspector();
}
sc.addEventListener("mousemove",e=>{ my=e.clientY; if(raf)return;
  raf=requestAnimationFrame(()=>{ raf=null;
    const sr=sc.getBoundingClientRect();
    ruler.classList.add("on"); ruler.style.top=(my-sr.top+sc.scrollTop)+"px";
    const i=rowAt(my); if(i!==hover)select(i);
  });
});
sc.addEventListener("mouseleave",()=>{ ruler.classList.remove("on");
  $("grid").querySelectorAll(".is-track").forEach(e=>e.classList.remove("is-track"));
  hover=-1; status(null); if(tab==="hist")renderInspector(); });
function status(r){
  if(!r){$("stLive").textContent="조문 위에 마우스를 올리면 좌·우가 동시에 추적됩니다";
    $("stSep").textContent="";$("stDet").textContent="";return;}
  $("stLive").textContent=`${r.L?r.L.label:"—"} ↔ ${r.R?r.R.label:"—"}`;
  $("stSep").textContent="│";
  const b=[NAME[r.status]];
  if(r.L&&r.R){ b.push(`신뢰도 ${r.score.toFixed(2)}`);
    if(r.L.uid&&r.R.uid&&r.L.uid!==r.R.uid)b.push("⚠ 정렬 검수 필요");
    const ins=(r.rh.match(/<ins>/g)||[]).length, del=(r.lh.match(/<del>/g)||[]).length;
    if(ins||del)b.push(`추가 ${ins}곳 · 삭제 ${del}곳`); }
  $("stDet").textContent=b.join(" · ");
}

/* ═══ 6. 버전 레일 — 드래그로 순서 변경/끼워넣기, 체크로 대비표 대상 선택 ═══ */
let dragFrom=null;
function renderRail(){
  const list=$("vlist"); list.innerHTML=""; $("vcount").textContent=`${VS.length}개`;
  VS.forEach((v,i)=>{
    const dz=document.createElement("div"); dz.className="vdrop"; dz.dataset.at=i; list.appendChild(dz);
    const c=document.createElement("div");
    c.className="vcard"+(i===L?" isL":"")+(i===R?" isR":"");
    c.draggable=true; c.dataset.i=i;
    c.innerHTML=`<div class="vtop"><input class="vchk" type="checkbox" data-c="${i}">`+
      `<span class="vname">${esc(v.label)}</span>`+
      `<button class="vstar${v.final?" on":""}" data-star="${i}" type="button" `+
      `title="${v.final?"최종본 지정 해제":"이 버전을 최종본으로 지정"}">${v.final?"★":"☆"}</button>`+
      `<span class="vside">${i===L?"좌":i===R?"우":""}</span></div>`+
      `<div class="vmeta">${v.date} · ${v.actor} · ${v.articles.length}조</div>`+
      (v.final?`<div class="vfinal">최종본</div>`:``);
    c.addEventListener("dragstart",e=>{dragFrom=i;c.classList.add("dragging");e.dataTransfer.effectAllowed="move";});
    c.addEventListener("dragend",()=>{dragFrom=null;c.classList.remove("dragging");
      document.querySelectorAll(".vdrop").forEach(d=>d.classList.remove("over"));});
    c.addEventListener("click",e=>{
      if(e.target.classList.contains("vchk"))return;
      if(e.target.dataset.star!==undefined){e.stopPropagation();setFinal(+e.target.dataset.star);return;}
      if(e.shiftKey||i<L){L=i; if(R<=L)R=Math.min(VS.length-1,L+1);} else R=i;
      if(L===R){L=Math.max(0,R-1);} opened=new Set(); render();
    });
    list.appendChild(c);
  });
  const dz=document.createElement("div"); dz.className="vdrop"; dz.dataset.at=VS.length; list.appendChild(dz);
  list.querySelectorAll(".vdrop").forEach(d=>{
    d.addEventListener("dragover",e=>{e.preventDefault();d.classList.add("over");});
    d.addEventListener("dragleave",()=>d.classList.remove("over"));
    d.addEventListener("drop",e=>{
      e.preventDefault(); d.classList.remove("over");
      if(dragFrom===null)return;
      let at=+d.dataset.at; const v=VS[dragFrom];
      VS.splice(dragFrom,1); if(at>dragFrom)at--;
      VS.splice(at,0,v); dragFrom=null;
      L=Math.min(L,VS.length-2); R=L+1; opened=new Set(); render();
    });
  });
  list.querySelectorAll(".vchk").forEach(k=>k.addEventListener("change",()=>{
    const sel=[...list.querySelectorAll(".vchk:checked")];
    if(sel.length>2){k.checked=false;return;}
    $("btnCmp").disabled = sel.length!==2;
  }));
}
function selectedPair(){
  const s=[...$("vlist").querySelectorAll(".vchk:checked")].map(k=>+k.dataset.c).sort((a,b)=>a-b);
  return s.length===2?s:null;
}

/* ═══ 7. 버전 추가 — 붙여넣기 / 드래그앤드롭 ═══ */
function addVersion(articles,label,actor){
  if(!articles.length){alert("조문을 찾지 못했습니다. 「제1조(총칙)」 형식의 조 제목이 있어야 합니다.");return;}
  const d=new Date();
  VS.push({id:"u"+Date.now(),label:label||`추가 버전 ${VS.length+1}`,
    short:label?label.slice(0,4):`v${VS.length}`,
    date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
    actor:actor||"직접 추가",articles});
  L=VS.length-2; R=VS.length-1; opened=new Set(); render();
}
$("btnPaste").onclick=()=>openModal("paste");
const dz=$("dz");
["dragenter","dragover"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add("over");}));
["dragleave","drop"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove("over");}));
dz.addEventListener("drop",async e=>{
  const f=e.dataTransfer.files[0]; if(!f)return;
  const old=dz.textContent; dz.textContent="읽는 중…";
  try{
    const txt=await readContract(f);
    const arts=parseArticles(txt);
    if(!arts.length) throw Object.assign(new Error(
      "조문을 찾지 못했습니다. 「제1조(총칙)」 형식의 조 제목이 있는 계약서인지 확인해주세요."),{title:"조문 인식 실패",guide:true});
    addVersion(arts, f.name.replace(/\.[^.]+$/,""), "파일");
  }catch(err){
    openModal("err",{title:err.title||"파일을 읽지 못했습니다", msg:err.message, name:f.name});
  }finally{ dz.innerHTML=DZ_HTML; }
});
const DZ_HTML=dz.innerHTML;

/* ═══ 8. 인스펙터: 조항 이력 / 최종본 만들기 ═══ */
$("tabHist").onclick=()=>{tab="hist";syncTabs();renderInspector();};
$("tabMerge").onclick=()=>{tab="merge";syncTabs();renderInspector();};
function syncTabs(){$("tabHist").setAttribute("aria-selected",tab==="hist");
  $("tabMerge").setAttribute("aria-selected",tab==="merge");}
function renderInspector(){
  const b=$("ibody");
  if(tab==="hist"){
    const r=hover>=0?rows[hover]:null;
    if(!r){b.innerHTML=`<div class="ih">조항 이력</div><div class="iempty">조문 위에 마우스를 올리면 그 조항이 모든 버전에서 어떻게 움직였는지 보여줍니다.</div>`;return;}
    const probe=r.R||r.L;
    const steps=VS.map(v=>{
      let best=null,bs=0;
      for(const a of v.articles){const s=sim(probe,a); if(s>bs){bs=s;best=a;}}
      return {v,a:bs>=0.55?best:null,s:bs};
    });
    const mx=Math.max(...steps.map(x=>x.a?x.a.text.length:0),1);
    let prev=null;
    const html=steps.map(x=>{
      let cls="";
      if(!x.a)cls="gone";
      else if(!prev)cls="born";
      else if(prev.label!==x.a.label||prev.text!==x.a.text)cls="chg";
      const row=`<div class="ls ${cls}"><span class="v">${esc(x.v.short)}</span>`+
        `<span class="lb">${x.a?x.a.label:"없음"}</span>`+
        `<span class="bar"><i style="width:${x.a?Math.round(x.a.text.length/mx*100):0}%"></i></span></div>`;
      if(x.a)prev=x.a; return row;
    }).join("");
    b.innerHTML=`<div class="ih">조항 이력</div><div class="lt">${esc(probe.title)}</div>${html}`+
      `<div class="note">막대 길이 = 조문 분량. 색이 바뀐 회차가 그 조항이 실제로 손대진 지점입니다.</div>`;
    return;
  }
  // 최종본 만들기
  const chg=rows.map((r,i)=>({r,i})).filter(x=>x.r.status!=="same");
  const list=chg.map(({r,i})=>{
    const p=merge.get(i)||(r.R?"R":"L");
    const t=(r.R||r.L);
    return `<div class="mrow"><div class="mt">${esc(t.label)} ${esc(t.title)} · ${NAME[r.status]}</div>`+
      `<div class="mpick">`+
      `<button type="button" data-m="${i}" data-p="L" aria-pressed="${p==="L"}" ${r.L?"":"disabled"}>좌 채택</button>`+
      `<button type="button" data-m="${i}" data-p="R" aria-pressed="${p==="R"}" ${r.R?"":"disabled"}>우 채택</button>`+
      `<button type="button" data-m="${i}" data-p="X" aria-pressed="${p==="X"}">제외</button>`+
      `</div></div>`;
  }).join("");
  b.innerHTML=`<div class="ih">검토본 만들기 · 변경 ${chg.length}건</div>`+
    (chg.length?list:`<div class="iempty">두 버전이 동일합니다.</div>`)+
    `<div style="display:flex;gap:6px;margin-top:10px">`+
    `<button class="btn pri" id="btnMake" style="flex:1">검토본 생성</button>`+
    `<button class="btn" id="btnDocx" style="flex:1">계약서 추출</button></div>`+
    `<div class="note">동일한 조는 자동으로 그대로 계승됩니다. 생성하면 타임라인 마지막 버전이 되고, 확정되면 버전 카드의 ☆를 눌러 최종본으로 지정할 수 있습니다.</div>`;
  b.querySelectorAll("[data-m]").forEach(btn=>btn.onclick=()=>{
    merge.set(+btn.dataset.m,btn.dataset.p); renderInspector();
  });
  $("btnMake").onclick=makeFinal;
  $("btnDocx").onclick=()=>exportContract(buildFinal());
}
function buildFinal(){
  const out=[];
  rows.forEach((r,i)=>{
    if(r.status==="same"){out.push(r.R||r.L);return;}
    const p=merge.get(i)||(r.R?"R":"L");
    if(p==="X")return;
    const pick=p==="L"?r.L:r.R;
    if(pick)out.push(pick);
  });
  return out.map((a,k)=>({label:`제${k+1}조`,title:a.title,text:a.text}));
}
function makeFinal(){
  const arts=buildFinal();
  const d=new Date();
  const n=VS.filter(v=>/^검토본/.test(v.label)).length+1;
  VS.push({id:"rev"+Date.now(),label:`검토본 ${n}차`,short:`검토${n}`,
    date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
    actor:"검토",articles:arts});
  L=VS.length-2; R=VS.length-1; opened=new Set(); merge=new Map(); render();
}
/* 어떤 버전이든 언제든 최종본으로 지정/해제 — 한 번에 하나만 */
function setFinal(i){
  const on=!VS[i].final;
  VS.forEach(v=>v.final=false);
  VS[i].final=on;
  renderRail(); renderHead();
}

/* ═══ 9. 문서 추출 — JSZip으로 실제 .docx(OOXML) 생성 ═══ */
let DL=null;
(async()=>{ try{ if(window.claude&&claude.use) DL=await claude.use("downloads"); }catch(e){} })();
async function saveFile(filename,data){
  if(DL){ try{ await DL.save({filename,data}); return "saved"; }
    catch(e){ if(e&&e.code==="declined")return "declined";
      console.warn("downloads:",e&&e.code); } }
  try{ const blob=data instanceof Blob?data:new Blob([data]);
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); return "saved";
  }catch(e){ return "failed"; }
}
function xe(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function para(text,opt={}){
  const rpr=`<w:rPr>${opt.b?"<w:b/>":""}${opt.color?`<w:color w:val="${opt.color}"/>`:""}`+
    `<w:sz w:val="${opt.sz||18}"/><w:szCs w:val="${opt.sz||18}"/></w:rPr>`;
  const segs=String(text||"").split("\n");
  return segs.map(s=>`<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>`+
    `${opt.align?`<w:jc w:val="${opt.align}"/>`:""}</w:pPr>`+
    `<w:r>${rpr}<w:t xml:space="preserve">${xe(s)}</w:t></w:r></w:p>`).join("");
}
function cell(content,w,fill){
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>`+
    (fill?`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`:"")+
    `<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/>`+
    `<w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>`+
    `</w:tcPr>${content}</w:tc>`;
}
const BORDERS=`<w:tblBorders>`+
  ["top","left","bottom","right","insideH","insideV"].map(s=>
    `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="B7BEC6"/>`).join("")+`</w:tblBorders>`;
async function docxBlob(bodyXml,landscape){
  needZip();
  const sect = landscape
    ? `<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>`+
      `<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr>`
    : `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`+
      `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>`;
  const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`+
    `<w:body>${bodyXml}${sect}</w:body></w:document>`;
  const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`+
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`+
    `<Default Extension="xml" ContentType="application/xml"/>`+
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`+
    `</Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`+
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>`+
    `</Relationships>`;
  const zip=new JSZip();
  zip.file("[Content_Types].xml",ct);
  zip.folder("_rels").file(".rels",rels);
  zip.folder("word").file("document.xml",doc);
  return await zip.generateAsync({type:"blob",
    mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}
/* 산출물 2 규격: 가로 A4 · No./조항/【전】/【후】/사유 · 지정 색상 */
function cmpRows(a,b){
  const rs=align(a.articles,b.articles);
  let n=0;
  return rs.filter(r=>r.status!=="same").map(r=>{
    n++;
    const t=(r.R||r.L);
    const reason={inserted:"신설 조항 — 도입 취지와 법리 근거 확인 필요",
      deleted:"삭제된 조항 — 삭제 사유와 대체 장치 확인 필요",
      edited:"본문 변경 — 변경된 어절의 의미 변화 검토",
      moved:"조 번호 이동 — 내용 동일, 인용 조문 정합성 확인"}[r.status];
    return {no:`${{inserted:"A",deleted:"B",edited:"C",moved:"D"}[r.status]}-${n}`,
      clause:`${t.label} ${t.title}`,
      before:r.L?`${r.L.label} ${r.L.title}\n${r.L.text}`:"(해당 조항 없음)",
      after:r.R?`${r.R.label} ${r.R.title}\n${r.R.text}`:"(삭제됨)",
      reason, status:r.status};
  });
}
async function exportCompare(li,ri){
  const a=VS[li],b=VS[ri],data=cmpRows(a,b);
  const head=`<w:tr><w:trPr><w:tblHeader/></w:trPr>`+
    [["No.",900],["조항",2400],["【전】 "+a.label,4300],["【후】 "+b.label,4300],["수정 사유 / 법리근거",3200]]
      .map(([t,w])=>cell(para(t,{b:true,color:"FFFFFF",sz:17}),w,"1F3A5F")).join("")+`</w:tr>`;
  const body=data.map(d=>`<w:tr>`+
    cell(para(d.no,{sz:16,b:true}),900)+
    cell(para(d.clause,{sz:16}),2400)+
    cell(para(d.before,{sz:16,color:"C00000"}),4300,"FFF5F5")+
    cell(para(d.after,{sz:16,color:"0070C0"}),4300,"F0F8E8")+
    cell(para(d.reason,{sz:16}),3200,"FFFEF0")+`</w:tr>`).join("");
  const xml=para(`${a.label} → ${b.label} 변경 대비표`,{b:true,sz:28})+
    para(`${a.date} → ${b.date} · 변경 ${data.length}건 · diffcheck 자동 생성`,{sz:16,color:"666666"})+
    para("")+
    `<w:tbl><w:tblPr><w:tblW w:w="15100" w:type="dxa"/>${BORDERS}</w:tblPr>${head}${body}</w:tbl>`;
  let blob; try{ blob=await docxBlob(xml,true); }
  catch(e){ openModal("err",{title:e.title||"추출 실패",msg:e.message,name:"대비표.docx"}); return; }
  const r=await saveFile(`대비표_${a.short}_${b.short}.docx`,blob);
  if(r==="failed")openModal("err",{title:"추출 실패",msg:"파일을 저장하지 못했습니다.",name:"대비표.docx"});
}
async function exportContract(arts){
  const xml=para("계약서 최종본",{b:true,sz:32,align:"center"})+
    para(`diffcheck 검토 확정 · ${arts.length}개 조`,{sz:16,color:"666666",align:"center"})+para("")+
    arts.map(a=>para(`${a.label}(${a.title})`,{b:true,sz:20})+para(a.text,{sz:18})+para("")).join("");
  let blob; try{ blob=await docxBlob(xml,false); }
  catch(e){ openModal("err",{title:e.title||"추출 실패",msg:e.message,name:"계약서.docx"}); return; }
  const r=await saveFile(`계약서_${(VS[R].label||"검토본").replace(/\s/g,"")}.docx`,blob);
  if(r==="failed")openModal("err",{title:"추출 실패",msg:"파일을 저장하지 못했습니다.",name:"계약서.docx"});
}

/* ═══ 10. 모달 ═══ */
const mask=$("mask"),modal=$("modal");
mask.addEventListener("click",e=>{if(e.target===mask)closeModal();});
function closeModal(){mask.classList.remove("on");modal.innerHTML="";}
function openModal(kind,arg){
  if(kind==="paste"){
    modal.innerHTML=`<h2>붙여넣기로 버전 추가</h2><div class="mb">`+
      `<div class="fld"><label>버전 이름</label><input type="text" id="pName" placeholder="예: 시공사 3차 제출"></div>`+
      `<div class="fld"><label>작성 주체</label><input type="text" id="pActor" placeholder="예: 시공사"></div>`+
      `<div class="fld"><label>계약서 전문 — 「제1조(총칙)」 형식의 조 제목이 있어야 인식됩니다</label>`+
      `<textarea id="pText" placeholder="제1조(총칙) ...&#10;제2조(정의) ..."></textarea></div></div>`+
      `<div class="mf"><button class="btn" id="pC">취소</button><button class="btn pri" id="pO">추가</button></div>`;
    $("pC").onclick=closeModal;
    $("pO").onclick=()=>{ const arts=parseArticles($("pText").value);
      if(!arts.length){alert("조문을 찾지 못했습니다.");return;}
      addVersion(arts,$("pName").value.trim()||null,$("pActor").value.trim()||null); closeModal(); };
  }
  if(kind==="err"){
    modal.innerHTML=`<h2>${esc(arg.title)}</h2><div class="mb">`+
      `<div style="font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-bottom:9px">${esc(arg.name)}</div>`+
      `<div style="font-size:12.5px;line-height:1.75">${esc(arg.msg)}</div>`+
      `<div class="note" style="margin-top:12px">지원 형식: <b>.hwpx</b> · <b>.docx</b> · .txt · .md<br>`+
      `구버전 .hwp / .doc와 .pdf는 본문 구조를 신뢰할 수 있게 읽어낼 수 없어 받지 않습니다.</div></div>`+
      `<div class="mf"><button class="btn pri" id="eC">확인</button></div>`;
    $("eC").onclick=closeModal;
  }
  if(kind==="cmp"){
    const [li,ri]=arg, a=VS[li], b=VS[ri], data=cmpRows(a,b);
    modal.innerHTML=`<h2>${esc(a.label)} → ${esc(b.label)} 변경 대비표 · ${data.length}건</h2>`+
      `<div class="mb"><table class="cmp">`+
      `<colgroup><col style="width:7%"><col style="width:16%"><col style="width:28%">`+
      `<col style="width:28%"><col style="width:21%"></colgroup>`+
      `<thead><tr><th>No.</th><th>조항</th>`+
      `<th>【전】 ${esc(a.short)}</th><th>【후】 ${esc(b.short)}</th><th>수정 사유</th></tr></thead><tbody>`+
      data.map(d=>`<tr><td class="no">${d.no}</td><td>${esc(d.clause)}</td>`+
        `<td class="o">${esc(d.before).replace(/\n/g,"<br>").slice(0,420)}</td>`+
        `<td class="n">${esc(d.after).replace(/\n/g,"<br>").slice(0,420)}</td>`+
        `<td class="w">${esc(d.reason)}</td></tr>`).join("")+
      `</tbody></table></div>`+
      `<div class="mf"><button class="btn" id="cC">닫기</button>`+
      `<button class="btn pri" id="cO">.docx 추출 (가로 A4)</button></div>`;
    $("cC").onclick=closeModal;
    $("cO").onclick=async()=>{ await exportCompare(li,ri); closeModal(); };
  }
  mask.classList.add("on");
}
$("btnCmp").onclick=()=>{ const p=selectedPair(); if(p)openModal("cmp",p); };

render(); syncTabs();
