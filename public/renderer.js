// procedural 1920x1080 canvas tv renderer
// supports 3 themes and strict es5
window.TV_RENDERER = (function () {
var W = 1920;
var H = 1080;
var MIN_X = 64;
var SPAN_X = 190;
var MIN_Y = 4;
var SPAN_Y = 142;

var animState = {
revealCode: null,
revealStartMs: 0,
revealDuration: 950,
labelDuration: 2200,
hintCode: null,
hintTier: null,
hintStartMs: 0,
hintDuration: 4200,
snowflakes: []
};

// make snow particle list for christmas
// populates 95 crisp falling flakes
function initSnow() {
if (animState.snowflakes.length > 0) {
return;
}
for (var i = 0; i < 95; i++) {
animState.snowflakes.push({
x: Math.random() * W,
y: Math.random() * H,
r: 1.6 + Math.random() * 2.8,
vy: 0.45 + Math.random() * 1.15,
vx: -0.4 + Math.random() * 0.8,
alpha: 0.28 + Math.random() * 0.62
});
}
}

// return color tokens for active theme
// maps standard, dark, and christmas
function getThemePalette(theme) {
if (theme === 'standard') {
return {
seaTop: '#0e3c6b',
seaBot: '#1b5d9a',
grid: 'rgba(255,255,255,0.10)',
land: '#e2e8f0',
border: '#475569',
panelBg: 'rgba(255,255,255,0.95)',
panelBorder: '#2563eb',
panelText: '#0f172a',
mutedText: '#475569',
accent: '#d97706',
accentText: '#ffffff',
part2Bg: 'rgba(245,158,11,0.16)',
part2Border: '#d97706',
badgeBg: '#1e40af',
badgeText: '#ffffff'
};
}
if (theme === 'christmas') {
return {
seaTop: '#051a17',
seaBot: '#0c2f29',
grid: 'rgba(167,243,208,0.08)',
land: '#1c3b35',
border: '#86efac',
panelBg: 'rgba(12,35,30,0.94)',
panelBorder: '#f59e0b',
panelText: '#fef3c7',
mutedText: '#a7f3d0',
accent: '#dc2626',
accentText: '#ffffff',
part2Bg: 'rgba(245,158,11,0.18)',
part2Border: '#fbbf24',
badgeBg: '#b91c1c',
badgeText: '#fef3c7'
};
}
return {
seaTop: '#090d1a',
seaBot: '#111827',
grid: 'rgba(148,163,184,0.10)',
land: '#1e293b',
border: '#94a3b8',
panelBg: 'rgba(15,23,42,0.94)',
panelBorder: '#38bdf8',
panelText: '#f8fafc',
mutedText: '#94a3b8',
accent: '#f59e0b',
accentText: '#0f172a',
part2Bg: 'rgba(251,191,36,0.15)',
part2Border: '#fbbf24',
badgeBg: '#0284c7',
badgeText: '#ffffff'
};
}

// trigger reveal wipe or hint radar anim
// called from tv.js when event arrives
function triggerEvent(ev) {
if (!ev || !ev.type) {
return;
}
if (
ev.type === 'country_painted' ||
ev.type === 'skip_reveal'
) {
animState.revealCode =
ev.payload && ev.payload.code
? ev.payload.code
: null;
animState.revealStartMs = Date.now();
} else if (ev.type === 'distance_hint') {
animState.hintCode =
ev.payload && ev.payload.guessedCode
? ev.payload.guessedCode
: null;
animState.hintTier =
ev.payload && ev.payload.tier
? ev.payload.tier
: 'far';
animState.hintStartMs = Date.now();
}
}

// project tight map x coord to canvas
// maximizes europe width inside box
function projX(x, mapBox) {
return (
mapBox.x +
((x - MIN_X) / SPAN_X) * mapBox.w
);
}

// project tight map y coord to canvas
// maximizes europe height inside box
function projY(y, mapBox) {
return (
mapBox.y +
((y - MIN_Y) / SPAN_Y) * mapBox.h
);
}

// trace all polygons for one country
// creates closed canvas path
function traceCountry(ctx, c, mapBox) {
ctx.beginPath();
for (var p = 0; p < c.polys.length; p++) {
var poly = c.polys[p];
if (!poly || poly.length < 2) {
continue;
}
ctx.moveTo(
projX(poly[0][0], mapBox),
projY(poly[0][1], mapBox)
);
for (var k = 1; k < poly.length; k++) {
ctx.lineTo(
projX(poly[k][0], mapBox),
projY(poly[k][1], mapBox)
);
}
ctx.closePath();
}
}

// wrap long text across multiple lines
// measures width on 2d canvas context
function wrapText(ctx, text, maxW) {
var words = String(text || '').split(/\s+/);
var lines = [];
var cur = '';
for (var i = 0; i < words.length; i++) {
var w = words[i];
if (!w) continue;
var test = cur ? cur + ' ' + w : w;
if (
cur &&
ctx.measureText(test).width > maxW
) {
lines.push(cur);
cur = w;
} else {
cur = test;
}
}
if (cur) {
lines.push(cur);
}
return lines;
}

// draw rounded rectangle path helper
// avoids roundRect missing on kitkat
function drawRoundRect(
ctx,
x,
y,
w,
h,
r
) {
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.lineTo(x + w - r, y);
ctx.quadraticCurveTo(x + w, y, x + w, y + r);
ctx.lineTo(x + w, y + h - r);
ctx.quadraticCurveTo(
x + w,
y + h,
x + w - r,
y + h
);
ctx.lineTo(x + r, y + h);
ctx.quadraticCurveTo(x, y + h, x, y + h - r);
ctx.lineTo(x, y + r);
ctx.quadraticCurveTo(x, y, x + r, y);
ctx.closePath();
}

// find country geometry record by code
// scans loaded EUROPE_MAP array
function findMapCountry(code) {
if (!window.EUROPE_MAP) return null;
var list = window.EUROPE_MAP.countries;
for (var i = 0; i < list.length; i++) {
if (list[i].code === code) {
return list[i];
}
}
return null;
}

// draw sea background and subtle snow
// omits top garland to keep map clean
function drawBackdrop(ctx, pal, theme, now) {
var grad = ctx.createLinearGradient(
0,
0,
0,
H
);
grad.addColorStop(0, pal.seaTop);
grad.addColorStop(1, pal.seaBot);
ctx.fillStyle = grad;
ctx.fillRect(0, 0, W, H);

ctx.strokeStyle = pal.grid;
ctx.lineWidth = 1.5;
for (var gx = 160; gx < W; gx += 220) {
ctx.beginPath();
ctx.moveTo(gx, 0);
ctx.lineTo(gx, H);
ctx.stroke();
}
for (var gy = 140; gy < H; gy += 180) {
ctx.beginPath();
ctx.moveTo(0, gy);
ctx.lineTo(W, gy);
ctx.stroke();
}

if (theme === 'christmas') {
drawSideChristmasDecor(ctx, now);
}
}

// draw vertical bulb garland at edge
// keeps side borders festive and thin
function drawEdgeGarland(
ctx,
edgeX,
yStart,
yEnd,
phase
) {
var bulbColors = [
'#ef4444',
'#fbbf24',
'#22c55e',
'#38bdf8'
];
ctx.strokeStyle = 'rgba(22,163,74,0.7)';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.moveTo(edgeX, yStart);
for (var wy = yStart; wy <= yEnd; wy += 42) {
ctx.lineTo(
edgeX + Math.sin(wy * 0.03) * 4,
wy
);
}
ctx.stroke();

for (var by = yStart + 10; by <= yEnd; by += 68) {
var idx = Math.floor(by / 68);
var col =
bulbColors[
(idx + phase) % bulbColors.length
];
var bx = edgeX + Math.sin(by * 0.03) * 4;
ctx.fillStyle = col;
ctx.beginPath();
ctx.arc(bx, by, 4.8, 0, Math.PI * 2);
ctx.fill();
}
}

// draw rich snow and both side garlands
// keeps top clear while framing sides
function drawSideChristmasDecor(ctx, now) {
initSnow();
var flakes = animState.snowflakes;
ctx.save();
for (var i = 0; i < flakes.length; i++) {
var f = flakes[i];
f.y += f.vy;
f.x += f.vx;
if (f.y > H + 10) {
f.y = -10;
f.x = Math.random() * W;
}
if (f.x < -10) f.x = W + 10;
if (f.x > W + 10) f.x = -10;
ctx.fillStyle =
'rgba(255,255,255,' + f.alpha + ')';
ctx.beginPath();
ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
ctx.fill();
}

var phase = Math.floor(now / 650);
drawEdgeGarland(ctx, 15, 72, H - 44, phase);
drawEdgeGarland(
ctx,
W - 16,
44,
H - 44,
phase + 1
);
ctx.restore();
}

// draw compact garland above scoreboard
// accents scoreboard edge on christmas
function drawScoreboardGarland(
ctx,
x,
y,
w,
now
) {
var bulbColors = [
'#ef4444',
'#fbbf24',
'#22c55e',
'#38bdf8'
];
var phase = Math.floor(now / 650);
ctx.save();
ctx.strokeStyle = '#15803d';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(x + 14, y - 3);
for (var gx = x + 28; gx <= x + w - 14; gx += 26) {
var sag = Math.sin(((gx - x) / w) * Math.PI) * 5;
ctx.lineTo(gx, y - 5 + sag);
}
ctx.stroke();

for (var bx = x + 22; bx <= x + w - 20; bx += 38) {
var idx = Math.floor(bx / 38);
var col =
bulbColors[
(idx + phase) % bulbColors.length
];
var bSag = Math.sin(((bx - x) / w) * Math.PI) * 5;
ctx.fillStyle = col;
ctx.beginPath();
ctx.arc(bx, y - 5 + bSag, 4.2, 0, Math.PI * 2);
ctx.fill();
}
ctx.restore();
}

// compute map box for active phase
// makes map full height in live play
function getMapBox(room) {
var phase =
room && room.round ? room.round.phase : 'ready';
if (phase === 'finished') {
return {
x: 632,
y: 54,
w: 1236,
h: 924
};
}
return {
x: 526,
y: 26,
w: 1352,
h: 1010
};
}

// draw floating upward country name
// scales up and fades out after fill
function drawFloatingRevealLabel(
ctx,
mapBox,
lang,
now
) {
if (!animState.revealCode) {
return;
}
var elapsed = now - animState.revealStartMs;
if (
elapsed < animState.revealDuration ||
elapsed >
animState.revealDuration +
animState.labelDuration
) {
return;
}
var lc = findMapCountry(animState.revealCode);
if (!lc) {
return;
}
var lt =
(elapsed - animState.revealDuration) /
animState.labelDuration;
var ease = 1 - Math.pow(1 - lt, 3);
var lx = projX(lc.cx, mapBox);
var ly = projY(lc.cy, mapBox) - 125 * ease;
var scale = 1.0 + 1.15 * ease;
var alpha =
lt < 0.14
? lt / 0.14
: Math.max(0, 1 - (lt - 0.14) / 0.86);
var label = lang === 'en' ? lc.en : lc.uk;

ctx.save();
ctx.globalAlpha = alpha;
ctx.translate(lx, ly);
ctx.scale(scale, scale);
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.font = 'bold 28px sans-serif';
ctx.lineWidth = 6;
ctx.strokeStyle = 'rgba(2,6,23,0.9)';
ctx.strokeText(label, 0, 0);
ctx.fillStyle = '#ffffff';
ctx.fillText(label, 0, 0);
ctx.restore();
}

// render european contour map and fills
// skips permanent names per user rule
function drawMap(ctx, room, pal, now) {
if (!window.EUROPE_MAP) {
return;
}
var mapBox = getMapBox(room);
var phase =
room && room.round ? room.round.phase : 'ready';
var list = window.EUROPE_MAP.countries;
var painted =
(room.round && room.round.painted) || {};
var cq =
room.round && room.round.currentQuestion;
var lang = room.lang === 'en' ? 'en' : 'uk';

if (phase === 'finished') {
ctx.save();
drawRoundRect(
ctx,
mapBox.x - 16,
mapBox.y - 16,
mapBox.w + 32,
mapBox.h + 32,
22
);
ctx.fillStyle = 'rgba(2,6,23,0.34)';
ctx.fill();
ctx.strokeStyle = pal.panelBorder;
ctx.lineWidth = 2.5;
ctx.stroke();
ctx.restore();
}

for (var i = 0; i < list.length; i++) {
var c = list[i];
if (painted[c.code]) {
continue;
}
traceCountry(ctx, c, mapBox);
ctx.fillStyle = pal.land;
ctx.fill();
ctx.strokeStyle = pal.border;
ctx.lineWidth = 1.6;
ctx.stroke();
}

for (var j = 0; j < list.length; j++) {
var pc = list[j];
var pInfo = painted[pc.code];
if (!pInfo) {
continue;
}
var isRevealing =
animState.revealCode === pc.code &&
now - animState.revealStartMs <
animState.revealDuration;

if (isRevealing) {
traceCountry(ctx, pc, mapBox);
ctx.fillStyle = pal.land;
ctx.fill();
ctx.strokeStyle = pal.border;
ctx.lineWidth = 1.6;
ctx.stroke();

var t =
(now - animState.revealStartMs) /
animState.revealDuration;
var cx = projX(pc.cx, mapBox);
var cy = projY(pc.cy, mapBox);
var rad = 360 * t;
ctx.save();
traceCountry(ctx, pc, mapBox);
ctx.clip();
ctx.fillStyle = pInfo.color;
ctx.beginPath();
ctx.arc(cx, cy, rad, 0, Math.PI * 2);
ctx.fill();
ctx.restore();
} else {
traceCountry(ctx, pc, mapBox);
ctx.fillStyle = pInfo.color;
ctx.fill();
}
traceCountry(ctx, pc, mapBox);
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 2.2;
ctx.stroke();
}

if (
cq &&
cq.guessedCodes &&
phase === 'asking'
) {
for (
var g = 0;
g < cq.guessedCodes.length;
g++
) {
var gCode = cq.guessedCodes[g];
var gc = findMapCountry(gCode);
if (!gc) continue;
var gx = projX(gc.cx, mapBox);
var gy = projY(gc.cy, mapBox);
ctx.save();
ctx.fillStyle = 'rgba(239,68,68,0.42)';
traceCountry(ctx, gc, mapBox);
ctx.fill();
ctx.strokeStyle = '#fca5a5';
ctx.lineWidth = 2;
ctx.stroke();
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 16px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('✕ ' + gc.code, gx, gy);
ctx.restore();
}
}

if (
animState.hintCode &&
now - animState.hintStartMs <
animState.hintDuration
) {
var hc = findMapCountry(animState.hintCode);
if (hc) {
var hx = projX(hc.cx, mapBox);
var hy = projY(hc.cy, mapBox);
var ht =
((now - animState.hintStartMs) % 1000) /
1000;
var ringCol =
animState.hintTier === 'neighbor'
? '#22c55e'
: animState.hintTier === 'close'
? '#fbbf24'
: '#38bdf8';
ctx.save();
ctx.strokeStyle = ringCol;
ctx.lineWidth = 4.5;
ctx.globalAlpha = 1 - ht;
ctx.beginPath();
ctx.arc(
hx,
hy,
16 + ht * 64,
0,
Math.PI * 2
);
ctx.stroke();
ctx.restore();
}
}

drawFloatingRevealLabel(ctx, mapBox, lang, now);
}

// compute scoreboard height below card
// uses two columns when more than 2
function getScoreboardMetrics(room) {
var pos = room.scoreboardPos || 'bottom';
if (pos === 'hidden') {
return { visible: false, h: 0 };
}
var teams = room.teams || [];
if (room.gameMode === 'coop') {
return { visible: true, h: 128 };
}
var cols = teams.length > 2 ? 2 : 1;
var rows = Math.max(
1,
Math.ceil(teams.length / cols)
);
var boxH = 54 + rows * 38 + 12;
return { visible: true, h: boxH };
}

// draw scoreboard at bottom of question
// keeps entire europe map unobstructed
function drawScoreboard(
ctx,
room,
pal,
t,
theme,
now
) {
var phase =
room && room.round ? room.round.phase : 'ready';
if (phase === 'finished') {
return;
}
var pos = room.scoreboardPos || 'bottom';
if (pos === 'hidden') {
return;
}
var met = getScoreboardMetrics(room);
var boxW = 470;
var boxH = met.h;
var x = 36;
var y = 1044 - boxH;

var paintedCount = Object.keys(
(room.round && room.round.painted) || {}
).length;
var totalCountries = 37;

ctx.save();
drawRoundRect(ctx, x, y, boxW, boxH, 16);
ctx.fillStyle = pal.panelBg;
ctx.fill();
ctx.strokeStyle = pal.panelBorder;
ctx.lineWidth = 2.5;
ctx.stroke();

if (room.gameMode === 'coop') {
ctx.fillStyle = pal.mutedText;
ctx.font = 'bold 16px sans-serif';
ctx.fillText(t.tvCoopTeam, x + 22, y + 34);

ctx.fillStyle = pal.panelText;
ctx.font = 'bold 48px sans-serif';
ctx.fillText(
String(room.coopScore || 0),
x + 22,
y + 92
);

ctx.textAlign = 'right';
ctx.fillStyle = pal.mutedText;
ctx.font = 'bold 18px sans-serif';
ctx.fillText(
t.tvPainted + ':',
x + boxW - 22,
y + 42
);
ctx.fillStyle = pal.accent;
ctx.font = 'bold 34px sans-serif';
ctx.fillText(
paintedCount + ' / ' + totalCountries,
x + boxW - 22,
y + 88
);
ctx.textAlign = 'left';
ctx.restore();
if (theme === 'christmas') {
drawScoreboardGarland(ctx, x, y, boxW, now);
}
return;
}

var teams = room.teams || [];
var sorted = teams.slice().sort(
function (a, b) {
return b.score - a.score;
}
);
var cols = sorted.length > 2 ? 2 : 1;
var cellW =
cols === 2 ? (boxW - 36) / 2 : boxW - 28;
var rowH = 38;
var headerH = 54;

ctx.fillStyle = pal.panelText;
ctx.font = 'bold 19px sans-serif';
var rTitle = room.name || '';
if (rTitle.length > 22) {
rTitle = rTitle.slice(0, 21) + '…';
}
ctx.fillText(rTitle, x + 20, y + 33);

ctx.textAlign = 'right';
ctx.fillStyle = pal.mutedText;
ctx.font = 'bold 16px sans-serif';
ctx.fillText(
t.tvPainted +
': ' +
paintedCount +
'/' +
totalCountries,
x + boxW - 20,
y + 33
);
ctx.textAlign = 'left';

var activeId =
room.round && room.round.activeTeamId;
for (var i = 0; i < sorted.length; i++) {
var tm = sorted[i];
var colIdx = cols === 2 ? i % 2 : 0;
var rowIdx =
cols === 2 ? Math.floor(i / 2) : i;
var cx = x + 14 + colIdx * (cellW + 8);
var ry = y + headerH + rowIdx * rowH;

if (tm.id === activeId) {
drawRoundRect(
ctx,
cx,
ry,
cellW,
34,
8
);
ctx.fillStyle = 'rgba(59,130,246,0.22)';
ctx.fill();
}
ctx.fillStyle = tm.color;
ctx.beginPath();
ctx.arc(cx + 16, ry + 17, 7.5, 0, Math.PI * 2);
ctx.fill();

ctx.fillStyle = pal.panelText;
ctx.font = 'bold 18px sans-serif';
var nm = tm.name;
var maxLen = cols === 2 ? 10 : 22;
if (nm.length > maxLen) {
nm = nm.slice(0, maxLen - 1) + '…';
}
ctx.fillText(nm, cx + 30, ry + 23);

ctx.textAlign = 'right';
ctx.fillStyle = pal.accent;
ctx.font = 'bold 20px sans-serif';
ctx.fillText(
String(tm.score),
cx + cellW - 10,
ry + 23
);
ctx.textAlign = 'left';
}
ctx.restore();

if (theme === 'christmas') {
drawScoreboardGarland(ctx, x, y, boxW, now);
}
}

// draw left column riddle above score
// sizes cleanly to sit over scoreboard
function drawLeftPanel(
ctx,
room,
pal,
t,
now
) {
var round = room.round || {};
var phase = round.phase || 'ready';
if (phase === 'finished') {
return;
}
var cq = round.currentQuestion;
var lang = room.lang === 'en' ? 'en' : 'uk';
var met = getScoreboardMetrics(room);

var cardX = 36;
var cardW = 470;
var topY = 64;
var botY = met.visible
? 1044 - met.h - 20
: 1044;
var cardH = Math.max(300, botY - topY);

if (phase === 'exhausted') {
ctx.save();
var exY = Math.max(topY, botY - 400);
var exH = botY - exY;
drawRoundRect(ctx, cardX, exY, cardW, exH, 22);
ctx.fillStyle = pal.panelBg;
ctx.fill();
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 3.5;
ctx.stroke();

ctx.fillStyle = '#fbbf24';
ctx.font = 'bold 34px sans-serif';
var exT = wrapText(
ctx,
t.tvExhaustedTitle,
cardW - 56
);
var ey = exY + 84;
for (var et = 0; et < exT.length; et++) {
ctx.fillText(exT[et], cardX + 28, ey);
ey += 44;
}

ctx.fillStyle = pal.panelText;
ctx.font = 'bold 26px sans-serif';
var exS = wrapText(
ctx,
t.tvExhaustedSub,
cardW - 56
);
ey += 18;
for (var es = 0; es < exS.length; es++) {
ctx.fillText(exS[es], cardX + 28, ey);
ey += 36;
}

var pcCount = Object.keys(
round.painted || {}
).length;
ctx.fillStyle = pal.mutedText;
ctx.font = 'bold 24px sans-serif';
ctx.fillText(
t.tvPainted + ': ' + pcCount + ' / 37',
cardX + 28,
exY + exH - 42
);
ctx.restore();
return;
}

if (phase === 'ready' || !cq) {
ctx.save();
var rY = Math.max(topY, botY - 380);
var rH = botY - rY;
drawRoundRect(ctx, cardX, rY, cardW, rH, 22);
ctx.fillStyle = pal.panelBg;
ctx.fill();
ctx.strokeStyle = pal.panelBorder;
ctx.lineWidth = 3;
ctx.stroke();

ctx.fillStyle = pal.accent;
ctx.font = 'bold 24px sans-serif';
ctx.fillText(
room.name || t.gameTitle,
cardX + 28,
rY + 56
);

ctx.fillStyle = pal.panelText;
ctx.font = 'bold 34px sans-serif';
var readyMsg =
lang === 'en'
? 'Ready! Host is picking the next European riddle...'
: 'Готові! Ведучий обирає наступну загадку про Європу...';
var rLines = wrapText(ctx, readyMsg, cardW - 56);
for (var rl = 0; rl < rLines.length; rl++) {
ctx.fillText(
rLines[rl],
cardX + 28,
rY + 128 + rl * 46
);
}
ctx.restore();
return;
}

ctx.save();
drawRoundRect(
ctx,
cardX,
topY,
cardW,
cardH,
22
);
ctx.fillStyle = pal.panelBg;
ctx.fill();
ctx.strokeStyle =
phase === 'revealed'
? '#10b981'
: pal.panelBorder;
ctx.lineWidth = 3.5;
ctx.stroke();

ctx.fillStyle = pal.badgeBg;
drawRoundRect(
ctx,
cardX + 24,
topY + 22,
172,
44,
10
);
ctx.fill();
ctx.fillStyle = pal.badgeText;
ctx.font = 'bold 22px sans-serif';
ctx.fillText(
'#' + cq.number,
cardX + 42,
topY + 51
);

var ptsText = String(cq.currentValue) + ' PTS';
if (cq.isHalfValue) {
ptsText += ' (½)';
}
ctx.fillStyle = cq.isHalfValue
? '#d97706'
: '#059669';
drawRoundRect(
ctx,
cardX + 210,
topY + 22,
cq.isHalfValue ? 236 : 168,
44,
10
);
ctx.fill();
ctx.fillStyle = '#ffffff';
ctx.fillText(ptsText, cardX + 228, topY + 51);

var contentY = topY + 102;
if (room.gameMode === 'teams') {
var tm = null;
for (var k = 0; k < room.teams.length; k++) {
if (room.teams[k].id === round.activeTeamId) {
tm = room.teams[k];
break;
}
}
if (tm) {
ctx.fillStyle = tm.color;
ctx.beginPath();
ctx.arc(
cardX + 36,
contentY - 6,
9,
0,
Math.PI * 2
);
ctx.fill();
ctx.font = 'bold 24px sans-serif';
ctx.fillText(
tm.name,
cardX + 54,
contentY + 2
);
contentY += 46;
}
}

if (phase === 'revealed') {
var cObj = findMapCountry(cq.country);
var cName = cObj
? lang === 'en'
? cObj.en
: cObj.uk
: cq.country;
var cap = cObj
? lang === 'en'
? cObj.capEn
: cObj.capUk
: '';
ctx.fillStyle = '#10b981';
ctx.font = 'bold 34px sans-serif';
var cLines = wrapText(
ctx,
cName + (cap ? ' — ' + cap : ''),
cardW - 52
);
for (var cl = 0; cl < cLines.length; cl++) {
ctx.fillText(cLines[cl], cardX + 26, contentY);
contentY += 44;
}
contentY += 12;

ctx.fillStyle = pal.panelText;
ctx.font = '28px sans-serif';
var ansLines = wrapText(
ctx,
cq.answerText,
cardW - 52
);
for (var a = 0; a < ansLines.length; a++) {
if (contentY > botY - 24) break;
ctx.fillText(
ansLines[a],
cardX + 26,
contentY
);
contentY += 38;
}
ctx.restore();
return;
}

if (!room.showQuestionOnTv) {
ctx.textAlign = 'center';
ctx.fillStyle = pal.panelText;
ctx.font = 'bold 36px sans-serif';
var listenLines = wrapText(
ctx,
t.tvListenHost,
cardW - 56
);
var ly = topY + Math.floor(cardH * 0.48);
for (var li = 0; li < listenLines.length; li++) {
ctx.fillText(
listenLines[li],
cardX + cardW / 2,
ly + li * 48
);
}
ctx.textAlign = 'left';
} else {
ctx.fillStyle = pal.panelText;
ctx.font = 'bold 33px sans-serif';
var p1Lines = wrapText(
ctx,
cq.part1,
cardW - 52
);
var maxP1Y = cq.part2Revealed
? botY - 210
: botY - 28;
for (var l1 = 0; l1 < p1Lines.length; l1++) {
if (contentY > maxP1Y) break;
ctx.fillText(
p1Lines[l1],
cardX + 26,
contentY
);
contentY += 43;
}

if (cq.part2Revealed && cq.part2) {
contentY += 12;
ctx.font = 'bold 26px sans-serif';
var p2Lines = wrapText(
ctx,
'+ ' + cq.part2,
cardW - 76
);
var p2BoxH = Math.min(
botY - contentY - 18,
28 + p2Lines.length * 34
);
drawRoundRect(
ctx,
cardX + 22,
contentY - 12,
cardW - 44,
Math.max(76, p2BoxH),
12
);
ctx.fillStyle = pal.part2Bg;
ctx.fill();
ctx.strokeStyle = pal.part2Border;
ctx.lineWidth = 2.5;
ctx.stroke();

ctx.fillStyle = pal.panelText;
var p2y = contentY + 22;
for (var l2 = 0; l2 < p2Lines.length; l2++) {
if (p2y > botY - 24) break;
ctx.fillText(
p2Lines[l2],
cardX + 38,
p2y
);
p2y += 34;
}
}
}

if (
cq.lastHint &&
now - animState.hintStartMs <
animState.hintDuration
) {
drawHintToast(
ctx,
cq.lastHint,
t,
lang
);
}
ctx.restore();
}

// draw distance hint banner over top sea
// shows guessed country and proximity
function drawHintToast(ctx, hint, t, lang) {
var textTier =
hint.tier === 'neighbor'
? t.hintNeighbor
: hint.tier === 'close'
? t.hintClose
: t.hintFar;
var bg =
hint.tier === 'neighbor'
? '#15803d'
: hint.tier === 'close'
? '#d97706'
: '#1d4ed8';
var label = textTier;
if (hint.guessedCode) {
var gc = findMapCountry(hint.guessedCode);
var gName = gc
? lang === 'en'
? gc.en
: gc.uk
: hint.guessedCode;
label = gName + ' → ' + textTier;
}
ctx.save();
drawRoundRect(ctx, 640, 26, 1080, 66, 16);
ctx.fillStyle = bg;
ctx.fill();
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 3;
ctx.stroke();

ctx.textAlign = 'center';
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 28px sans-serif';
ctx.fillText(label, 1180, 69);
ctx.restore();
}

// draw side podium keeping painted map
// shows final scores left of full map
function drawFinishPanel(ctx, room, pal, t) {
var px = 36;
var py = 54;
var pw = 562;
var ph = 936;
var paintedCount = Object.keys(
(room.round && room.round.painted) || {}
).length;

ctx.save();
drawRoundRect(ctx, px, py, pw, ph, 24);
ctx.fillStyle = pal.panelBg;
ctx.fill();
ctx.strokeStyle = pal.panelBorder;
ctx.lineWidth = 4;
ctx.stroke();

ctx.textAlign = 'center';
ctx.fillStyle = pal.accent;
ctx.font = 'bold 40px sans-serif';
ctx.fillText(t.tvFinishTitle, px + pw / 2, py + 72);

ctx.fillStyle = pal.mutedText;
ctx.font = 'bold 22px sans-serif';
ctx.fillText(
t.tvPainted + ': ' + paintedCount + ' / 37',
px + pw / 2,
py + 114
);

if (room.gameMode === 'teams') {
var sorted = (room.teams || []).slice().sort(
function (a, b) {
return b.score - a.score;
}
);
for (
var i = 0;
i < Math.min(8, sorted.length);
i++
) {
var tm = sorted[i];
var ry = py + 150 + i * 94;
drawRoundRect(
ctx,
px + 28,
ry,
pw - 56,
78,
14
);
ctx.fillStyle =
i === 0
? 'rgba(245,158,11,0.22)'
: 'rgba(148,163,184,0.12)';
ctx.fill();
ctx.strokeStyle = tm.color;
ctx.lineWidth = 3;
ctx.stroke();

ctx.textAlign = 'left';
ctx.fillStyle = pal.panelText;
ctx.font = 'bold 28px sans-serif';
var tNm = tm.name;
if (tNm.length > 14) {
tNm = tNm.slice(0, 13) + '…';
}
ctx.fillText(
'#' + (i + 1) + ' ' + tNm,
px + 48,
ry + 49
);

ctx.textAlign = 'right';
ctx.fillStyle = pal.accent;
ctx.font = 'bold 28px sans-serif';
ctx.fillText(
tm.score + ' pts (' + tm.countries + ')',
px + pw - 48,
ry + 49
);
}
} else {
ctx.fillStyle = pal.panelText;
ctx.font = 'bold 68px sans-serif';
ctx.fillText(
room.coopScore + ' PTS',
px + pw / 2,
py + 216
);
ctx.fillStyle = pal.mutedText;
ctx.font = 'bold 26px sans-serif';
ctx.fillText(
t.tvLeaderboard,
px + pw / 2,
py + 292
);
var lb = room.leaderboard || [];
for (
var k = 0;
k < Math.min(7, lb.length);
k++
) {
var entry = lb[k];
var ly = py + 324 + k * 82;
drawRoundRect(
ctx,
px + 28,
ly,
pw - 56,
66,
12
);
ctx.fillStyle = 'rgba(148,163,184,0.14)';
ctx.fill();
ctx.textAlign = 'left';
ctx.fillStyle = pal.panelText;
ctx.font = 'bold 24px sans-serif';
ctx.fillText(
'#' + (k + 1) + ' ' + entry.label,
px + 48,
ly + 42
);
ctx.textAlign = 'right';
ctx.fillStyle = pal.accent;
ctx.fillText(
entry.score + ' pts',
px + pw - 48,
ly + 42
);
}
}
ctx.restore();
}

// render complete frame onto tv canvas
// switches layout by current room phase
function render(ctx, state) {
if (!ctx || !state || !state.room) {
return;
}
var room = state.room;
var theme = room.theme || 'standard';
var pal = getThemePalette(theme);
var lang = room.lang === 'en' ? 'en' : 'uk';
var t = window.APP_I18N[lang];
var now = Date.now();

drawBackdrop(ctx, pal, theme, now);
drawMap(ctx, room, pal, now);
drawScoreboard(ctx, room, pal, t, theme, now);
drawLeftPanel(ctx, room, pal, t, now);

if (
room.round &&
room.round.phase === 'finished'
) {
drawFinishPanel(ctx, room, pal, t);
}
}

return {
render: render,
triggerEvent: triggerEvent
};
})();
