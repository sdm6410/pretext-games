import { prepareWithSegments, walkLineRanges } from '../src/layout.ts'

// ── Pretext: 데미지 텍스트 정밀 중앙 정렬 ────────────────────────────────────
// DOM 없이 텍스트 너비를 측정해서 캔버스 위 정중앙에 배치
function showDamage(x: number, y: number, text: string, color: string) {
  const font = 'bold 18px "Inter", system-ui, sans-serif'
  const prepared = prepareWithSegments(text, font)
  let w = 0
  walkLineRanges(prepared, 300, ln => { if (ln.width > w) w = ln.width })

  const el = document.createElement('div')
  el.className = 'ftext'
  el.textContent = text
  el.style.cssText = `left:${Math.round(x - w / 2)}px;top:${Math.round(y)}px;color:${color};font-size:18px;`
  floats.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}

// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const floats = document.getElementById('floats')!
const scoreEl = document.getElementById('score-val')!
const bcountEl = document.getElementById('bcount')!
const lvEl = document.getElementById('lv')!

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
resize()
window.addEventListener('resize', resize)

// ── Physics types ─────────────────────────────────────────────────────────────
type Vec2 = { x: number; y: number }

type Block = {
  x: number; y: number; w: number; h: number
  vx: number; vy: number; rot: number; rotV: number
  hp: number; maxHp: number
  material: 'wood' | 'stone' | 'ice'
  fallen: boolean
}

type Pig = {
  x: number; y: number; r: number
  vx: number; vy: number
  hp: number; maxHp: number
  dead: boolean
  squish: number  // animation
}

type Bird = {
  x: number; y: number; r: number
  vx: number; vy: number
  active: boolean
  trail: Vec2[]
  type: '🐦' | '🔴' | '💛' | '💙'
}

// ── Game state ────────────────────────────────────────────────────────────────
const GRAVITY = 0.35
const GROUND_Y = () => canvas.height - 80
const SLING_X = 160
const SLING_Y = () => GROUND_Y() - 80

let blocks: Block[] = []
let pigs: Pig[] = []
let birds: Bird[] = []
let currentBird: Bird | null = null
let birdQueue: ('🐦' | '🔴' | '💛' | '💙')[] = []
let score = 0
let level = 1
let isDragging = false
let dragStart: Vec2 = { x: 0, y: 0 }
let dragCurrent: Vec2 = { x: 0, y: 0 }
let launched = false
let frame = 0

// ── Level definitions ─────────────────────────────────────────────────────────
type LevelDef = { pigs: Pig[]; blocks: Block[]; queue: ('🐦' | '🔴' | '💛' | '💙')[] }

function makeBlock(x: number, y: number, w: number, h: number, mat: Block['material'], hp: number): Block {
  return { x, y, w, h, vx: 0, vy: 0, rot: 0, rotV: 0, hp, maxHp: hp, material: mat, fallen: false }
}

function makePig(x: number, y: number, r: number, hp: number): Pig {
  return { x, y, r, vx: 0, vy: 0, hp, maxHp: hp, dead: false, squish: 0 }
}

function getLevel(lv: number): LevelDef {
  const gnd = GROUND_Y()
  const levels: LevelDef[] = [
    // Level 1 — simple tower
    {
      queue: ['🔴', '🔴', '💛', '💙'],
      pigs: [makePig(700, gnd - 30, 28, 60)],
      blocks: [
        makeBlock(680, gnd - 100, 40, 70, 'wood', 80),
        makeBlock(680, gnd - 30, 40, 30, 'stone', 120),
      ],
    },
    // Level 2 — two towers
    {
      queue: ['🔴', '🔴', '💛', '💛', '💙'],
      pigs: [makePig(650, gnd - 30, 28, 80), makePig(900, gnd - 30, 28, 80)],
      blocks: [
        makeBlock(620, gnd - 120, 60, 90, 'wood', 80),
        makeBlock(620, gnd - 30, 60, 30, 'stone', 120),
        makeBlock(870, gnd - 120, 60, 90, 'ice', 50),
        makeBlock(870, gnd - 30, 60, 30, 'wood', 80),
      ],
    },
    // Level 3 — fortress
    {
      queue: ['🔴', '🔴', '💛', '💛', '💙', '💙'],
      pigs: [makePig(700, gnd - 35, 30, 100), makePig(820, gnd - 35, 30, 100), makePig(760, gnd - 130, 25, 60)],
      blocks: [
        makeBlock(660, gnd - 30,  20, 30, 'stone', 200),
        makeBlock(840, gnd - 30,  20, 30, 'stone', 200),
        makeBlock(660, gnd - 80,  20, 50, 'wood',  80),
        makeBlock(840, gnd - 80,  20, 50, 'wood',  80),
        makeBlock(660, gnd - 160, 200, 20, 'wood', 80),
        makeBlock(730, gnd - 180, 60, 50, 'ice',  50),
      ],
    },
  ]
  return levels[(lv - 1) % levels.length]!
}

// ── Bird queue display ────────────────────────────────────────────────────────
function updateBirdUI() {
  bcountEl.textContent = birdQueue.map(b => b).join('')
}

// ── Load level ────────────────────────────────────────────────────────────────
function loadLevel(lv: number) {
  const def = getLevel(lv)
  blocks = def.blocks
  pigs   = def.pigs
  birdQueue = [...def.queue]
  currentBird = null
  launched = false
  isDragging = false
  lvEl.textContent = String(lv)
  updateBirdUI()
  spawnNextBird()
}

function spawnNextBird() {
  if (birdQueue.length === 0) { currentBird = null; return }
  const type = birdQueue.shift()!
  updateBirdUI()
  currentBird = {
    x: SLING_X, y: SLING_Y(),
    vx: 0, vy: 0, r: 18,
    active: false, trail: [],
    type,
  }
  launched = false
}

// ── Collision helpers ─────────────────────────────────────────────────────────
function circleRect(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw))
  const nearY = Math.max(ry, Math.min(cy, ry + rh))
  const dx = cx - nearX, dy = cy - nearY
  return dx * dx + dy * dy < cr * cr
}

function circleCircle(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const dx = ax - bx, dy = ay - by
  return dx * dx + dy * dy < (ar + br) * (ar + br)
}

// ── Input ─────────────────────────────────────────────────────────────────────
canvas.addEventListener('pointerdown', e => {
  if (!currentBird || launched) return
  const b = currentBird
  const dx = e.clientX - b.x, dy = e.clientY - b.y
  if (dx * dx + dy * dy < 40 * 40) {
    isDragging = true
    dragStart = { x: b.x, y: b.y }
  }
})

canvas.addEventListener('pointermove', e => {
  if (!isDragging) return
  dragCurrent = { x: e.clientX, y: e.clientY }
  // Clamp pull distance
  const dx = dragCurrent.x - dragStart.x, dy = dragCurrent.y - dragStart.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const maxDist = 100
  if (dist > maxDist) {
    dragCurrent.x = dragStart.x + (dx / dist) * maxDist
    dragCurrent.y = dragStart.y + (dy / dist) * maxDist
  }
  if (currentBird) { currentBird.x = dragCurrent.x; currentBird.y = dragCurrent.y }
})

canvas.addEventListener('pointerup', () => {
  if (!isDragging || !currentBird) return
  isDragging = false
  const dx = dragStart.x - currentBird.x
  const dy = dragStart.y - currentBird.y
  const power = 0.16
  currentBird.vx = dx * power
  currentBird.vy = dy * power
  currentBird.active = true
  launched = true
})

// ── Score ─────────────────────────────────────────────────────────────────────
function addScore(pts: number) {
  score += pts
  scoreEl.textContent = score.toLocaleString()
}

// ── Win / Fail check ──────────────────────────────────────────────────────────
let checkDelay = 0
function checkGameState() {
  const allPigsDead = pigs.every(p => p.dead)
  const noBirdsLeft = birdQueue.length === 0 && !currentBird && launched

  if (allPigsDead) {
    setTimeout(() => showOverlay(true), 800)
  } else if (noBirdsLeft) {
    setTimeout(() => showOverlay(false), 1000)
  }
}

const overlay = document.getElementById('overlay')!
const ovlTitle = document.getElementById('overlay-title')!
const ovlSub   = document.getElementById('overlay-sub')!
const ovlScore = document.getElementById('overlay-score')!
const ovlNext  = document.getElementById('ovl-next')!

function showOverlay(won: boolean) {
  ovlTitle.textContent = won ? '🎉' : '😢'
  ovlSub.textContent   = won ? '레벨 클리어!' : '실패...'
  ovlScore.textContent = `점수: ${score.toLocaleString()}`
  ovlNext.textContent  = won ? `레벨 ${level + 1} ▶` : '다시 도전 ▶'
  overlay.classList.add('on')
}

ovlNext.addEventListener('click', () => {
  overlay.classList.remove('on')
  if (ovlSub.textContent === '레벨 클리어!') level++
  loadLevel(level)
})

// ── Colors ────────────────────────────────────────────────────────────────────
const MAT_COLORS: Record<string, string> = {
  wood: '#8B5A2B', stone: '#6b7280', ice: '#93c5fd',
}
const MAT_STROKE: Record<string, string> = {
  wood: '#5C3317', stone: '#4b5563', ice: '#60a5fa',
}

// ── Draw functions ────────────────────────────────────────────────────────────
function drawGround() {
  const gnd = GROUND_Y()
  ctx.fillStyle = '#2d5016'
  ctx.fillRect(0, gnd, canvas.width, canvas.height - gnd)
  ctx.strokeStyle = 'rgba(80,160,30,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(0, gnd); ctx.lineTo(canvas.width, gnd); ctx.stroke()
  // Grass blades
  ctx.strokeStyle = 'rgba(100,180,40,0.3)'
  ctx.lineWidth = 1.5
  for (let x = 0; x < canvas.width; x += 15) {
    ctx.beginPath(); ctx.moveTo(x, gnd)
    ctx.lineTo(x + 4, gnd - 8 - Math.sin(x * 0.3) * 4); ctx.stroke()
  }
}

function drawSlingshot() {
  const sx = SLING_X, sy = SLING_Y() + 10, gnd = GROUND_Y()
  ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 8; ctx.lineCap = 'round'
  // Fork
  ctx.beginPath(); ctx.moveTo(sx, gnd); ctx.lineTo(sx - 14, sy - 20); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx, gnd); ctx.lineTo(sx + 14, sy - 20); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx, gnd); ctx.lineTo(sx, sy + 10); ctx.stroke()
  // Rubber band
  if (currentBird && !launched) {
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(sx - 14, sy - 20); ctx.lineTo(currentBird.x, currentBird.y); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sx + 14, sy - 20); ctx.lineTo(currentBird.x, currentBird.y); ctx.stroke()
  } else {
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(sx - 14, sy - 20); ctx.lineTo(sx + 14, sy - 20); ctx.stroke()
  }
}

function drawBlock(b: Block) {
  ctx.save()
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2)
  ctx.rotate(b.rot)

  const dmgRatio = b.hp / b.maxHp
  ctx.fillStyle = MAT_COLORS[b.material]!
  ctx.globalAlpha = 0.4 + dmgRatio * 0.6

  const rnd = 4
  ctx.beginPath()
  ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, rnd)
  ctx.fill()
  ctx.strokeStyle = MAT_STROKE[b.material]!
  ctx.lineWidth = 2; ctx.stroke()

  // Material emoji label
  const mat = b.material === 'wood' ? '🪵' : b.material === 'stone' ? '🪨' : '🧊'
  ctx.globalAlpha = dmgRatio * 0.9
  ctx.font = `${Math.min(b.w, b.h) * 0.55}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(mat, 0, 0)

  ctx.restore()
}

function drawPig(p: Pig) {
  if (p.dead) return
  ctx.save()
  ctx.translate(p.x, p.y)

  const dmg = p.hp / p.maxHp
  // Body
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2)
  ctx.fillStyle = dmg > 0.5 ? '#4ade80' : '#f87171'
  ctx.fill()
  ctx.strokeStyle = dmg > 0.5 ? '#16a34a' : '#ef4444'; ctx.lineWidth = 2.5; ctx.stroke()

  // Face
  ctx.font = `${p.r * 1.2}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 1
  ctx.fillText(dmg > 0.5 ? '🐷' : '😵', 0, 0)

  // HP bar
  const bw = p.r * 2.5, bx = -bw / 2, by = -p.r - 12
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 5)
  ctx.fillStyle = dmg > 0.5 ? '#4ade80' : '#ef4444'
  ctx.fillRect(bx, by, bw * dmg, 5)

  ctx.restore()
}

function drawBird(b: Bird) {
  // Trail
  ctx.save()
  for (let i = 0; i < b.trail.length; i++) {
    const t = b.trail[i]!
    const alpha = (i / b.trail.length) * 0.4
    const r = b.r * (i / b.trail.length) * 0.7
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,100,${alpha})`; ctx.fill()
  }
  ctx.restore()

  // Bird emoji
  ctx.font = `${b.r * 2.2}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(b.type, b.x, b.y)
}

function drawTrajectory() {
  if (!currentBird || !isDragging) return
  const dx = (SLING_X - currentBird.x) * 0.16
  const dy = (SLING_Y() - currentBird.y) * 0.16
  let px = SLING_X, py = SLING_Y(), pvx = dx, pvy = dy

  ctx.save(); ctx.strokeStyle = 'rgba(255,255,200,0.25)'; ctx.lineWidth = 1.5
  ctx.setLineDash([5, 8])
  ctx.beginPath(); ctx.moveTo(px, py)
  for (let i = 0; i < 30; i++) {
    pvx *= 0.99; pvy += GRAVITY
    px += pvx; py += pvy
    if (py > GROUND_Y()) break
    ctx.lineTo(px, py)
  }
  ctx.stroke(); ctx.setLineDash([]); ctx.restore()
}

// ── Physics step ──────────────────────────────────────────────────────────────
let lastCheckFrame = 0

function physicsStep() {
  const gnd = GROUND_Y()

  // Bird physics
  if (currentBird && currentBird.active) {
    const b = currentBird
    b.vy += GRAVITY
    b.x += b.vx; b.y += b.vy
    b.trail.push({ x: b.x, y: b.y })
    if (b.trail.length > 18) b.trail.shift()

    // Ground
    if (b.y + b.r > gnd) {
      b.y = gnd - b.r; b.vy *= -0.3; b.vx *= 0.7
      if (Math.abs(b.vy) < 2) { b.vy = 0; b.active = false; setTimeout(nextBird, 600) }
    }
    // Off-screen
    if (b.x > canvas.width + 100 || b.y > gnd + 100) {
      b.active = false; nextBird()
    }

    // Hit blocks
    for (const bl of blocks) {
      if (circleRect(b.x, b.y, b.r, bl.x, bl.y, bl.w, bl.h)) {
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
        const dmg = Math.round(speed * 8 + 10)
        bl.hp = Math.max(0, bl.hp - dmg)
        bl.vx += b.vx * 0.3; bl.vy += b.vy * 0.3 - 2
        bl.rotV += (Math.random() - 0.5) * 0.1
        if (bl.material !== 'stone') showDamage(bl.x + bl.w / 2, bl.y - 10, `-${dmg}`, '#fbbf24')
        addScore(dmg)
        b.vx *= 0.5; b.vy *= -0.4
      }
    }

    // Hit pigs
    for (const p of pigs) {
      if (p.dead) continue
      if (circleCircle(b.x, b.y, b.r, p.x, p.y, p.r)) {
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
        const dmg = Math.round(speed * 12 + 20)
        p.hp = Math.max(0, p.hp - dmg)
        p.vx += b.vx * 0.5; p.vy += b.vy * 0.5 - 3
        showDamage(p.x, p.y - p.r - 24, `-${dmg}`, '#ef4444')
        addScore(dmg * 2)
        if (p.hp <= 0) {
          p.dead = true
          showDamage(p.x, p.y - p.r - 30, '💀 격파! +500', '#f59e0b')
          addScore(500)
        }
        b.vx *= 0.4; b.vy *= -0.3
      }
    }
  }

  // Block physics
  for (const bl of blocks) {
    if (bl.hp <= 0 && !bl.fallen) {
      bl.fallen = true
      showDamage(bl.x + bl.w / 2, bl.y, '💥', '#f97316')
    }
    if (bl.hp > 0) {
      bl.vy += GRAVITY * 0.5
      bl.x += bl.vx; bl.y += bl.vy
      bl.rot += bl.rotV; bl.rotV *= 0.95; bl.vx *= 0.98
      if (bl.y + bl.h > gnd) { bl.y = gnd - bl.h; bl.vy *= -0.25; bl.vx *= 0.8 }
      if (bl.x < 0) { bl.x = 0; bl.vx *= -0.5 }
      if (bl.x + bl.w > canvas.width) { bl.x = canvas.width - bl.w; bl.vx *= -0.5 }
    }
  }

  // Pig physics
  for (const p of pigs) {
    if (p.dead) continue
    p.vy += GRAVITY * 0.3
    p.x += p.vx; p.y += p.vy
    p.vx *= 0.95; p.vy *= 0.98
    if (p.y + p.r > gnd) { p.y = gnd - p.r; p.vy *= -0.2; p.vx *= 0.85 }
  }

  // Check win/fail after launch
  if (launched && frame - lastCheckFrame > 120) {
    lastCheckFrame = frame
    const birdMoving = currentBird && (Math.abs(currentBird.vx) > 0.5 || Math.abs(currentBird.vy) > 0.5)
    if (!birdMoving) checkGameState()
  }
}

function nextBird() {
  currentBird = null
  launched = false
  setTimeout(() => {
    checkGameState()
    if (!pigs.every(p => p.dead)) spawnNextBird()
  }, 500)
}

// ── Main game loop ────────────────────────────────────────────────────────────
function gameLoop() {
  frame++
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  drawGround()
  drawSlingshot()
  drawTrajectory()

  for (const bl of blocks) if (bl.hp > 0) drawBlock(bl)
  for (const p of pigs) drawPig(p)
  if (currentBird) drawBird(currentBird)

  physicsStep()
  requestAnimationFrame(gameLoop)
}

// ── Start ─────────────────────────────────────────────────────────────────────
loadLevel(1)
gameLoop()
