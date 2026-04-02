import { layout, prepareWithSegments, walkLineRanges, layoutWithLines } from '../src/layout.ts'

// ── Constants ──────────────────────────────────────────────────────────────
const FONT_FAMILY = '"Inter", system-ui, -apple-system, sans-serif'
const LINE_HEIGHT = 24
const PAD_X = 14
const PAD_Y = 11
const MAX_CONTENT_W = 340
const MIN_CONTENT_W = 40
const UI_H = 120        // approx UI panel height
const FLOOR_H = 64      // floor strip height
const GRAVITY = 0.38
const BOUNCE_Y = 0.42   // vertical restitution
const FRICTION = 0.88   // horizontal damping on floor
const ROT_DAMP = 0.86
const CARD_ELASTICITY = 0.55

const COLORS = [
  { r: '139,92,246',  bg: 'rgba(139,92,246,0.18)',  border: 'rgba(139,92,246,0.55)',  glow: '139,92,246'  },
  { r: '16,185,129',  bg: 'rgba(16,185,129,0.18)',  border: 'rgba(16,185,129,0.55)',  glow: '16,185,129'  },
  { r: '245,158,11',  bg: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.55)',  glow: '245,158,11'  },
  { r: '239,68,68',   bg: 'rgba(239,68,68,0.18)',   border: 'rgba(239,68,68,0.55)',   glow: '239,68,68'   },
  { r: '59,130,246',  bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.55)',  glow: '59,130,246'  },
  { r: '236,72,153',  bg: 'rgba(236,72,153,0.18)',  border: 'rgba(236,72,153,0.55)',  glow: '236,72,153'  },
  { r: '6,182,212',   bg: 'rgba(6,182,212,0.18)',   border: 'rgba(6,182,212,0.55)',   glow: '6,182,212'   },
  { r: '251,191,36',  bg: 'rgba(251,191,36,0.18)',  border: 'rgba(251,191,36,0.55)',  glow: '251,191,36'  },
]

const PRESETS = [
  '안녕하세요 👋', 'Hello World', 'مرحبا بالعالم 🌙', 'こんにちは ✨',
  '🚀 AGI 봄이다!', 'DOM 없이 측정', 'Bonjour! 🥐', 'The quick brown fox',
  '중력 실험 중 🧪', '物理エンジン', '한국어 + 아랍어 + 이모지', 'pretext ❤️',
  '⭐ 32k GitHub', 'Привет мир!', '🌈 Rainbow text',
]

// ── Types ──────────────────────────────────────────────────────────────────
type PhysCard = {
  x: number; y: number
  vx: number; vy: number
  w: number; h: number
  rot: number; rotV: number
  el: HTMLDivElement
  dragging: boolean
  dragOX: number; dragOY: number
  prevX: number; prevY: number
  fontSize: number
  colorIdx: number
}

// ── Dom refs ───────────────────────────────────────────────────────────────
const stage    = document.getElementById('stage')!
const bgTitle  = document.getElementById('bg-title')!
const input    = document.getElementById('text-input') as HTMLInputElement
const launchBtn = document.getElementById('launch-btn')!
const bombBtn  = document.getElementById('bomb-btn')!
const clearBtn = document.getElementById('clear-btn')!
const presetsEl = document.getElementById('presets')!

// ── State ──────────────────────────────────────────────────────────────────
const cards: PhysCard[] = []
let colorCounter = 0

// ── Presets setup ─────────────────────────────────────────────────────────
PRESETS.forEach(text => {
  const chip = document.createElement('button')
  chip.className = 'chip'
  chip.textContent = text
  chip.addEventListener('click', () => spawn(text))
  presetsEl.appendChild(chip)
})

// ── Measure text with Pretext ─────────────────────────────────────────────
function measureText(text: string, fontSize: number) {
  const font = `${fontSize}px ${FONT_FAMILY}`
  const lineH = Math.round(fontSize * 1.6)
  const prepared = prepareWithSegments(text, font)

  // Binary search for tightest wrap width (core Pretext shrinkwrap trick!)
  const baseLineCount = layout(prepared, MAX_CONTENT_W, lineH).lineCount
  let lo = MIN_CONTENT_W, hi = MAX_CONTENT_W

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (layout(prepared, mid, lineH).lineCount <= baseLineCount) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }

  const tightWidth = lo
  let maxLineW = 0
  walkLineRanges(prepared, tightWidth, line => {
    if (line.width > maxLineW) maxLineW = line.width
  })

  const { lines } = layoutWithLines(prepared, tightWidth, lineH)
  return {
    w: Math.ceil(maxLineW) + PAD_X * 2,
    h: lines.length * lineH + PAD_Y * 2,
    lines: lines.map(l => l.text),
    lineH,
  }
}

// ── Spawn a card ───────────────────────────────────────────────────────────
function spawn(text: string) {
  const trimmed = text.trim()
  if (!trimmed || cards.length > 60) return

  // Hide background title once first card spawns
  if (cards.length === 0) bgTitle.style.opacity = '0'

  const fontSize = 13 + Math.floor(Math.random() * 8)   // 13–20px
  const { w, h, lines, lineH } = measureText(trimmed, fontSize)

  const cIdx = colorCounter++ % COLORS.length
  const color = COLORS[cIdx]!

  const el = document.createElement('div')
  el.className = 'card'
  el.style.cssText = `
    width: ${w}px;
    background: ${color.bg};
    border: 1px solid ${color.border};
    box-shadow: 0 4px 20px rgba(${color.glow},0.22), inset 0 1px 0 rgba(255,255,255,0.08);
    font-size: ${fontSize}px;
    line-height: ${lineH}px;
    animation: card-spawn 0.2s ease-out;
  `

  // Build line elements
  const inner = document.createElement('div')
  inner.className = 'card-inner'
  for (const lineText of lines) {
    const row = document.createElement('div')
    row.style.cssText = 'white-space:nowrap; overflow:visible;'
    row.textContent = lineText
    inner.appendChild(row)
  }
  el.appendChild(inner)

  // Measurement badge (the magic number Pretext calculated!)
  const badge = document.createElement('div')
  badge.className = 'measure-tag'
  badge.textContent = `${Math.round(w)}×${Math.round(h)}`
  el.appendChild(badge)

  stage.appendChild(el)

  // Spawn at top — random x, just above UI
  const x = Math.max(0, Math.random() * (window.innerWidth - w))
  const y = UI_H - h - 5

  const card: PhysCard = {
    x, y,
    vx: (Math.random() - 0.5) * 7,
    vy: Math.random() * 2 + 1,
    w, h,
    rot: (Math.random() - 0.5) * 14,
    rotV: (Math.random() - 0.5) * 3,
    el, dragging: false,
    dragOX: 0, dragOY: 0,
    prevX: x, prevY: y,
    fontSize, colorIdx: cIdx,
  }
  cards.push(card)
  setTransform(card)

  // ── Drag ──────────────────────────────────────────────────────────────
  el.addEventListener('pointerdown', e => {
    card.dragging = true
    card.dragOX = e.clientX - card.x
    card.dragOY = e.clientY - card.y
    card.vx = 0; card.vy = 0; card.rotV = 0
    el.setPointerCapture(e.pointerId)
    el.classList.add('dragging')
    e.preventDefault()
  })
  el.addEventListener('pointermove', e => {
    if (!card.dragging) return
    card.prevX = card.x; card.prevY = card.y
    card.x = e.clientX - card.dragOX
    card.y = e.clientY - card.dragOY
  })
  el.addEventListener('pointerup', e => {
    if (!card.dragging) return
    card.dragging = false
    el.classList.remove('dragging')
    // Throw velocity from drag motion
    card.vx = (card.x - card.prevX) * 0.9
    card.vy = (card.y - card.prevY) * 0.9
    card.rotV = card.vx * 0.25
  })
}

// ── Bomb explosion ─────────────────────────────────────────────────────────
function bomb() {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2

  // Visual shockwave
  const wave = document.createElement('div')
  wave.className = 'shockwave'
  document.body.appendChild(wave)
  wave.addEventListener('animationend', () => wave.remove())

  for (const card of cards) {
    const dx = (card.x + card.w / 2) - cx
    const dy = (card.y + card.h / 2) - cy
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const force = 900 / dist
    card.vx = (dx / dist) * force * 0.12
    card.vy = (dy / dist) * force * 0.12 - 10
    card.rotV = (Math.random() - 0.5) * 25
  }
}

// ── Clear ──────────────────────────────────────────────────────────────────
function clearAll() {
  for (const c of cards) c.el.remove()
  cards.length = 0
  bgTitle.style.opacity = '1'
}

// ── Physics helpers ────────────────────────────────────────────────────────
function setTransform(c: PhysCard) {
  c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.rot}deg)`
}

function getFloor() { return window.innerHeight - FLOOR_H }
function getRight() { return window.innerWidth }

// Basic AABB overlap
function overlaps(a: PhysCard, b: PhysCard) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y
}

// Resolve AABB collision
function resolve(a: PhysCard, b: PhysCard) {
  const overX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const overY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (overX <= 0 || overY <= 0) return

  if (overX < overY) {
    const sep = overX / 2
    if (a.x < b.x) { a.x -= sep; b.x += sep } else { a.x += sep; b.x -= sep }
    const avx = a.vx, bvx = b.vx
    a.vx = bvx * CARD_ELASTICITY + (a.vx - bvx) * -CARD_ELASTICITY
    b.vx = avx * CARD_ELASTICITY + (b.vx - avx) * -CARD_ELASTICITY
    a.rotV += a.vx * 0.1; b.rotV += b.vx * 0.1
  } else {
    const sep = overY / 2
    if (a.y < b.y) { a.y -= sep; b.y += sep } else { a.y += sep; b.y -= sep }
    const avy = a.vy, bvy = b.vy
    a.vy = bvy * CARD_ELASTICITY + (a.vy - bvy) * -CARD_ELASTICITY
    b.vy = avy * CARD_ELASTICITY + (b.vy - avy) * -CARD_ELASTICITY
  }
}

// ── Main physics loop ──────────────────────────────────────────────────────
function tick() {
  const floor = getFloor()
  const right = getRight()

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]!
    if (c.dragging) { setTransform(c); continue }

    // Gravity
    c.vy += GRAVITY

    // Move
    c.x += c.vx
    c.y += c.vy
    c.rot += c.rotV

    // Floor
    if (c.y + c.h >= floor) {
      c.y = floor - c.h
      c.vy *= -BOUNCE_Y
      c.vx *= FRICTION
      c.rotV *= ROT_DAMP
      if (Math.abs(c.vy) < 0.8) c.vy = 0
      if (Math.abs(c.vx) < 0.05) c.vx = 0
      if (Math.abs(c.rotV) < 0.05) c.rotV = 0
    }

    // Ceiling (below UI panel)
    if (c.y < UI_H) {
      c.y = UI_H
      if (c.vy < 0) c.vy *= -0.4
    }

    // Walls
    if (c.x < 0) { c.x = 0; c.vx *= -0.6 }
    if (c.x + c.w > right) { c.x = right - c.w; c.vx *= -0.6 }

    // Card–card collisions
    for (let j = i + 1; j < cards.length; j++) {
      const other = cards[j]!
      if (!other.dragging && overlaps(c, other)) resolve(c, other)
    }

    setTransform(c)
  }

  requestAnimationFrame(tick)
}

// ── Event bindings ─────────────────────────────────────────────────────────
launchBtn.addEventListener('click', () => {
  const t = input.value.trim()
  if (t) { spawn(t); input.value = '' }
})

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const t = input.value.trim()
    if (t) { spawn(t); input.value = '' }
  }
})

bombBtn.addEventListener('click', bomb)
clearBtn.addEventListener('click', clearAll)

// ── Kick off ───────────────────────────────────────────────────────────────
tick()

// Auto-spawn a few demo cards after fonts load
document.fonts.ready.then(() => {
  const starters = [
    '안녕! pretext 🎉',
    'DOM 없이 측정 ✨',
    'Arabic: مرحبا 🌙',
    '물리 엔진 + 타이포 🔥',
  ]
  starters.forEach((text, i) => setTimeout(() => spawn(text), i * 250 + 200))
})
