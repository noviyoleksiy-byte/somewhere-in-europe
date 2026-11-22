// scripted 75s demo for europe quiz
// drives tv renderer and records hd
(function () {
var W = 1920;
var H = 1080;
var DURATION = 75.0;

var canvas =
document.getElementById(
'game-canvas'
);
var ctx = canvas.getContext('2d');
var pauseBtn =
document.getElementById(
'demo-pause-btn'
);
var restartBtn =
document.getElementById(
'demo-restart-btn'
);
var soundBtn =
document.getElementById(
'demo-sound-btn'
);
var recordBtn =
document.getElementById(
'demo-record-btn'
);
var fsBtn =
document.getElementById(
'demo-fs-btn'
);
var stepBtns =
document.querySelectorAll(
'.demo-step-btn'
);

var BASE_TEAMS = [
{
id: 't1',
name: 'Red Lions',
color: '#dc2626'
},
{
id: 't2',
name: 'Blue Owls',
color: '#2563eb'
},
{
id: 't3',
name: 'Emerald Fox',
color: '#059669'
},
{
id: 't4',
name: 'Violet Bears',
color: '#7c3aed'
}
];

// real riddles from general_en.txt
// keeps english ui authentic on tv
var Q1_FR = {
number: 1,
country: 'FR',
part1:
'This country is the most ' +
'visited tourist destination ' +
'in the world, famous for its ' +
'Art Nouveau metro entrances ' +
'in the capital.',
part2:
'Here the Lumiere brothers ' +
'held the first public cinema ' +
'screening in 1895.',
answerText:
'France — Paris. The first ' +
'commercial film projection ' +
'took place in Paris on ' +
'December 28, 1895.'
};

var Q2_IT = {
number: 2,
country: 'IT',
part1:
'This country holds more ' +
'UNESCO World Heritage Sites ' +
'than any other nation and ' +
'gave the world musical ' +
'notation and the piano.',
part2:
'An independent microstate, ' +
'Vatican City, sits entirely ' +
'inside its capital city.',
answerText:
'Italy — Rome. Bartolomeo ' +
'Cristofori invented the piano ' +
'in Florence around 1700.'
};

var Q3_CH = {
number: 3,
country: 'CH',
part1:
'This landlocked nation has ' +
'four official languages and ' +
'one of the world\'s only ' +
'square national flags.',
part2:
'It hosts the Large Hadron ' +
'Collider at CERN and the ' +
'headquarters of the ' +
'International Red Cross.',
answerText:
'Switzerland — Bern. Its four ' +
'national languages are German, ' +
'French, Italian, and Romansh.'
};

var Q5_UA = {
number: 5,
country: 'UA',
part1:
'The largest country located ' +
'entirely inside Europe, it ' +
'hosts one of the continent\'s ' +
'geographical center markers ' +
'in the Carpathians.',
part2:
'Composer Mykola Leontovych ' +
'created "Shchedryk" here, ' +
'known worldwide as "Carol of ' +
'the Bells".',
answerText:
'Ukraine — Kyiv. Pylyp ' +
'Orlyk\'s 1710 constitution ' +
'drafted here is one of ' +
'Europe\'s earliest.'
};

// ordered opened countries on map
// computes exact scores at any sec
var OPENED = [
{ at: 16.5, code: 'FR', tid: 't1', pts: 10 },
{ at: 32.0, code: 'CH', tid: 't2', pts: 5 },
{ at: 45.8, code: 'UA', tid: 't3', pts: 10 },
{ at: 51.5, code: 'DE', tid: 't4', pts: 10 },
{ at: 51.5, code: 'NL', tid: 't2', pts: 10 },
{ at: 51.5, code: 'GB', tid: 't3', pts: 10 },
{ at: 51.5, code: 'ES', tid: 't1', pts: 10 },
{ at: 51.5, code: 'NO', tid: 't4', pts: 10 },
{ at: 51.5, code: 'GR', tid: 't2', pts: 10 },
{ at: 51.5, code: 'SE', tid: 't3', pts: 10 },
{ at: 51.5, code: 'PL', tid: 't1', pts: 10 },
{ at: 51.5, code: 'PT', tid: 't4', pts: 5 },
{ at: 51.5, code: 'AT', tid: 't3', pts: 5 },
{ at: 51.5, code: 'IE', tid: 't2', pts: 5 },
{ at: 61.6, code: 'IT', tid: 't1', pts: 10 }
];

// one-shot timeline triggers list
// fires map waves and audio cues
var CUES = [
{ id: 'start', at: 0.2, kind: 'start' },
{ id: 'q1', at: 8.5, kind: 'ask' },
{ id: 'fr', at: 16.5, kind: 'paint', code: 'FR' },
{ id: 'q3', at: 22.5, kind: 'ask' },
{ id: 'clue', at: 27.5, kind: 'clue' },
{ id: 'ch', at: 32.0, kind: 'paint', code: 'CH' },
{ id: 'q5', at: 36.5, kind: 'ask' },
{
id: 'hint_pl',
at: 41.0,
kind: 'hint',
code: 'PL',
tier: 'neighbor'
},
{ id: 'ua', at: 45.8, kind: 'paint', code: 'UA' },
{ id: 'th_std', at: 51.5, kind: 'theme' },
{ id: 'th_dark', at: 54.8, kind: 'theme' },
{ id: 'th_xmas', at: 58.1, kind: 'theme' },
{ id: 'th_pub', at: 61.4, kind: 'theme' },
{ id: 'it', at: 61.6, kind: 'paint', code: 'IT' },
{ id: 'fin', at: 64.5, kind: 'finish' }
];

var elapsed = 0;
var paused = false;
var soundOn = true;
var lastFrameMs = 0;
var firedCues = {};

var audioCtx = null;
var audioDest = null;
var speakerGain = null;

var recorder = null;
var recChunks = [];
var isRecording = false;
var recExt = 'webm';

// create audio nodes once on demand
// routes sound to speakers and rec
function setupAudio() {
if (audioCtx) {
if (audioCtx.state === 'suspended') {
audioCtx.resume();
}
return;
}
var AC =
window.AudioContext ||
window.webkitAudioContext;
if (!AC) {
return;
}
audioCtx = new AC();
audioDest =
audioCtx.createMediaStreamDestination();
speakerGain = audioCtx.createGain();
speakerGain.gain.value =
soundOn ? 0.55 : 0;
speakerGain.connect(
audioCtx.destination
);
}

// play one clean synth tone note
// sends tone to speakers and stream
function playTone(
freq,
dur,
type,
vol,
delay
) {
setupAudio();
if (!audioCtx) {
return;
}
var t0 =
audioCtx.currentTime + (delay || 0);
var osc = audioCtx.createOscillator();
var env = audioCtx.createGain();
osc.type = type || 'triangle';
osc.frequency.setValueAtTime(
freq,
t0
);
env.gain.setValueAtTime(0.001, t0);
env.gain.exponentialRampToValueAtTime(
vol || 0.22,
t0 + 0.02
);
env.gain.exponentialRampToValueAtTime(
0.0008,
t0 + dur
);
osc.connect(env);
env.connect(speakerGain);
if (audioDest) {
env.connect(audioDest);
}
osc.start(t0);
osc.stop(t0 + dur + 0.03);
}

// play short cue by event category
// gives crisp feedback per game step
function playCueSound(kind) {
if (kind === 'start') {
playTone(440, 0.16, 'triangle', 0.18, 0);
playTone(554, 0.22, 'triangle', 0.18, 0.12);
} else if (kind === 'ask') {
playTone(523, 0.14, 'sine', 0.18, 0);
playTone(659, 0.18, 'sine', 0.18, 0.09);
} else if (kind === 'clue') {
playTone(587, 0.14, 'triangle', 0.18, 0);
playTone(740, 0.18, 'triangle', 0.16, 0.1);
} else if (kind === 'hint') {
playTone(230, 0.15, 'sawtooth', 0.12, 0);
playTone(660, 0.22, 'sine', 0.18, 0.16);
playTone(880, 0.25, 'sine', 0.16, 0.28);
} else if (kind === 'paint') {
playTone(523, 0.14, 'triangle', 0.2, 0);
playTone(659, 0.14, 'triangle', 0.2, 0.08);
playTone(784, 0.24, 'triangle', 0.22, 0.16);
} else if (kind === 'theme') {
playTone(392, 0.12, 'sine', 0.15, 0);
playTone(587, 0.16, 'sine', 0.16, 0.08);
} else if (kind === 'finish') {
playTone(523, 0.2, 'triangle', 0.22, 0);
playTone(659, 0.2, 'triangle', 0.22, 0.14);
playTone(784, 0.2, 'triangle', 0.22, 0.28);
playTone(1046, 0.5, 'triangle', 0.25, 0.42);
}
}

// find team color string by team id
// returns crimson fallback if missing
function getTeamColor(tid) {
for (var i = 0; i < BASE_TEAMS.length; i++) {
if (BASE_TEAMS[i].id === tid) {
return BASE_TEAMS[i].color;
}
}
return '#dc2626';
}

// pick active visual theme at time t
// shows all 4 built-in themes cleanly
function getThemeAt(t) {
if (t >= 51.5 && t < 54.8) {
return 'standard';
}
if (t >= 54.8 && t < 58.1) {
return 'dark';
}
if (t >= 58.1 && t < 61.4) {
return 'christmas';
}
return 'pub';
}

// build full tv renderer state at t
// computes scores and opened map
function buildState(t) {
var teams = [];
var teamMap = {};
for (var i = 0; i < BASE_TEAMS.length; i++) {
var bt = BASE_TEAMS[i];
var obj = {
id: bt.id,
name: bt.name,
color: bt.color,
score: 0,
countries: 0
};
teams.push(obj);
teamMap[bt.id] = obj;
}

var painted = {};
for (var c = 0; c < OPENED.length; c++) {
var item = OPENED[c];
if (t >= item.at) {
painted[item.code] = {
color: getTeamColor(item.tid),
teamId: item.tid
};
teamMap[item.tid].score += item.pts;
teamMap[item.tid].countries += 1;
}
}

var phase = 'ready';
var activeTeamId = 't1';
var cq = null;

if (t >= 8.5 && t < 22.5) {
activeTeamId = 't1';
phase = t < 16.5 ? 'asking' : 'revealed';
cq = {
number: Q1_FR.number,
country: Q1_FR.country,
part1: Q1_FR.part1,
part2: Q1_FR.part2,
part2Revealed: false,
currentValue: 10,
isHalfValue: false,
answerText: Q1_FR.answerText,
guessedCodes: [],
lastHint: null
};
} else if (t >= 22.5 && t < 36.5) {
activeTeamId = 't2';
phase = t < 32.0 ? 'asking' : 'revealed';
var p2Open = t >= 27.5;
cq = {
number: Q3_CH.number,
country: Q3_CH.country,
part1: Q3_CH.part1,
part2: Q3_CH.part2,
part2Revealed: p2Open,
currentValue: p2Open ? 5 : 10,
isHalfValue: p2Open,
answerText: Q3_CH.answerText,
guessedCodes: [],
lastHint: null
};
} else if (t >= 36.5 && t < 51.5) {
activeTeamId = 't3';
phase = t < 45.8 ? 'asking' : 'revealed';
var hasGuess = t >= 41.0 && t < 45.8;
cq = {
number: Q5_UA.number,
country: Q5_UA.country,
part1: Q5_UA.part1,
part2: Q5_UA.part2,
part2Revealed: false,
currentValue: 10,
isHalfValue: false,
answerText: Q5_UA.answerText,
guessedCodes: hasGuess ? ['PL'] : [],
lastHint: hasGuess
? {
guessedCode: 'PL',
tier: 'neighbor'
}
: null
};
} else if (t >= 51.5 && t < 64.5) {
activeTeamId = 't1';
phase = t < 61.6 ? 'asking' : 'revealed';
cq = {
number: Q2_IT.number,
country: Q2_IT.country,
part1: Q2_IT.part1,
part2: Q2_IT.part2,
part2Revealed: false,
currentValue: 10,
isHalfValue: false,
answerText: Q2_IT.answerText,
guessedCodes: [],
lastHint: null
};
} else if (t >= 64.5) {
phase = 'finished';
activeTeamId = 't1';
cq = null;
}

return {
totalCountries: 37,
room: {
name: 'Rowan Events · Euro',
lang: 'en',
theme: getThemeAt(t),
gameMode: 'teams',
showQuestionOnTv: true,
scoreboardPos: 'bottom',
teams: teams,
round: {
phase: phase,
activeTeamId: activeTeamId,
painted: painted,
currentQuestion: cq
}
}
};
}

// fire map animations and sound once
// runs when elapsed passes cue time
function checkTimelineCues(t) {
for (var i = 0; i < CUES.length; i++) {
var cue = CUES[i];
if (t >= cue.at && !firedCues[cue.id]) {
firedCues[cue.id] = true;
if (
cue.kind === 'paint' &&
window.TV_RENDERER
) {
window.TV_RENDERER.triggerEvent({
type: 'country_painted',
payload: { code: cue.code }
});
} else if (
cue.kind === 'hint' &&
window.TV_RENDERER
) {
window.TV_RENDERER.triggerEvent({
type: 'distance_hint',
payload: {
guessedCode: cue.code,
tier: cue.tier
}
});
}
if (t - cue.at < 1.2) {
playCueSound(cue.kind);
}
}
}
}

// draw rounded rect helper on canvas
// keeps overlay shapes clean and sharp
function roundRect(x, y, w, h, r) {
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

// draw opening title card over map
// fades smoothly before first riddle
function drawIntroCard(t) {
if (t >= 8.2) {
return;
}
var alpha = 1;
if (t > 7.2) {
alpha = Math.max(0, 1 - (t - 7.2) / 1.0);
}
ctx.save();
ctx.globalAlpha = alpha;
var x = 748;
var y = 304;
var w = 920;
var h = 304;
roundRect(x, y, w, h, 24);
ctx.fillStyle = 'rgba(7, 24, 18, 0.90)';
ctx.fill();
ctx.strokeStyle = '#b58b42';
ctx.lineWidth = 3.5;
ctx.stroke();

ctx.textAlign = 'center';
ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 20px sans-serif';
ctx.fillText(
'PURPLE FOX · INTERACTIVE TV MAP QUIZ',
x + w / 2,
y + 54
);

ctx.fillStyle = '#f8f3e6';
ctx.font = 'bold 54px Georgia, serif';
ctx.fillText(
'SOMEWHERE IN EUROPE',
x + w / 2,
y + 124
);

ctx.fillStyle = '#cbd5e1';
ctx.font = '24px sans-serif';
ctx.fillText(
'37 Countries · Teams or Solo Play' +
' · Live Phone Host (/host)',
x + w / 2,
y + 174
);

var chips = [
'5 PACKS (UK / EN)',
'CUSTOM .TXT UPLOAD',
'4 LIVE THEMES'
];
var cw = 258;
var gap = 22;
var sx =
x + (w - (cw * 3 + gap * 2)) / 2;
for (var i = 0; i < chips.length; i++) {
var cx = sx + i * (cw + gap);
roundRect(cx, y + 214, cw, 54, 10);
ctx.fillStyle =
'rgba(15, 42, 30, 0.95)';
ctx.fill();
ctx.strokeStyle =
'rgba(181, 139, 66, 0.65)';
ctx.lineWidth = 1.8;
ctx.stroke();
ctx.fillStyle = '#f8f3e6';
ctx.font = 'bold 18px sans-serif';
ctx.fillText(
chips[i],
cx + cw / 2,
y + 247
);
}
ctx.restore();
}

// pick host phone label and tap state
// mirrors real mobile /host controls
function getHostHudInfo(t) {
if (t < 8.5) {
return {
status: 'Готово: 4 команди · 37 країн',
btn: '▶ Почати гру на ТВ',
color: '#059669',
pressed: t >= 7.0 && t < 8.3
};
}
if (t < 16.5) {
return {
status: 'Хід: Red Lions · Загадка #1 (FR)',
btn: '✓ Зарахувати: France (FR)',
color: '#dc2626',
pressed: t >= 15.5 && t < 16.5
};
}
if (t < 22.5) {
return {
status: 'France відкрито! +10 PTS',
btn: '→ Наступна загадка',
color: '#0284c7',
pressed: t >= 21.6 && t < 22.5
};
}
if (t < 27.5) {
return {
status: 'Хід: Blue Owls · Загадка #3 (CH)',
btn: '+ Підказка #2 (½ балів)',
color: '#d97706',
pressed: t >= 26.5 && t < 27.5
};
}
if (t < 32.0) {
return {
status: 'Відкрито підказку · Ставка 5 PTS',
btn: '✓ Зарахувати: Switzerland',
color: '#2563eb',
pressed: t >= 31.0 && t < 32.0
};
}
if (t < 36.5) {
return {
status: 'Switzerland +5 PTS · Blue Owls',
btn: '→ Наступна загадка',
color: '#0284c7',
pressed: t >= 35.6 && t < 36.5
};
}
if (t < 41.0) {
return {
status: 'Хід: Emerald Fox · Загадка #5 (UA)',
btn: '✕ Спроба: Poland (PL)',
color: '#b91c1c',
pressed: t >= 40.0 && t < 41.0
};
}
if (t < 45.8) {
return {
status: 'Радар: Poland → ПОРУЧ (СУСІД)!',
btn: '✓ Зарахувати: Ukraine (UA)',
color: '#059669',
pressed: t >= 44.8 && t < 45.8
};
}
if (t < 51.5) {
return {
status: 'Ukraine відкрито! +10 PTS',
btn: '🎨 Перемкнути тему ТВ',
color: '#7c3aed',
pressed: t >= 50.5 && t < 51.5
};
}
if (t < 54.8) {
return {
status: 'Тема 1/4: Classic Blue',
btn: '🌙 Увімкнути Dark Slate',
color: '#334155',
pressed: t >= 54.0 && t < 54.8
};
}
if (t < 58.1) {
return {
status: 'Тема 2/4: Dark Slate',
btn: '🎄 Увімкнути Christmas',
color: '#0f766e',
pressed: t >= 57.3 && t < 58.1
};
}
if (t < 61.4) {
return {
status: 'Тема 3/4: Christmas (живий сніг!)',
btn: '🍺 Увімкнути Rowan Pub',
color: '#15803d',
pressed: t >= 60.6 && t < 61.4
};
}
if (t < 64.5) {
return {
status: 'Тема 4/4: Rowan Pub · Italy +10',
btn: '🏆 Завершити і показати подіум',
color: '#b45309',
pressed: t >= 63.6 && t < 64.5
};
}
return {
status: 'Гру завершено · 15 країн відкрито',
btn: '↺ Новий раунд / Новий пакет',
color: '#0284c7',
pressed: false
};
}

// draw simulated phone host controller
// sits over empty southeast ocean area
function drawHostHud(t) {
var info = getHostHudInfo(t);
var x = 1506;
var y = 760;
var w = 386;
var h = 158;

ctx.save();
roundRect(x, y, w, h, 18);
ctx.fillStyle = 'rgba(11, 18, 32, 0.93)';
ctx.fill();
ctx.strokeStyle = info.pressed
? '#38bdf8'
: 'rgba(148, 163, 184, 0.45)';
ctx.lineWidth = info.pressed ? 3 : 2;
ctx.stroke();

ctx.textAlign = 'left';
ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 16px sans-serif';
ctx.fillText(
'📱 ПУЛЬТ ВЕДУЧОГО (/host)',
x + 18,
y + 30
);

ctx.fillStyle = '#e2e8f0';
ctx.font = '18px sans-serif';
ctx.fillText(
info.status,
x + 18,
y + 62,
w - 36
);

var bx = x + 18;
var by = y + 84;
var bw = w - 36;
var bh = 54;
if (info.pressed) {
by += 2;
}
roundRect(bx, by, bw, bh, 12);
ctx.fillStyle = info.color;
ctx.fill();
if (info.pressed) {
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 3;
ctx.stroke();
}

ctx.textAlign = 'center';
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 20px sans-serif';
ctx.fillText(
info.btn,
bx + bw / 2,
by + 34,
bw - 20
);
ctx.restore();
}

// show active theme card in chapter 5
// highlights all 4 built-in tv themes
function drawThemeBadge(t) {
if (t < 51.5 || t >= 64.5) {
return;
}
var th = getThemeAt(t);
var label =
th === 'standard'
? '🎨 ТЕМА 1/4: CLASSIC BLUE'
: th === 'dark'
? '🌙 ТЕМА 2/4: DARK SLATE'
: th === 'christmas'
? '🎄 ТЕМА 3/4: CHRISTMAS + СНІГ'
: '🍺 ТЕМА 4/4: ROWAN PUB';
var col =
th === 'standard'
? '#0284c7'
: th === 'dark'
? '#64748b'
: th === 'christmas'
? '#15803d'
: '#b45309';

ctx.save();
roundRect(1486, 26, 406, 56, 14);
ctx.fillStyle = 'rgba(9, 14, 24, 0.92)';
ctx.fill();
ctx.strokeStyle = col;
ctx.lineWidth = 3;
ctx.stroke();
ctx.textAlign = 'center';
ctx.fillStyle = '#f8fafc';
ctx.font = 'bold 20px sans-serif';
ctx.fillText(
label,
1486 + 203,
61,
380
);
ctx.restore();
}

// pick ukrainian subtitle text at t
// explains mechanics calmly step by step
function getSubtitleInfo(t) {
if (t < 8.5) {
return {
step: 0,
badge: '1/6 · СТАРТ',
l1:
'«Десь у Європі» — інтерактивна ' +
'мапа-вікторина на 37 країн для пабів та івентів.',
l2:
'Ведучий керує грою зі смартфона (/host), ' +
'а гості бачать живу мапу та загадки на ТВ.'
};
}
if (t < 16.5) {
return {
step: 1,
badge: '2/6 · ЗАГАДКА',
l1:
'Команда Red Lions отримує загадку №1 за ' +
'10 балів. Усі бачать текст на екрані.',
l2:
'Гравці радяться і називають країну вголос — ' +
'додатків на телефонах гостей не потрібно.'
};
}
if (t < 22.5) {
return {
step: 1,
badge: '2/6 · ЗАГАДКА',
l1:
'Влучно! Ведучий натискає «Франція» на ' +
'смартфоні — країна відкривається кольором команди.',
l2:
'На екрані одразу з’являється столиця, ' +
'цікавий факт і +10 балів у таблицю.'
};
}
if (t < 27.5) {
return {
step: 2,
badge: '3/6 · ПІДКАЗКА',
l1:
'Складніша загадка №3 для Blue Owls. ' +
'Учасники вагаються і просять підказку.',
l2:
'Кожна загадка може мати 2 частини — ' +
'друга відкривається за пів ціни (½ PTS).'
};
}
if (t < 36.5) {
return {
step: 2,
badge: '3/6 · ПІДКАЗКА',
l1:
'Ведучий відкрив 2-гу підказку — ставка ' +
'знизилась до 5 балів, і команда відкрила Швейцарію!',
l2:
'Гнучка система підказок тримає комфортний ' +
'темп гри й допомагає навіть новачкам.'
};
}
if (t < 41.0) {
return {
step: 3,
badge: '4/6 · РАДАР',
l1:
'Хід Emerald Fox! Якщо гравці помиляються, ' +
'гра не зупиняється — вмикається радар.',
l2:
'Називають Польщу — ведучий фіксує ' +
'спробу одним дотиком на смартфоні.'
};
}
if (t < 45.8) {
return {
step: 3,
badge: '4/6 · РАДАР',
l1:
'Мапа підказує «ПОРУЧ (СУСІД)!» — ' +
'тепло/холодно підштовхує до правильної відповіді.',
l2:
'Учасники дивляться на сусідів Польщі й ' +
'одразу вигукують: «Україна!»'
};
}
if (t < 51.5) {
return {
step: 3,
badge: '4/6 · РАДАР',
l1:
'Україна відкрита і стає смарагдовою! ' +
'+10 балів і жива реакція всього залу.',
l2:
'Грати можна командами або індивідуально, ' +
'якщо компанія невелика.'
};
}
if (t < 58.1) {
return {
step: 4,
badge: '5/6 · ТЕМИ ОФОРМЛЕННЯ',
l1:
'Окрема фішка — 4 вбудовані теми, ' +
'які ведучий перемикає на льоту одним дотиком.',
l2:
'Classic Blue, Dark, Різдвяна зі снігом та ' +
'Rowan Pub — під будь-який заклад чи свято.'
};
}
if (t < 64.5) {
return {
step: 4,
badge: '5/6 · ТЕМИ ОФОРМЛЕННЯ',
l1:
'У грі 5 готових пакетів загадок (UK/EN) ' +
'та завантаження власних .txt за секунду.',
l2:
'Учасники крок за кроком відкривають Європу — ' +
'мапа оживає й наповнюється кольорами.'
};
}
if (t < 70.0) {
return {
step: 5,
badge: '6/6 · ФІНАЛ',
l1:
'Фінал! Автоматичний подіум показує ' +
'переможців, бали і кількість відкритих країн.',
l2:
'Результати зберігаються, а новий раунд з ' +
'іншим пакетом запускається за 10 секунд.'
};
}
return {
step: 5,
badge: '6/6 · ФІНАЛ',
l1:
'«Десь у Європі» — брендування під ваш паб, ' +
'бар чи корпоратив на purplefox.space.',
l2:
'Натисніть «Записати відео (75с)» зверху, ' +
'щоб зберегти це демо у Full HD.'
};
}

// format seconds into mm:ss clock
// keeps subtitle timer easy to read
function formatClock(sec) {
var s = Math.max(0, Math.floor(sec));
var m = Math.floor(s / 60);
var rem = s % 60;
return (
(m < 10 ? '0' : '') +
m +
':' +
(rem < 10 ? '0' : '') +
rem
);
}

// draw bottom-right ukrainian subtitles
// stays clear of left score and podium
function drawSubtitleBar(t) {
var info = getSubtitleInfo(t);
var x = 612;
var y = 934;
var w = 1280;
var h = 126;

ctx.save();
roundRect(x, y, w, h, 18);
ctx.fillStyle = 'rgba(7, 12, 22, 0.94)';
ctx.fill();
ctx.strokeStyle =
'rgba(56, 189, 248, 0.48)';
ctx.lineWidth = 2;
ctx.stroke();

// progress strip along top border
var prog = Math.min(1, t / DURATION);
roundRect(x + 16, y + 10, w - 32, 6, 3);
ctx.fillStyle = 'rgba(51, 65, 85, 0.75)';
ctx.fill();
roundRect(
x + 16,
y + 10,
Math.max(8, (w - 32) * prog),
6,
3
);
ctx.fillStyle = '#38bdf8';
ctx.fill();

// step badge on top-left of card
roundRect(x + 18, y + 23, 250, 26, 7);
ctx.fillStyle =
'rgba(56, 189, 248, 0.18)';
ctx.fill();
ctx.textAlign = 'center';
ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 15px sans-serif';
ctx.fillText(
info.badge,
x + 143,
y + 41,
238
);

// clock at top-right of card
ctx.textAlign = 'right';
ctx.fillStyle = '#94a3b8';
ctx.font = 'bold 17px sans-serif';
ctx.fillText(
formatClock(t) + ' / 01:15',
x + w - 20,
y + 42
);

// full-width ukrainian subtitle lines
ctx.textAlign = 'left';
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 23px sans-serif';
ctx.fillText(
info.l1,
x + 20,
y + 78,
w - 40
);

ctx.fillStyle = '#cbd5e1';
ctx.font = '21px sans-serif';
ctx.fillText(
info.l2,
x + 20,
y + 109,
w - 40
);
ctx.restore();

syncStepButtons(info.step);
}

// draw pulsing rec dot while capturing
// gives clear visual cue in recorded hd
function drawRecBadge(t) {
if (!isRecording) {
return;
}
ctx.save();
roundRect(36, 14, 198, 40, 10);
ctx.fillStyle = 'rgba(185, 28, 28, 0.92)';
ctx.fill();
ctx.strokeStyle = '#fda4af';
ctx.lineWidth = 2;
ctx.stroke();

var pulse =
0.45 + 0.55 * Math.abs(Math.sin(t * 4));
ctx.fillStyle =
'rgba(255, 255, 255, ' +
pulse.toFixed(2) +
')';
ctx.beginPath();
ctx.arc(60, 34, 7, 0, Math.PI * 2);
ctx.fill();

ctx.textAlign = 'left';
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 18px sans-serif';
ctx.fillText(
'REC ' + formatClock(t),
78,
40
);
ctx.restore();
}

// highlight active top step button
// keeps topbar synced with timeline
var lastActiveStep = -1;
function syncStepButtons(idx) {
if (idx === lastActiveStep) {
return;
}
lastActiveStep = idx;
for (var i = 0; i < stepBtns.length; i++) {
if (i === idx) {
stepBtns[i].classList.add('active');
} else {
stepBtns[i].classList.remove('active');
}
}
}

// seek demo cleanly to any second
// marks older cues done without sound
function jumpTo(sec) {
elapsed = Math.max(0, Math.min(DURATION, sec));
firedCues = {};
for (var i = 0; i < CUES.length; i++) {
if (CUES[i].at < elapsed - 0.15) {
firedCues[CUES[i].id] = true;
}
}
paused = false;
pauseBtn.textContent = '⏸ Пауза';
}

// pick best browser video mime type
// prefers mp4 then vp9 webm fallback
function pickMimeType() {
if (!window.MediaRecorder) {
return null;
}
var list = [
{ mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
{ mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
{ mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
{ mime: 'video/webm', ext: 'webm' }
];
for (var i = 0; i < list.length; i++) {
if (
MediaRecorder.isTypeSupported(
list[i].mime
)
) {
return list[i];
}
}
return { mime: '', ext: 'webm' };
}

// start full 75s hd canvas recording
// restarts demo and saves video file
function startRecording() {
var chosen = pickMimeType();
if (!chosen) {
recordBtn.textContent =
'✕ Запис не підтримується';
return;
}
setupAudio();
recExt = chosen.ext;
recChunks = [];

var vStream = canvas.captureStream(30);
var tracks = vStream.getVideoTracks();
if (audioDest && audioDest.stream) {
var aTracks =
audioDest.stream.getAudioTracks();
for (var i = 0; i < aTracks.length; i++) {
tracks.push(aTracks[i]);
}
}
var mix = new MediaStream(tracks);
var opts = {
videoBitsPerSecond: 6000000
};
if (chosen.mime) {
opts.mimeType = chosen.mime;
}

try {
recorder = new MediaRecorder(mix, opts);
} catch (err) {
recorder = new MediaRecorder(mix);
}

recorder.ondataavailable = function (ev) {
if (ev.data && ev.data.size > 0) {
recChunks.push(ev.data);
}
};

recorder.onstop = function () {
isRecording = false;
recordBtn.classList.remove('recording');
recordBtn.textContent =
'⏺ Записати відео (75с)';
if (recChunks.length === 0) {
return;
}
var blob = new Blob(recChunks, {
type: chosen.mime || 'video/webm'
});
var url = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = url;
a.download =
'somewhere-in-europe-demo-75s.' +
recExt;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(function () {
URL.revokeObjectURL(url);
}, 5000);
};

isRecording = true;
recordBtn.classList.add('recording');
jumpTo(0);
recorder.start(250);
}

// stop active recording early or at 75s
// triggers file download via onstop
function stopRecording() {
if (
recorder &&
recorder.state !== 'inactive'
) {
recorder.stop();
}
}

// main animation loop at display fps
// renders tv map plus demo overlays
function tick(now) {
if (!lastFrameMs) {
lastFrameMs = now;
}
var dt = Math.min(
0.1,
(now - lastFrameMs) / 1000
);
lastFrameMs = now;

if (!paused) {
elapsed += dt;
if (elapsed >= DURATION) {
if (isRecording) {
elapsed = DURATION;
stopRecording();
paused = true;
pauseBtn.textContent = '▶ Продовжити';
} else {
jumpTo(0);
}
}
}

checkTimelineCues(elapsed);

var state = buildState(elapsed);
if (window.TV_RENDERER) {
window.TV_RENDERER.render(ctx, state);
}

drawIntroCard(elapsed);
drawThemeBadge(elapsed);
drawHostHud(elapsed);
drawSubtitleBar(elapsed);
drawRecBadge(elapsed);

if (isRecording) {
var left = Math.ceil(
Math.max(0, DURATION - elapsed)
);
recordBtn.textContent =
'⏹ Стоп (' + left + 'с)';
}

requestAnimationFrame(tick);
}

// wire topbar step jump buttons
// lets viewers skip to any chapter
for (var s = 0; s < stepBtns.length; s++) {
(function (btn) {
btn.addEventListener('click', function () {
setupAudio();
var target = parseFloat(
btn.getAttribute('data-jump') || '0'
);
jumpTo(target);
});
})(stepBtns[s]);
}

restartBtn.addEventListener(
'click',
function () {
setupAudio();
jumpTo(0);
}
);

pauseBtn.addEventListener(
'click',
function () {
setupAudio();
paused = !paused;
pauseBtn.textContent = paused
? '▶ Продовжити'
: '⏸ Пауза';
}
);

soundBtn.addEventListener(
'click',
function () {
setupAudio();
soundOn = !soundOn;
if (speakerGain) {
speakerGain.gain.value =
soundOn ? 0.55 : 0;
}
soundBtn.textContent = soundOn
? '🔊 Звук: ВКЛ'
: '🔇 Звук: ВИМК';
}
);

recordBtn.addEventListener(
'click',
function () {
if (isRecording) {
stopRecording();
} else {
startRecording();
}
}
);

fsBtn.addEventListener('click', function () {
if (!document.fullscreenElement) {
if (document.documentElement.requestFullscreen) {
document.documentElement.requestFullscreen();
}
document.body.classList.add(
'fullscreen-mode'
);
} else if (document.exitFullscreen) {
document.exitFullscreen();
document.body.classList.remove(
'fullscreen-mode'
);
}
});

// unlock audio on first user tap
// satisfies mobile browser audio lock
document.addEventListener(
'pointerdown',
function () {
setupAudio();
},
{ once: true }
);

requestAnimationFrame(tick);
})();
