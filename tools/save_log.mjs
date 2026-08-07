#!/usr/bin/env node
// Stop-hook helper: 코딩 에이전트 대화 기록을 제출물의 logs/ 폴더에 저장합니다.
// 훅이 호출하는 기본 구현입니다. tools/save_log.py 는 같은 동작의 Python판(선택)입니다.
// 출력: logs/<tool>/<session_id>.jsonl  (tool = claude-code | codex)
// 이 파일은 실행하거나 수정하실 필요가 없습니다.
import { copyFileSync, mkdirSync, readFileSync, readSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

// stdin 전체를 동기로 읽는다.
// readFileSync(0) 은 macOS/Linux 에서 stdin 이 non-blocking 일 때 EAGAIN 을 던지는 경우가 있어
// (그러면 로그가 조용히 누락된다) readSync 루프 + EAGAIN 재시도로 감싼다.
function readStdin() {
  const CHUNK = 65536
  const buf = Buffer.alloc(CHUNK)
  const chunks = []
  const sleeper = new Int32Array(new SharedArrayBuffer(4))
  for (let spins = 0; spins < 2000; ) {
    let n
    try {
      n = readSync(0, buf, 0, CHUNK, null)
    } catch (e) {
      if (e.code === 'EAGAIN') {
        spins++
        Atomics.wait(sleeper, 0, 0, 5) // 5ms 대기 (최대 10초)
        continue
      }
      if (e.code === 'EOF') break
      throw e
    }
    if (n === 0) break
    chunks.push(Buffer.from(buf.subarray(0, n)))
  }
  return Buffer.concat(chunks).toString('utf8')
}

const CODEX_CONV_EVENTS = ['user_message', 'agent_message']
const CODEX_SYSTEM_PREFIXES = ['<permissions', '<environment_context', '<user_instructions']

// message content (문자열 또는 블록 배열) -> 대화 텍스트만. tool_use/tool_result/thinking 은 무시된다.
function contentText(content) {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n')
      .trim()
  }
  return ''
}

// claude-code: 대화 텍스트를 담은 실제 user/assistant 턴만. isMeta(슬래시 명령 출력 등)는 제외.
function claudeHasText(obj) {
  if (!obj || typeof obj !== 'object') return false
  if (obj.type !== 'user' && obj.type !== 'assistant') return false
  if (obj.isMeta) return false
  const m = obj.message
  return !!m && typeof m === 'object' && contentText(m.content).length > 0
}

function codexHasEventText(obj) {
  if (!obj || typeof obj !== 'object' || obj.type !== 'event_msg') return false
  const p = obj.payload
  if (!p || typeof p !== 'object' || !CODEX_CONV_EVENTS.includes(p.type)) return false
  return typeof p.message === 'string' && p.message.trim().length > 0
}

// event_msg 가 없는 경우의 폴백
function codexHasResponseText(obj) {
  if (!obj || typeof obj !== 'object' || obj.type !== 'response_item') return false
  const p = obj.payload
  if (!p || typeof p !== 'object' || (p.role !== 'user' && p.role !== 'assistant')) return false
  const text = contentText(p.content)
  return text.length > 0 && !CODEX_SYSTEM_PREFIXES.some((s) => text.replace(/^\s+/, '').startsWith(s))
}

// 남길 줄에서 대화가 아닌 블록(thinking/tool_use/tool_result)을 걷어낸다.
// 줄 단위 필터만으로는 부족하다: assistant 턴은 thinking과 text를 같은 content 배열에
// 담는 경우가 많아, 줄을 그대로 두면 추론 내용(파일 내용을 인용하는 경우가 잦다)이 남는다.
function redactBlocks(obj) {
  for (const key of ['message', 'payload']) {
    const holder = obj[key]
    if (holder && typeof holder === 'object' && Array.isArray(holder.content)) {
      holder.content = holder.content.filter((b) => b && typeof b === 'object' && b.type === 'text')
    }
  }
  return obj
}

// 대화 텍스트만 남긴다. 남길 게 없으면 null(호출부가 통째로 복사).
function slimTranscript(raw, tool) {
  const pairs = []
  let anyParsed = false
  for (const line of raw.split('\n')) {
    const s = line.trim()
    if (!s) continue
    let obj
    try {
      obj = JSON.parse(s)
    } catch {
      continue
    }
    anyParsed = true
    pairs.push([line, obj])
  }
  if (!anyParsed) return null
  const dump = (objs) => objs.map((o) => JSON.stringify(redactBlocks(o)))
  let kept
  if (tool === 'codex') {
    kept = dump(pairs.filter(([, o]) => codexHasEventText(o)).map(([, o]) => o))
    if (kept.length === 0) kept = dump(pairs.filter(([, o]) => codexHasResponseText(o)).map(([, o]) => o))
  } else {
    kept = dump(pairs.filter(([, o]) => claudeHasText(o)).map(([, o]) => o))
  }
  if (kept.length === 0) return null
  return kept.join('\n') + '\n'
}

// stdout 에 절대 쓰지 않는다(Codex가 Stop 훅 stdout을 판정으로 파싱한다).
// 수집 실패가 지원자의 작업을 막지 않도록 항상 exit 0.
function main() {
  const i = process.argv.indexOf('--tool')
  const tool = i !== -1 ? process.argv[i + 1] : undefined
  if (tool !== 'claude-code' && tool !== 'codex') {
    console.error('save_log: --tool must be claude-code or codex')
    return 0
  }

  let payload
  try {
    // 셸에 따라 stdin 앞에 BOM이 붙는 경우가 있어 제거한다.
    payload = JSON.parse(readStdin().replace(/^﻿/, ''))
  } catch (e) {
    console.error(`save_log: failed to parse stdin JSON: ${e}`)
    return 0
  }

  const transcriptPath = payload.transcript_path
  const cwd = payload.cwd || process.cwd()
  let session = basename(String(payload.session_id ?? 'session'))
  if (session === '' || session === '.' || session === '..') session = 'session'

  if (!transcriptPath) {
    console.error('save_log: transcript_path missing')
    return 0
  }

  const destDir = join(cwd, 'logs', tool)
  const dest = join(destDir, `${session}.jsonl`)
  try {
    mkdirSync(destDir, { recursive: true })
    const raw = readFileSync(transcriptPath, 'utf8').replace(/^﻿/, '')
    const slim = slimTranscript(raw, tool)
    if (slim === null) copyFileSync(transcriptPath, dest)
    else writeFileSync(dest, slim, 'utf8')
  } catch (e) {
    console.error(`save_log: trim failed, copying verbatim: ${e}`)
    try {
      mkdirSync(destDir, { recursive: true })
      copyFileSync(transcriptPath, dest)
    } catch (e2) {
      console.error(`save_log: copy failed: ${e2}`)
    }
  }
  return 0
}

process.exit(main())
