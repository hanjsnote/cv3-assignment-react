"""스타터킷 로그 수집기 검증: python 판과 node 판이 같은 결과를 내는지 확인."""
import json, os, subprocess, sys, io, tempfile, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # tools/ 의 상위 = 킷 루트
D = tempfile.mkdtemp(prefix="kittest_")

CLAUDE_TR = """{"type":"user","message":{"content":"테이블 컴포넌트 만들어줘"}}
{"type":"assistant","message":{"content":[{"type":"text","text":"이렇게 만들었습니다"},{"type":"thinking","thinking":"숨겨야함"}]}}
{"type":"user","isMeta":true,"message":{"content":"/context 덤프 17KB"}}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write","input":{}}]}}
{broken json
{"type":"summary","summary":"메타"}
"""
CODEX_TR = """{"type":"event_msg","payload":{"type":"user_message","message":"스크래핑 붙여줘"}}
{"type":"event_msg","payload":{"type":"agent_message","message":"붙였습니다"}}
{"type":"event_msg","payload":{"type":"token_count","message":"x"}}
{"type":"response_item","payload":{"role":"user","content":[{"type":"text","text":"<permissions ...>"}]}}
"""

def run(cmd, tool, tr_path):
    repo = os.path.join(D, "repo")
    payload = json.dumps({"transcript_path": tr_path, "cwd": repo, "session_id": "abc-123"})
    p = subprocess.run(cmd + ["--tool", tool], input=payload.encode("utf-8"), capture_output=True)
    out = os.path.join(repo, "logs", tool, "abc-123.jsonl")
    data = open(out, encoding="utf-8").read() if os.path.exists(out) else "<파일없음>"
    if os.path.exists(out):
        os.remove(out)
    return p.returncode, p.stderr.decode("utf-8", "replace").strip(), data

fails = []
for tool, body in (("claude-code", CLAUDE_TR), ("codex", CODEX_TR)):
    tr = os.path.join(D, tool + ".jsonl")
    open(tr, "w", encoding="utf-8").write(body)
    rc1, e1, py = run([sys.executable, os.path.join(KIT, "tools", "save_log.py")], tool, tr)
    rc2, e2, nd = run(["node", os.path.join(KIT, "tools", "save_log.mjs")], tool, tr)
    print("=" * 60)
    print("%s   python exit=%d  node exit=%d" % (tool, rc1, rc2))
    if e1: print("  py stderr:", e1)
    if e2: print("  node stderr:", e2)
    print("--- 수집 결과 ---")
    print(py, end="" if py.endswith("\n") else "\n")
    same = py == nd
    print("--- 두 구현 동일? ---", "OK" if same else "DIFFERENT")
    if not same:
        print("  py  :", repr(py)); print("  node:", repr(nd))
        fails.append(tool + ":parity")
    # 필터링 검증
    if tool == "claude-code":
        assert "숨겨야함" not in py, "thinking 유출"
        assert "context 덤프" not in py, "isMeta 유출"
        assert "tool_use" not in py, "tool_use 유출"
        assert py.count("\n") == 2, "대화 2줄이어야 함: %r" % py
    else:
        assert "token_count" not in py, "비대화 이벤트 유출"
        assert "permissions" not in py, "시스템 프리픽스 유출"
        assert py.count("\n") == 2, "대화 2줄이어야 함: %r" % py

# 큰 payload/transcript: stdin 청크 루프(64KB 초과)와 다중 턴 처리 검증
big_tr = os.path.join(D, "big.jsonl")
with open(big_tr, "w", encoding="utf-8") as fh:
    for i in range(200):
        fh.write(json.dumps({"type": "user", "message": {"content": "질문 %d %s" % (i, "가" * 300)}},
                            ensure_ascii=False) + "\n")
for cmd in ([sys.executable, os.path.join(KIT, "tools", "save_log.py")],
            ["node", os.path.join(KIT, "tools", "save_log.mjs")]):
    repo = os.path.join(D, "repo")
    payload = json.dumps({"transcript_path": big_tr, "cwd": repo, "session_id": "big",
                          "filler": "x" * 200000})
    p = subprocess.run(cmd + ["--tool", "claude-code"], input=payload.encode("utf-8"),
                       capture_output=True)
    out = os.path.join(repo, "logs", "claude-code", "big.jsonl")
    assert p.returncode == 0, "큰 payload에서 exit 0이어야 함: %s" % cmd[0]
    n = sum(1 for _ in open(out, encoding="utf-8"))
    assert n == 200, "200턴이 모두 남아야 함(%s): %d" % (cmd[0], n)
    os.remove(out)
print("큰 payload(200KB) / 200턴 transcript: OK")

# transcript_path 없음 / 깨진 stdin → 항상 exit 0, 파일 미생성
for cmd in ([sys.executable, os.path.join(KIT, "tools", "save_log.py")],
            ["node", os.path.join(KIT, "tools", "save_log.mjs")]):
    p = subprocess.run(cmd + ["--tool", "codex"], input=b"not json", capture_output=True)
    assert p.returncode == 0, "깨진 stdin에도 exit 0이어야 함: %s" % cmd[0]
    p = subprocess.run(cmd + ["--tool", "codex"], input=b'{"cwd":"."}', capture_output=True)
    assert p.returncode == 0, "transcript 없어도 exit 0이어야 함: %s" % cmd[0]
    assert p.stdout == b"", "stdout에 출력하면 Codex가 판정으로 파싱함: %s" % cmd[0]

shutil.rmtree(D, ignore_errors=True)
print()
print("실패:", fails or "없음 — 필터링·동등성·실패내성 모두 통과")
