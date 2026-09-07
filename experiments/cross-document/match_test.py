#!/usr/bin/env python3
"""
문서 간 조항 매칭이 어휘 유사도로 가능한지 시험한다.

결론: 불가능하다. 상세는 README.md.
이 스크립트는 그 부정 결과를 재현하기 위해 남긴다.

    python3 match_test.py
"""
import re, io, math, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
TIMEMACHINE = os.path.join(HERE, "..", "timemachine")

RE_HEAD = re.compile(r"제\s*(\d+)\s*조(?:의\s*(\d+))?\s*\(([^)\n]{1,40})\)")
TOK = re.compile(r"[가-힣]{2,}|[A-Za-z0-9]+")


def parse(txt, cap=900):
    """조 제목 정규식으로 조 단위 분할."""
    t = re.sub(r"\s+", " ", txt)
    hits = list(RE_HEAD.finditer(t))
    out = []
    for k, h in enumerate(hits):
        s = h.end()
        e = hits[k + 1].start() if k + 1 < len(hits) else len(t)
        out.append({
            "label": f"제{h.group(1)}조" + (f"의{h.group(2)}" if h.group(2) else ""),
            "title": h.group(3).strip(),
            "text": t[s:e].strip()[:cap],
        })
    return out


def bag(s):
    return Counter(TOK.findall(s or ""))


def cos(a, b):
    common = set(a) & set(b)
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def sim(a, b):
    """timemachine/src/app.js 의 sim() 과 동일한 가중치."""
    return 0.35 * cos(bag(a["title"]), bag(b["title"])) + 0.65 * cos(bag(a["text"]), bag(b["text"]))


def main():
    sintak = parse(io.open(os.path.join(HERE, "ktrust_land.txt"), encoding="utf-8").read())
    dogeup = []
    for line in io.open(os.path.join(TIMEMACHINE, "articles_full.tsv"), encoding="utf-8").read().strip().split("\n"):
        n, title, text = line.split("\t", 2)
        dogeup.append({"label": f"제{n}조", "title": title, "text": text})

    print(f"신탁계약서 {len(sintak)}조 · 도급계약서 {len(dogeup)}조\n")
    print("=== 신탁계약서 각 조의 도급계약서 최유사 조 (점수순) ===")

    rows = []
    for a in sintak:
        best = max(dogeup, key=lambda b: sim(a, b))
        rows.append((sim(a, best), a, best))
    rows.sort(key=lambda r: -r[0])

    for s, a, b in rows[:12]:
        mark = "★" if s >= 0.25 else " "
        print(f" {mark} {s:.2f}  신탁 {a['label']}({a['title'][:16]})"
              f"  ↔  도급 {b['label']}({b['title'][:20]})")

    over25 = sum(1 for s, _, _ in rows if s >= 0.25)
    over15 = sum(1 for s, _, _ in rows if s >= 0.15)
    print(f"\n0.25 이상: {over25}건 / 0.15 이상: {over15}건 / 전체 {len(rows)}건")
    print("\n→ 쓸 만한 매칭이 사실상 없다. 문서 간 대조는 정렬이 아니라 항목 기반 추출로 간다.")


if __name__ == "__main__":
    main()
