import { layout, prepareWithSegments, walkLineRanges, layoutWithLines } from '../src/layout.ts'

// ── Pretext 설정 ─────────────────────────────────────────────────────────────
const BUBBLE_FONT = '13px "Inter", system-ui, sans-serif'
const BUBBLE_LINE_H = 20
const BUBBLE_PAD_X = 11
const BUBBLE_PAD_Y = 7
const FLOAT_FONT = 'bold 13px "Inter", system-ui, sans-serif'

// ── 동물 데이터 ──────────────────────────────────────────────────────────────
const SPECS = [
  {
    emoji: '🐱', name: '코코', color: '#f59e0b',
    hungry:  ['배고파요 😢', '밥 주세요!', '냐옹... 꼬르륵', '냠냠 하고 싶어요'],
    happy:   ['냐하하! ✨', '최고야!! 😻', '행복해요~ 💕', '사랑해요!! ❤️'],
    bored:   ['심심해요 😾', '놀아줘요!', '야옹... 😑', '뭔가 하고 싶어'],
    sleepy:  ['zzz...', '🌙 졸려요', '눈이 무거워', 'zzzZZZ...'],
    random:  ['오늘 날씨 좋다!', '저 예쁘죠? 냐옹', '간식 주세요 🍣', '냐옹냐옹!'],
  },
  {
    emoji: '🐶', name: '멍멍이', color: '#3b82f6',
    hungry:  ['멍! 밥이요!', '배가 너무 고파요 😭', '뭐라도 주세요!', '왈왈! 냄새나요!'],
    happy:   ['왈왈! 최고! 🐾', '꼬리가 안 멈춰요 💫', '좋아좋아! 😄', '왕왕!!! ❤️'],
    bored:   ['산책 가요!', '공! 공! 🎾', '놀아줘요 멍멍', '심심해요 🐕'],
    sleepy:  ['하암... 💤', 'zzz 멍멍...', '잠깐 눈 감을게요', '콜쿨...'],
    random:  ['멍멍! 안녕!', '꼬리 잡을 거야!', '지금 밥 시간이죠?', '사람이 최고야!'],
  },
  {
    emoji: '🐰', name: '토순이', color: '#ec4899',
    hungry:  ['당근 주세요 🥕', '배고파요 살살...', '풀이라도...', '냠냠하고 싶어요'],
    happy:   ['뿅뿅! ✨', '방방 뛰고 싶어요!', '행복해요 🐰💕', '이 기분 최고!'],
    bored:   ['심심해요...', '낮잠이나 잘까', '뭔가 없나...', '토순이는 지루해'],
    sleepy:  ['졸려요 🌙', 'zzz...', '낮잠 자도 돼요?', '솜사탕 꿈 꿀게요'],
    random:  ['귀엽죠? 뿅', '당근이 최고야!', '방방! 방방!', '솜사탕 같아요 💕'],
  },
  {
    emoji: '🦊', name: '여우씨', color: '#f97316',
    hungry:  ['여우도 배고파요!', '먹을 것 주세요! 🦊', '배고프면 못 놀아요', '냄새난다... 음식!'],
    happy:   ['링링링! 신나요!', '여우는 행복해! 🧡', '영리한 여우! ✨', '꼬리가 북실북실!'],
    bored:   ['재미없어요', '뭔가 계획이...', '심심한 여우', '뭔가 장난칠까'],
    sleepy:  ['굴로 들어갈게요', 'zzz 여우는 잠들어요', '봄잠... 달콤해', '🌙 꿈나라로'],
    random:  ['저 영리해요! 🦊', '꼬리 구경하세요!', '나쁜 여우 아니에요!', '여우야 여우야!'],
  },
  {
    emoji: '🐸', name: '개굴이', color: '#10b981',
    hungry:  ['개굴개굴! 배고파!', '벌레 주세요 🐛', '개굴... 꼬르륵', '먹이 없으면 울어요'],
    happy:   ['개굴개굴! ✨', '방방 뛸래요! 🐸', '개굴개굴개굴!!! 😄', '연못이 그리워요'],
    bored:   ['개굴...심심해', '연못에 가고 싶어', '개굴개굴?', '뭔가 할 일 없나'],
    sleepy:  ['개굴... zzz', '🌙 개구리도 자요', '잠이 솔솔...', 'zz개굴zz'],
    random:  ['개굴! 안녕!', '점프! 점프! 🐸', '비가 오면 좋겠어', '나 개구리야!'],
  },
  {
    emoji: '🐼', name: '판다', color: '#8b5cf6',
    hungry:  ['대나무 주세요 🎋', '배고파요 판다', '냠냠... 대나무!', '먹을 게 없어요 😢'],
    happy:   ['구르고 싶어요! ✨', '행복한 판다! 🐼', '최고야! 대박!', '판다판다! ❤️'],
    bored:   ['심심해요 판다', '데굴데굴...', '뭔가 할 게 없나', '판다는 지루해'],
    sleepy:  ['판다는 잠보에요 💤', 'zzz 판다...', '꿈나라로 가요', '🌙 잘게요'],
    random:  ['판다예요! 🐼', '눈이 귀엽죠?', '대나무 최고!', '구르는 판다!'],
  },
]

// ── 타입 ─────────────────────────────────────────────────────────────────────
type Spec = typeof SPECS[0]
type PetState = 'walk' | 'idle' | 'sleep' | 'bounce' | 'sad'

type Pet = {
  spec: Spec
  x: number; vx: number
  hunger: number; happiness: number; energy: number
  age: number
  state: PetState; stateTimer: number
  el: HTMLDivElement; emojiEl: HTMLSpanElement
  bubbleEl: HTMLDivElement | null; bubbleTimer: number
  lastSpoke: number
  selected: boolean
}

// ── DOM ───────────────────────────────────────────────────────────────────────
const world = document.getElementById('world')!
const panel = document.getElementById('panel')!
const dayLabel = document.getElementById('day-label')!
const hint = document.getElementById('hint')!
const btnFeed  = document.getElementById('btn-feed')  as HTMLButtonElement
const btnPet   = document.getElementById('btn-pet')   as HTMLButtonElement
const btnPlay  = document.getElementById('btn-play')  as HTMLButtonElement
const btnSleep = document.getElementById('btn-sleep') as HTMLButtonElement
const btnNew   = document.getElementById('btn-new')!

// ── Stars ─────────────────────────────────────────────────────────────────────
function initStars() {
  const c = document.getElementById('stars') as HTMLCanvasElement
  c.width = window.innerWidth; c.height = window.innerHeight * 0.75
  const ctx = c.getContext('2d')!
  for (let i = 0; i < 100; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * c.width, Math.random() * c.height, Math.random() * 1.4 + 0.2, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 + 0.15})`
    ctx.fill()
  }
}
initStars()

// ── Pretext: 말풍선 측정 (★ 핵심!) ─────────────────────────────────────────────
// 이 함수가 DOM 없이 텍스트 크기를 정확히 계산합니다
function measureBubble(text: string) {
  const prepared = prepareWithSegments(text, BUBBLE_FONT)
  // 이진 탐색으로 가장 꽉 맞는 너비 찾기 (Bubbles 데모와 동일한 기법)
  const baseLines = layout(prepared, 220, BUBBLE_LINE_H).lineCount
  let lo = 40, hi = 220
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (layout(prepared, mid, BUBBLE_LINE_H).lineCount <= baseLines) hi = mid
    else lo = mid + 1
  }
  let maxW = 0
  const n = walkLineRanges(prepared, lo, ln => { if (ln.width > maxW) maxW = ln.width })
  const { lines } = layoutWithLines(prepared, lo, BUBBLE_LINE_H)
  return { w: Math.ceil(maxW) + BUBBLE_PAD_X * 2, h: n * BUBBLE_LINE_H + BUBBLE_PAD_Y * 2, lines: lines.map(l => l.text) }
}

// ── Pretext: 플로팅 텍스트 중앙 정렬 ────────────────────────────────────────────
// 텍스트 너비를 DOM 없이 측정해서 동물 머리 위 정중앙에 배치
function floatText(x: number, y: number, text: string, color: string) {
  const prepared = prepareWithSegments(text, FLOAT_FONT)
  let w = 0
  walkLineRanges(prepared, 300, ln => { if (ln.width > w) w = ln.width })
  const el = document.createElement('div')
  el.className = 'ftext'
  el.textContent = text
  el.style.cssText = `left:${Math.round(x - w / 2)}px;top:${Math.round(y)}px;color:${color};`
  world.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}

// ── 말풍선 표시 ──────────────────────────────────────────────────────────────
function showBubble(pet: Pet, text: string, ms = 2800) {
  if (pet.bubbleEl) { pet.bubbleEl.remove(); pet.bubbleEl = null }
  const { w, h, lines } = measureBubble(text)
  const el = document.createElement('div')
  el.className = 'bubble'
  el.style.width = `${w}px`
  for (const ln of lines) {
    const row = document.createElement('div')
    row.textContent = ln; row.style.whiteSpace = 'nowrap'
    el.appendChild(row)
  }
  world.appendChild(el)
  pet.bubbleEl = el
  pet.bubbleTimer = ms
  pet.lastSpoke = Date.now()
  placeBubble(pet)
}

function placeBubble(pet: Pet) {
  if (!pet.bubbleEl) return
  const size = getSize(pet)
  const bw = parseInt(pet.bubbleEl.style.width)
  pet.bubbleEl.style.left = `${Math.round(pet.x - bw / 2)}px`
  pet.bubbleEl.style.top  = `${Math.round(getFloor() - size - 60)}px`
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const getFloor = () => window.innerHeight - 80
const getRight = () => window.innerWidth - 50

function getSize(pet: Pet) {
  if (pet.age < 20) return 30
  if (pet.age < 70) return 40
  return 50
}

function getAgeLabel(pet: Pet) {
  if (pet.age < 20) return '아기 🍼'
  if (pet.age < 70) return '어린이 🧒'
  if (pet.age < 150) return '청소년 🧑'
  return '어른 🧑‍🦳'
}

function stateLabel(pet: Pet) {
  if (pet.state === 'sleep') return '잠자는 중 💤'
  if (pet.state === 'bounce') return '신나서 뛰는 중 🎉'
  if (pet.state === 'sad') return '슬퍼요 😢'
  if (pet.state === 'idle') return '쉬는 중 🤔'
  return '산책 중 🚶'
}

function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]! }

// ── 동물 생성 ─────────────────────────────────────────────────────────────────
function makePet(spec: Spec): Pet {
  const el = document.createElement('div')
  el.className = 'pet'
  const emojiEl = document.createElement('span')
  emojiEl.className = 'pet-emoji'
  emojiEl.textContent = spec.emoji
  const tag = document.createElement('div')
  tag.className = 'pet-tag'; tag.textContent = spec.name
  el.append(emojiEl, tag)
  world.appendChild(el)

  const pet: Pet = {
    spec, x: 80 + Math.random() * (window.innerWidth - 160),
    vx: (Math.random() - 0.5) * 1.8,
    hunger: 75 + Math.random() * 20, happiness: 60 + Math.random() * 30,
    energy: 70 + Math.random() * 25, age: 0,
    state: 'walk', stateTimer: 80 + Math.floor(Math.random() * 100),
    el, emojiEl, bubbleEl: null, bubbleTimer: 0,
    lastSpoke: 0, selected: false,
  }
  el.addEventListener('click', () => select(pet))
  return pet
}

// ── 상태 ─────────────────────────────────────────────────────────────────────
const pets: Pet[] = []
let sel: Pet | null = null
let gameSeconds = 0
let lastTick = 0

function select(pet: Pet) {
  if (sel) { sel.selected = false; sel.el.classList.remove('sel') }
  sel = pet; pet.selected = true; pet.el.classList.add('sel')
  panel.classList.add('on'); hint.style.display = 'none'
  btnFeed.disabled = btnPet.disabled = btnPlay.disabled = btnSleep.disabled = false
  updatePanel()
}

function updatePanel() {
  if (!sel) return
  document.getElementById('p-emoji')!.textContent = sel.spec.emoji
  document.getElementById('p-name')!.textContent  = sel.spec.name
  document.getElementById('p-state')!.textContent = stateLabel(sel)
  document.getElementById('p-age')!.textContent   = `나이: ${getAgeLabel(sel)}`
  ;(document.getElementById('sb-h')  as HTMLElement).style.width = `${sel.hunger}%`
  ;(document.getElementById('sb-hp') as HTMLElement).style.width = `${sel.happiness}%`
  ;(document.getElementById('sb-e')  as HTMLElement).style.width = `${sel.energy}%`
  document.getElementById('sv-h')!.textContent  = String(Math.round(sel.hunger))
  document.getElementById('sv-hp')!.textContent = String(Math.round(sel.happiness))
  document.getElementById('sv-e')!.textContent  = String(Math.round(sel.energy))
}

// ── 버튼 액션 ────────────────────────────────────────────────────────────────
btnFeed.addEventListener('click', () => {
  if (!sel) return
  const g = 22 + Math.random() * 10
  sel.hunger = Math.min(100, sel.hunger + g)
  showBubble(sel, pick(['냠냠! 맛있어요!', '감사합니다! 🍽️', '야~호! 밥이다!', '냠냠냠! ❤️']))
  floatText(sel.x, getFloor() - getSize(sel) - 70, `+배고픔 ${Math.round(g)} 🍎`, '#f59e0b')
  sel.state = 'bounce'; sel.stateTimer = 50
  updatePanel()
})

btnPet.addEventListener('click', () => {
  if (!sel) return
  const g = 15 + Math.random() * 10
  sel.happiness = Math.min(100, sel.happiness + g)
  showBubble(sel, pick(['좋아요~ 💕', '행복해요! ✨', '기분 최고!', '또 해줘요! ❤️']))
  floatText(sel.x, getFloor() - getSize(sel) - 70, `+행복도 ${Math.round(g)} 💕`, '#ec4899')
  sel.state = 'bounce'; sel.stateTimer = 40
  updatePanel()
})

btnPlay.addEventListener('click', () => {
  if (!sel) return
  if (sel.energy < 15) { showBubble(sel, '너무 피곤해요... 😴'); return }
  const g = 18 + Math.random() * 10
  sel.happiness = Math.min(100, sel.happiness + g)
  sel.energy = Math.max(0, sel.energy - 15)
  showBubble(sel, pick(['야호! 신나요! 🎮', '같이 놀아요! 🎉', '재밌어요!! ✨', '더 놀아요! 🎈']))
  floatText(sel.x, getFloor() - getSize(sel) - 70, `+행복도 ${Math.round(g)} 🎮`, '#8b5cf6')
  floatText(sel.x, getFloor() - getSize(sel) - 90, '-에너지 15 💨', 'rgba(255,255,255,0.45)')
  sel.state = 'bounce'; sel.stateTimer = 70
  updatePanel()
})

btnSleep.addEventListener('click', () => {
  if (!sel) return
  if (sel.state === 'sleep') {
    sel.state = 'idle'; sel.stateTimer = 60; showBubble(sel, '일어났어요! ✨')
  } else {
    sel.state = 'sleep'; sel.stateTimer = 400; showBubble(sel, '잘게요~ 🌙 zzz')
  }
  updatePanel()
})

btnNew.addEventListener('click', () => {
  if (pets.length >= 8) { alert('동물이 너무 많아요! (최대 8마리)'); return }
  const usedNames = new Set(pets.map(p => p.spec.name))
  const available = SPECS.filter(s => !usedNames.has(s.name))
  const spec = available.length > 0 ? pick(available) : pick(SPECS)
  const pet = makePet(spec)
  pets.push(pet)
  setTimeout(() => showBubble(pet, pick(['안녕하세요! 😊', '잘 부탁해요! ✨', `저는 ${spec.name}이에요!`, '반가워요! 🎉'])), 500)
})

// ── AI 말하기 ────────────────────────────────────────────────────────────────
function maybeSpeak(pet: Pet) {
  if (Date.now() - pet.lastSpoke < 4000) return
  if (Math.random() > 0.004) return
  let pool: string[]
  if (pet.hunger < 25)        pool = pet.spec.hungry
  else if (pet.happiness > 80) pool = pet.spec.happy
  else if (pet.happiness < 25) pool = pet.spec.bored
  else if (pet.state === 'sleep') pool = pet.spec.sleepy
  else pool = pet.spec.random
  showBubble(pet, pick(pool))
}

// ── 메인 루프 ────────────────────────────────────────────────────────────────
function tick(ts: number) {
  // 스탯 감소 (300ms마다)
  if (ts - lastTick >= 300) {
    lastTick = ts
    gameSeconds += 0.3
    dayLabel.textContent = `Day ${Math.floor(gameSeconds / 30) + 1}`
    for (const p of pets) {
      p.age += 0.3
      if (p.state === 'sleep') {
        p.energy = Math.min(100, p.energy + 2.5)
        if (p.energy >= 100) { p.state = 'idle'; p.stateTimer = 60 }
      } else {
        p.hunger    = Math.max(0, p.hunger    - 1.2)
        p.happiness = Math.max(0, p.happiness - 0.5)
        p.energy    = Math.max(0, p.energy    - 0.4)
        if (p.energy < 5 && p.state !== 'sleep') {
          p.state = 'sleep'; p.stateTimer = 350
          if (Math.random() < 0.5) showBubble(p, '피곤해요... 💤', 2000)
        }
      }
      if (p === sel) updatePanel()
    }
  }

  // 물리 + 렌더링
  const floor = getFloor()
  const right = getRight()
  let phase = ts * 0.005

  for (const p of pets) {
    // 상태 전환
    p.stateTimer--
    if (p.stateTimer <= 0) {
      if (p.state !== 'sleep') {
        const r = Math.random()
        p.state = r < 0.55 ? 'walk' : 'idle'
        p.vx = p.state === 'walk' ? (Math.random() - 0.5) * 2.2 : 0
        p.stateTimer = 60 + Math.floor(Math.random() * 120)
      } else {
        p.stateTimer = 80
      }
    }

    if (p.state === 'walk') {
      p.x += p.vx
      if (p.x < 50) { p.x = 50; p.vx *= -1 }
      if (p.x > right) { p.x = right; p.vx *= -1 }
    }

    if (p.state === 'bounce') {
      p.x += Math.sin(phase * 3) * 1.2
    }

    // 말풍선 타이머
    if (p.bubbleEl) {
      p.bubbleTimer -= 16
      if (p.bubbleTimer <= 0) { p.bubbleEl.remove(); p.bubbleEl = null }
      else placeBubble(p)
    }

    // 랜덤 발화
    maybeSpeak(p)

    // DOM 업데이트
    const size = getSize(p)
    p.emojiEl.style.fontSize = `${size}px`
    const y = floor - size
    p.el.style.transform = `translate(${Math.round(p.x - size / 2)}px, ${Math.round(y + (p.state === 'bounce' ? Math.abs(Math.sin(phase * 6)) * -8 : 0))}px)`

    // 수면 흔들기
    if (p.state === 'sleep') {
      p.el.style.transform += ` rotate(${Math.sin(phase) * 3}deg)`
    }
  }

  requestAnimationFrame(tick)
}

// ── 초기 동물 3마리 ────────────────────────────────────────────────────────────
document.fonts.ready.then(() => {
  const starters = [SPECS[0]!, SPECS[1]!, SPECS[2]!]
  starters.forEach((spec, i) => {
    const p = makePet(spec)
    pets.push(p)
    setTimeout(() => showBubble(p, pick(['안녕하세요! 😊', `저는 ${spec.name}이에요!`, '잘 부탁해요~ ✨'])), i * 400 + 300)
  })
  requestAnimationFrame(tick)
})
