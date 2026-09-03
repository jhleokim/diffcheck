# -*- coding: utf-8 -*-
"""
정렬(alignment) 알고리즘 실현가능성 최소 프로토타입.
입력: 실제 국가법령정보센터 배포 "민간건설공사 표준도급계약서" 원문에서 추출한 43개 조.
출력: 인위적으로 만든 "협상 후 수정안"과의 정렬 결과.

주입한 변형 (실제 협상 라운드에서 흔한 패턴):
  1. 제10조 뒤에 신설조항 삽입 -> 11조부터 전부 조번호가 1씩 밀림 (최악 케이스)
  2. 제25조(구번호) 통째로 삭제
  3. 제15조, 제30조(구번호) 본문 일부를 조사만 바꿔서 노이즈 삽입
  4. 제18조(구번호) 제목까지 살짝 바뀜 (title 매칭만으론 못 잡는 케이스)
"""
import re, math, io
from collections import Counter

raw = io.open("articles_before.txt", encoding="utf-8").read().strip().split("\n")
before = []
for line in raw:
    n, sub, title, text = line.split("\t", 3)
    before.append({"n": int(n), "sub": int(sub), "title": title, "text": text})

# ---- "수정안" 합성 ----
after = [dict(a) for a in before]

# 3) 조사만 바뀐 노이즈 (제15조, 제30조 구번호)
for a in after:
    if a["n"] == 15:
        a["text"] = a["text"].replace("한다", "하기로 한다", 1)
    if a["n"] == 30:
        a["text"] = a["text"].replace("있다", "있는 것으로 한다", 1)

# 4) 제18조 제목까지 변경 (구번호)
for a in after:
    if a["n"] == 18:
        a["title"] = a["title"] + " 등"

# 2) 제25조(구번호) 삭제
after = [a for a in after if a["n"] != 25]

# 1) 제10조 뒤 신설 삽입 -> 이후 전부 +1 번호 밀림
new_article = {"n": 10.5, "sub": 0, "title": "물가변동 특례",
               "text": "발주자와 시공자는 착공 이후 물가변동에 대해 별도로 협의하여 정한다. 다만 객관적 지표에 따른 조정은 예외로 한다."}
result = []
shift_from = 11
for a in after:
    if a["n"] < shift_from:
        result.append(a)
    else:
        b = dict(a); b["n"] = a["n"] + 1
        result.append(b)
    if a["n"] == 10:
        result.append(new_article)
after = result

print(f"before={len(before)}개 조 / after={len(after)}개 조 (삭제1 삽입1 반영)")

# ---- 유사도: 순수 파이썬 단어빈도 코사인 (외부 라이브러리 없음, §12.1 결정과 일치) ----
def tokenize(s):
    return re.findall(r"[가-힣]{2,}|[A-Za-z0-9]+", s)

def vec(text):
    return Counter(tokenize(text))

def cosine(c1, c2):
    common = set(c1) & set(c2)
    dot = sum(c1[t]*c2[t] for t in common)
    n1 = math.sqrt(sum(v*v for v in c1.values()))
    n2 = math.sqrt(sum(v*v for v in c2.values()))
    return dot/(n1*n2) if n1 and n2 else 0.0

def score(a, b):
    t_sim = cosine(vec(a["title"]), vec(b["title"]))
    b_sim = cosine(vec(a["text"]), vec(b["text"]))
    num_close = 1.0 / (1.0 + abs(a["n"] - b["n"]))
    return 0.4*t_sim + 0.5*b_sim + 0.1*num_close

# ---- 정렬: 1단계 번호+제목 완전일치 앵커, 2단계 나머지 최고점 매칭 ----
matched_b = set()
alignment = []
for a in before:
    exact = [b for b in after if b["n"] == a["n"] and b["title"] == a["title"] and id(b) not in matched_b]
    if exact:
        alignment.append((a, exact[0], 1.0, "앵커(완전일치)"))
        matched_b.add(id(exact[0]))

remaining_before = [a for a in before if not any(a is m[0] for m in alignment)]
for a in remaining_before:
    best, best_s = None, -1
    for b in after:
        if id(b) in matched_b:
            continue
        s = score(a, b)
        if s > best_s:
            best, best_s = b, s
    if best is not None and best_s >= 0.3:
        alignment.append((a, best, best_s, "유사도매칭"))
        matched_b.add(id(best))
    else:
        alignment.append((a, None, 0.0, "삭제후보"))

aligned_after_ids = {id(m[1]) for m in alignment if m[1] is not None}
for b in after:
    if id(b) not in aligned_after_ids:
        alignment.append((None, b, 0.0, "신설후보"))

alignment.sort(key=lambda m: (m[0]["n"] if m[0] else m[1]["n"]))

print("\n결과 (구번호 -> 신번호, 점수, 판정)")
ok, wrong = 0, 0
for a, b, s, kind in alignment:
    an = f"제{a['n']}조" if a else "―"
    bn = f"제{b['n']}조" if b else "―"
    at = a["title"] if a else ""
    bt = b["title"] if b else ""
    flag = ""
    if a and b:
        if at != bt or abs((a["text"] != b["text"]) - 0) or True:
            pass
    print(f"  {an}({at:12s}) -> {bn}({bt:14s})  score={s:.2f}  {kind}")
