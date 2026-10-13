import "./style.css";
const canvas = document.querySelector<HTMLCanvasElement>("#game")!,
  ctx = canvas.getContext("2d")!,
  scoreEl = document.querySelector<HTMLSpanElement>("#score")!,
  statusEl = document.querySelector<HTMLSpanElement>("#status")!,
  startBtn = document.querySelector<HTMLButtonElement>("#startBtn")!;
type Vec = { x: number; y: number };
let running = false,
  score = 0,
  t = 0,
  player: Vec = { x: canvas.width / 2, y: canvas.height - 90 };
let keys = new Set<string>();
const enemies: Vec[] = [],
  bullets: Vec[] = [],
  particles: { x: number; y: number; life: number }[] = [];
function reset() {
  running = true;
  score = 0;
  t = 0;
  player = { x: canvas.width / 2, y: canvas.height - 90 };
  enemies.length = 0;
  bullets.length = 0;
  particles.length = 0;
  statusEl.textContent = "Playing";
}
function drawShip(x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "#64f4ff";
  ctx.shadowBlur = 18;
  const grad = ctx.createLinearGradient(0, -30, 0, 35);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.45, "#00d4ff");
  grad.addColorStop(1, "#875cff");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(25, 28);
  ctx.lineTo(0, 15);
  ctx.lineTo(-25, 28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffb000";
  ctx.beginPath();
  ctx.ellipse(0, 30, 8, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function spawnEnemy() {
  enemies.push({ x: 60 + Math.random() * (canvas.width - 120), y: -40 });
}
function update() {
  t++;
  const speed = 6;
  if (keys.has("ArrowLeft") || keys.has("a")) player.x -= speed;
  if (keys.has("ArrowRight") || keys.has("d")) player.x += speed;
  if (keys.has("ArrowUp") || keys.has("w")) player.y -= speed;
  if (keys.has("ArrowDown") || keys.has("s")) player.y += speed;
  player.x = Math.max(40, Math.min(canvas.width - 40, player.x));
  player.y = Math.max(70, Math.min(canvas.height - 40, player.y));
  if (t % 45 === 0) spawnEnemy();
  for (const b of bullets) b.y -= 11;
  for (const e of enemies) e.y += 2.2 + score * 0.006;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.y > canvas.height + 50) {
      enemies.splice(i, 1);
      continue;
    }
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j],
        dx = e.x - b.x,
        dy = e.y - b.y;
      if (dx * dx + dy * dy < 34 * 34) {
        enemies.splice(i, 1);
        bullets.splice(j, 1);
        score += 10;
        for (let k = 0; k < 18; k++)
          particles.push({ x: e.x, y: e.y, life: 25 + Math.random() * 20 });
        break;
      }
    }
  }
  for (const p of particles) p.life--;
  for (let i = particles.length - 1; i >= 0; i--)
    if (particles[i].life <= 0) particles.splice(i, 1);
  scoreEl.textContent = `Score: ${score}`;
}
function drawBackground() {
  const g = ctx.createRadialGradient(
    canvas.width * 0.5,
    0,
    20,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width,
  );
  g.addColorStop(0, "#18256a");
  g.addColorStop(0.45, "#0a0d23");
  g.addColorStop(1, "#03040b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 90; i++) {
    const x = (i * 137 + t * 0.2) % canvas.width,
      y = (i * 71 + t * (0.4 + (i % 4) * 0.15)) % canvas.height;
    ctx.fillStyle = i % 7 === 0 ? "#ff58d2" : "#bff9ff";
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 5 === 0 ? 8 : 2);
  }
  ctx.restore();
}
function draw() {
  drawBackground();
  for (const b of bullets) {
    ctx.save();
    ctx.shadowColor = "#65f7ff";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ccfbff";
    ctx.beginPath();
    ctx.roundRect(b.x - 4, b.y - 14, 8, 24, 6);
    ctx.fill();
    ctx.restore();
  }
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = "#ff4ecd";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ff4ecd";
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(28, -22);
    ctx.lineTo(0, -10);
    ctx.lineTo(-28, -22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd6f4";
    ctx.beginPath();
    ctx.arc(0, -4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life / 45;
    ctx.fillStyle = Math.random() > 0.5 ? "#ffdb4d" : "#62f5ff";
    ctx.beginPath();
    ctx.arc(
      p.x + (Math.random() - 0.5) * 32,
      p.y + (Math.random() - 0.5) * 32,
      2 + Math.random() * 4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
  drawShip(player.x, player.y);
  if (!running) {
    ctx.save();
    ctx.fillStyle = "rgba(5,8,20,.66)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#5ef6ff";
    ctx.shadowBlur = 16;
    ctx.font = "800 48px system-ui";
    ctx.fillText("NEON SPACE", canvas.width / 2, canvas.height / 2 - 22);
    ctx.font = "600 20px system-ui";
    ctx.fillText(
      "Press Start or Space",
      canvas.width / 2,
      canvas.height / 2 + 28,
    );
    ctx.restore();
  }
}
function loop() {
  if (running) update();
  draw();
  requestAnimationFrame(loop);
}
window.addEventListener("keydown", (e) => {
  keys.add(e.key);
  if (e.key === " ") {
    if (!running) reset();
    bullets.push({ x: player.x, y: player.y - 34 });
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key));
canvas.addEventListener("click", () =>
  bullets.push({ x: player.x, y: player.y - 34 }),
);
startBtn.addEventListener("click", reset);
loop();
