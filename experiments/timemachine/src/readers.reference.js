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
async function readHwpx(buf){
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
if(typeof module!=="undefined") module.exports={readHwpx,readDocx,xmlText,readContract};
