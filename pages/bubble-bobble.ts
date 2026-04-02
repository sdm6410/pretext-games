import { prepareWithSegments, walkLineRanges } from '../src/layout.ts'

// ── DOM & Context ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const floats = document.getElementById('floats')!
const scoreEl = document.getElementById('score-val')!

const CW = 800
const CH = 600

// ── Game State ────────────────────────────────────────────────────────────────
let score = 0
let level = 1
let frame = 0
let gameOver = false

const keys = { Left: false, Right: false, Up: false, Space: false }
let lastSpace = false

// ── Pretext Floating Points ───────────────────────────────────────────────────
function showPoints(x: number, y: number, text: string, color: string) {
  const font = '900 24px "Impact", "Inter", sans-serif'
  const prepared = prepareWithSegments(text, font)
  let w = 0
  walkLineRanges(prepared, 300, ln => { if (ln.width > w) w = ln.width })

  const el = document.createElement('div')
  el.className = 'ftext'
  el.textContent = text
  el.style.cssText = `left:${Math.round(x - w / 2)}px;top:${Math.round(y)}px;color:${color};`
  floats.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}

function addScore(pts: number, x?: number, y?: number, color = '#fbbf24') {
  score += pts
  scoreEl.textContent = score.toString().padStart(6, '0')
  if (x !== undefined && y !== undefined) {
    showPoints(x, y, `+${pts}`, color)
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number }
type Platform = Rect & { type: 'solid' | 'jump-through' }

type Player = {
  x: number; y: number; w: number; h: number
  vx: number; vy: number
  dir: 1 | -1
  isGrounded: boolean
  dead: boolean
}

type Bubble = {
  x: number; y: number; r: number
  vx: number; vy: number
  type: 'empty' | 'trapped'
  enemyType?: string
  lifetime: number
  dir: 1 | -1
}

type Enemy = {
  x: number; y: number; w: number; h: number
  vx: number; vy: number
  dir: 1 | -1
  type: string
  dead: boolean
  isGrounded: boolean
}

type Item = {
  x: number; y: number; w: number; h: number
  vy: number
  type: string
  points: number
  dead: boolean
}

// ── Entities ──────────────────────────────────────────────────────────────────
let player: Player
let platforms: Platform[] = []
let bubbles: Bubble[] = []
let enemies: Enemy[] = []
let items: Item[] = []

const GRAVITY = 0.4
const JUMP_FORCE = -8.5
const MOVE_SPEED = 3.5
const BUBBLE_SPEED = 8

// ── Level Design ──────────────────────────────────────────────────────────────
function loadLevel(lv: number) {
  bubbles = []
  items = []
  
  // Standard borders
  platforms = [
    { x: 0, y: 0, w: 20, h: CH, type: 'solid' }, // Left wall
    { x: CW - 20, y: 0, w: 20, h: CH, type: 'solid' }, // Right wall
    { x: 0, y: CH - 40, w: CW, h: 40, type: 'solid' }, // Floor
    { x: 0, y: -40, w: CW, h: 40, type: 'solid' }, // Ceiling
  ]

  if (lv === 1) {
    platforms.push(
      { x: 100, y: CH - 150, w: 200, h: 20, type: 'jump-through' },
      { x: CW - 300, y: CH - 150, w: 200, h: 20, type: 'jump-through' },
      { x: 250, y: CH - 300, w: 300, h: 20, type: 'jump-through' },
      { x: 100, y: CH - 450, w: 150, h: 20, type: 'jump-through' },
      { x: CW - 250, y: CH - 450, w: 150, h: 20, type: 'jump-through' }
    )
    enemies = [
      { x: 150, y: 100, w: 32, h: 32, vx: -1.5, vy: 0, dir: -1, type: '👾', dead: false, isGrounded: false },
      { x: CW - 150, y: 100, w: 32, h: 32, vx: 1.5, vy: 0, dir: 1, type: '👻', dead: false, isGrounded: false },
      { x: 300, y: CH - 350, w: 32, h: 32, vx: 1.5, vy: 0, dir: 1, type: '👾', dead: false, isGrounded: false }
    ]
  } else {
    platforms.push(
      { x: 150, y: CH - 120, w: 500, h: 20, type: 'jump-through' },
      { x: 50, y: CH - 240, w: 200, h: 20, type: 'jump-through' },
      { x: CW - 250, y: CH - 240, w: 200, h: 20, type: 'jump-through' },
      { x: 250, y: CH - 380, w: 300, h: 20, type: 'jump-through' },
      { x: 350, y: CH - 500, w: 100, h: 20, type: 'jump-through' }
    )
    enemies = [
      { x: 200, y: 100, w: 32, h: 32, vx: 2, vy: 0, dir: 1, type: '👻', dead: false, isGrounded: false },
      { x: CW - 200, y: 100, w: 32, h: 32, vx: -2, vy: 0, dir: -1, type: '👻', dead: false, isGrounded: false },
      { x: 100, y: CH - 280, w: 32, h: 32, vx: 1.5, vy: 0, dir: 1, type: '👾', dead: false, isGrounded: false },
      { x: CW - 100, y: CH - 280, w: 32, h: 32, vx: -1.5, vy: 0, dir: -1, type: '👾', dead: false, isGrounded: false }
    ]
  }

  player = { x: 50, y: CH - 100, w: 36, h: 36, vx: 0, vy: 0, dir: 1, isGrounded: false, dead: false }
  
  gameOver = false
  const overlay = document.getElementById('overlay')!
  overlay.classList.remove('on')
}

// ── Input Handling ────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.code === 'ArrowLeft') keys.Left = true
  if (e.code === 'ArrowRight') keys.Right = true
  if (e.code === 'ArrowUp') keys.Up = true
  if (e.code === 'Space') keys.Space = true
})

window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft') keys.Left = false
  if (e.code === 'ArrowRight') keys.Right = false
  if (e.code === 'ArrowUp') keys.Up = false
  if (e.code === 'Space') keys.Space = false
})

// ── Physics Helpers ───────────────────────────────────────────────────────────
function AABB(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

function resolvePlatformCollision(rect: Rect, vy: number): number {
  let isGrounded = false
  for (const plat of platforms) {
    if (plat.type === 'solid') {
      if (AABB(rect.x, rect.y, rect.w, rect.h, plat.x, plat.y, plat.w, plat.h)) {
        if (vy > 0 && rect.y + rect.h - vy <= plat.y + 1) { rect.y = plat.y - rect.h; isGrounded = true }
        else if (vy < 0 && rect.y - vy >= plat.y + plat.h - 1) { rect.y = plat.y + plat.h; vy = 0 }
        // Simple wall collision
        else {
          const cx = rect.x + rect.w/2, px = plat.x + plat.w/2
          if (cx < px) rect.x = plat.x - rect.w
          else rect.x = plat.x + plat.w
        }
      }
    } else if (plat.type === 'jump-through') {
      if (vy > 0 && rect.y + rect.h - vy <= plat.y + 1 && AABB(rect.x, rect.y, rect.w, rect.h, plat.x, plat.y, plat.w, plat.h)) {
        rect.y = plat.y - rect.h; isGrounded = true
      }
    }
  }
  return isGrounded ? 0 : vy
}

// ── Core Loop ─────────────────────────────────────────────────────────────────
function update() {
  if (gameOver) return
  frame++

  // -- Player Update --
  if (!player.dead) {
    if (keys.Left) { player.vx = -MOVE_SPEED; player.dir = -1 }
    else if (keys.Right) { player.vx = MOVE_SPEED; player.dir = 1 }
    else player.vx = 0

    if (keys.Up && player.isGrounded) { player.vy = JUMP_FORCE; player.isGrounded = false }
    
    player.vy += GRAVITY
    player.x += player.vx
    player.y += player.vy
    
    player.isGrounded = false
    const groundVy = resolvePlatformCollision(player, player.vy)
    if (groundVy === 0 && player.vy > 0) player.isGrounded = true
    player.vy = groundVy

    // Wrap around screen horizontally or vertically if falling
    if (player.x < -player.w) player.x = CW
    if (player.x > CW) player.x = -player.w
    if (player.y > CH) player.y = -50

    // Shoot Bubble
    if (keys.Space && !lastSpace) {
      bubbles.push({
        x: player.x + (player.dir === 1 ? player.w : -24), y: player.y + 4,
        r: 16, vx: player.dir * BUBBLE_SPEED, vy: 0,
        type: 'empty', lifetime: 0, dir: player.dir
      })
    }
    lastSpace = keys.Space
  }

  // -- Bubble Update --
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]!
    b.lifetime++

    if (b.type === 'empty') {
      // Fly straight, then float up
      if (b.lifetime > 25) { b.vx *= 0.9; b.vy = -1.5 }
      
      // Wobble
      b.x += b.vx; b.y += b.vy + Math.sin(b.lifetime * 0.1) * 0.5
      if (b.x < 20) b.x = 20; if (b.x > CW - 20) b.x = CW - 20 // stick to walls
      
      // Hit Enemy
      for (const e of enemies) {
        if (!e.dead && AABB(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, e.x, e.y, e.w, e.h)) {
          e.dead = true
          b.type = 'trapped'
          b.enemyType = e.type
          b.vx = 0
          b.lifetime = 0
          addScore(10, b.x, b.y, '#fafafa')
          break
        }
      }

      if (b.lifetime > 400 || (b.y < 50 && Math.random() < 0.01)) { bubbles.splice(i, 1); continue }
    } else {
      // Trapped Bubble floats to top
      b.vy = -1.0; b.x += Math.sin(b.lifetime * 0.05) * 0.6; b.y += b.vy
      if (b.y < 50) b.y = 50 // gather at top

      // Player pops trapped bubble
      if (!player.dead && AABB(player.x, player.y, player.w, player.h, b.x - b.r, b.y - b.r, b.r*2, b.r*2)) {
        addScore(1000, b.x, b.y, '#f472b6')
        // Spawn Item
        items.push({ x: b.x - 12, y: b.y, w: 24, h: 24, vy: -3, type: Math.random() > 0.5 ? '🍒' : '🍉', points: 500, dead: false })
        bubbles.splice(i, 1)
        checkClear()
        continue
      }

      // Escape after long time
      if (b.lifetime > 300) {
        // Red enemy revenge!
        enemies.push({ x: b.x - 16, y: b.y - 16, w: 32, h: 32, vx: -2, vy: 0, dir: -1, type: '👹', dead: false, isGrounded: false })
        bubbles.splice(i, 1)
        continue
      }
    }

    // Player pops empty bubble (jump on it or headbutt)
    if (b.type === 'empty' && !player.dead) {
      if (AABB(player.x, player.y, player.w, player.h, b.x - b.r, b.y - b.r, b.r*2, b.r*2)) {
        if (player.vy > 0 && player.y + player.h < b.y) {
          player.vy = JUMP_FORCE * 0.8 // bounce!
        }
        bubbles.splice(i, 1)
        addScore(10)
      }
    }
  }

  // -- Enemy Update --
  for (const e of enemies) {
    if (e.dead) continue
    e.vy += GRAVITY
    e.x += e.vx; e.y += e.vy
    
    e.isGrounded = false
    const groundVy = resolvePlatformCollision(e, e.vy)
    if (groundVy === 0) e.isGrounded = true
    e.vy = groundVy

    // Turn around at walls
    if (e.x <= 20) { e.x = 20; e.vx *= -1; e.dir = 1 }
    if (e.x + e.w >= CW - 20) { e.x = CW - 20 - e.w; e.vx *= -1; e.dir = -1 }
    if (Math.random() < 0.005 && e.isGrounded) e.vy = JUMP_FORCE * 0.8 // Random jump

    // Hit Player
    if (!player.dead && AABB(player.x, player.y, player.w, player.h, e.x + 4, e.y + 4, e.w - 8, e.h - 8)) {
      player.dead = true
      player.vy = JUMP_FORCE
      setTimeout(() => { showGameOver() }, 1500)
    }
  }

  // -- Items Update --
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!
    item.vy += GRAVITY
    item.y += item.vy
    item.vy = resolvePlatformCollision(item, item.vy)
    
    if (!player.dead && AABB(player.x, player.y, player.w, player.h, item.x, item.y, item.w, item.h)) {
      addScore(item.points, item.x, item.y, '#34d399')
      items.splice(i, 1)
    }
  }
}

function checkClear() {
  const allDead = enemies.every(e => e.dead) && bubbles.filter(b => b.type === 'trapped').length === 0
  if (allDead && items.length === 0) {
    gameOver = true
    const overlay = document.getElementById('overlay')!
    document.getElementById('overlay-title')!.textContent = 'LEVEL CLEAR'
    document.getElementById('overlay-sub')!.textContent = '모든 적을 무찔렀습니다!'
    const btn = document.getElementById('ovl-next')!
    btn.textContent = '다음 레벨 ▶'
    btn.onclick = () => loadLevel(level === 1 ? 2 : 1) // Loop levels for prototype
    overlay.classList.add('on')
  }
}

function showGameOver() {
  gameOver = true
  const overlay = document.getElementById('overlay')!
  document.getElementById('overlay-title')!.textContent = 'GAME OVER'
  document.getElementById('overlay-title')!.style.color = '#ef4444'
  document.getElementById('overlay-sub')!.textContent = '공룡이 당했습니다...'
  const btn = document.getElementById('ovl-next')!
  btn.textContent = '다시 도전 🔄'
  btn.style.background = 'linear-gradient(135deg,#ef4444,#f97316)'
  btn.onclick = () => { score = 0; scoreEl.textContent = '000000'; loadLevel(1) }
  overlay.classList.add('on')
}

// ── Render Loop ───────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, CW, CH)

  // Level background (classic black, bordered)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, CW, CH)

  // Draw Platforms
  ctx.fillStyle = '#2dd4bf'
  for (const p of platforms) {
    if (p.type === 'solid') {
      ctx.fillStyle = '#1e1b4b'; ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.w, p.h)
    } else {
      ctx.fillStyle = '#10b981'; ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.lineWidth = 1; ctx.strokeStyle = '#34d399'; ctx.strokeRect(p.x, p.y, p.w, p.h)
    }
  }

  // Draw Items
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const it of items) {
    ctx.fillText(it.type, it.x + it.w/2, it.y + it.h/2)
  }

  // Draw Enemies
  ctx.font = '32px sans-serif'
  for (const e of enemies) {
    if (e.dead) continue
    ctx.save(); ctx.translate(e.x + e.w/2, e.y + e.h/2)
    if (e.dir === -1) ctx.scale(-1, 1) // Face direction
    ctx.fillText(e.type, 0, 0)
    ctx.restore()
  }

  // Draw Player
  if (!player.dead) {
    ctx.save(); ctx.translate(player.x + player.w/2, player.y + player.h/2)
    if (player.dir === -1) ctx.scale(-1, 1)
    ctx.font = '36px sans-serif'
    ctx.fillText('🦕', 0, -2)
    ctx.restore()
  }

  // Draw Bubbles
  ctx.lineWidth = 3
  for (const b of bubbles) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    if (b.type === 'empty') {
      ctx.fillStyle = 'rgba(167, 243, 208, 0.5)'
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)'
      ctx.fill(); ctx.stroke()
      // Shine
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x - 6, b.y - 6, 3, 0, Math.PI*2); ctx.fill()
    } else {
      ctx.fillStyle = 'rgba(232, 121, 249, 0.6)'
      ctx.strokeStyle = '#d946ef'
      ctx.fill(); ctx.stroke()
      ctx.font = '24px sans-serif'
      ctx.fillText(b.enemyType!, b.x, b.y)
    }
  }
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}

loadLevel(1)
loop()
