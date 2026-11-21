// main game state and room engine
// handles rounds, hints, and scoring
var fs = require('fs');
var path = require('path');
var config = require('./config.cjs');
var europe = require('./europe.cjs');
var questions = require('./questions.cjs');

var DATA_DIR =
process.env.DATA_DIR ||
path.join(__dirname, '..', 'data');
var DB_FILE = path.join(
DATA_DIR,
'state.json'
);

// make data dir if missing on disk
// avoids write failure on boot
function ensureDataDir() {
if (!fs.existsSync(DATA_DIR)) {
fs.mkdirSync(DATA_DIR, {
recursive: true
});
}
}

// build short unique string id
// used for rooms, teams, and entries
function makeId(prefix) {
var r = Math.floor(
Math.random() * 1000000
).toString(36);
return (
(prefix || 'id') +
'_' +
Date.now().toString(36) +
'_' +
r
);
}

// build fresh round object for room
// keeps painted map empty at start
function makeEmptyRound(queue) {
return {
phase: 'waiting',
painted: {},
activeTeamId: null,
currentQuestion: null,
queue: queue || [],
wrongTotal: 0,
hintsTotal: 0,
undoSnapshot: null
};
}

// create new room with default rules
// defaults to christmas uk pack
function makeRoom(name, lang, theme) {
var useLang =
lang === 'en' ? 'en' : 'uk';
var useTheme =
config.THEMES.indexOf(theme) !== -1
? theme
: 'standard';
var defaultPack =
useLang === 'en'
? 'christmas_en.txt'
: 'christmas_uk.txt';
var pack = questions.loadPackByFile(
defaultPack
);
var queue = questions.buildQueue(
pack.list,
[],
true
);
var t1Name =
useLang === 'en'
? 'Blue Team'
: 'Сині';
var t2Name =
useLang === 'en'
? 'Red Team'
: 'Червоні';
var t1Id = makeId('tm');
var t2Id = makeId('tm');
var round = makeEmptyRound(queue);
round.activeTeamId = t1Id;
return {
id: makeId('rm'),
name:
name ||
(useLang === 'en'
? 'Quiz Room #1'
: 'Кімната #1'),
gameNumber: 1,
lang: useLang,
theme: useTheme,
gameMode: 'teams',
scoreboardPos: 'bottom',
showQuestionOnTv: true,
isRandomOrder: true,
neighborBonus: true,
tvSound: true,
packFile: pack.fileName,
askedNumbers: [],
teams: [
{
id: t1Id,
name: t1Name,
color: config.TEAM_COLORS[0],
score: 0,
countries: 0
},
{
id: t2Id,
name: t2Name,
color: config.TEAM_COLORS[1],
score: 0,
countries: 0
}
],
coopScore: 0,
coopCountries: 0,
leaderboard: [],
round: round
};
}

// build default root database object
// creates one ready room on first run
function makeDefaultDb() {
var firstRoom = makeRoom(
'Різдвяний Квіз',
'uk',
'christmas'
);
return {
activeRoomId: firstRoom.id,
rooms: [firstRoom],
events: [],
nextEventId: 1
};
}

// load persisted database from json
// falls back to fresh room on error
function loadDb() {
ensureDataDir();
try {
if (fs.existsSync(DB_FILE)) {
var raw = fs.readFileSync(
DB_FILE,
'utf8'
);
var parsed = JSON.parse(raw);
if (
parsed &&
Array.isArray(parsed.rooms) &&
parsed.rooms.length > 0
) {
return parsed;
}
}
} catch (err) {
console.log('load db err:', err);
}
return makeDefaultDb();
}

var db = loadDb();

// write current database to disk
// keeps rooms and scores across runs
function saveDb() {
ensureDataDir();
try {
var tmp = DB_FILE + '.tmp';
fs.writeFileSync(
tmp,
JSON.stringify(db, null, 2),
'utf8'
);
fs.renameSync(tmp, DB_FILE);
} catch (err) {
console.log('save db err:', err);
}
}

// push visual or audio event for tv
// trims old entries past max limit
function pushEvent(type, payload) {
db.events.push({
id: db.nextEventId,
type: type,
payload: payload || {}
});
db.nextEventId += 1;
while (
db.events.length > config.MAX_EVENTS
) {
db.events.shift();
}
}

// find active room by activeRoomId
// returns null when on room list
function getActiveRoom() {
if (!db.activeRoomId) {
return null;
}
for (var i = 0; i < db.rooms.length; i++) {
if (db.rooms[i].id === db.activeRoomId) {
return db.rooms[i];
}
}
return null;
}

// require active room or throw error
// guards room-level actions
function requireRoom() {
var room = getActiveRoom();
if (!room) {
throw new Error('No active room');
}
return room;
}

// find team inside room by teamId
// returns team object or null
function findTeam(room, teamId) {
for (var i = 0; i < room.teams.length; i++) {
if (room.teams[i].id === teamId) {
return room.teams[i];
}
}
return null;
}

// save undo snapshot before mutation
// lets host revert last accidental tap
function saveUndo(room) {
room.round.undoSnapshot = JSON.parse(
JSON.stringify({
teams: room.teams,
coopScore: room.coopScore,
coopCountries: room.coopCountries,
askedNumbers: room.askedNumbers,
round: {
phase: room.round.phase,
painted: room.round.painted,
activeTeamId: room.round.activeTeamId,
currentQuestion:
room.round.currentQuestion,
queue: room.round.queue,
wrongTotal: room.round.wrongTotal,
hintsTotal: room.round.hintsTotal
}
})
);
}

// restore last saved undo snapshot
// cancels accidental score or paint
function undoLast() {
var room = requireRoom();
var snap = room.round.undoSnapshot;
if (!snap) {
throw new Error('Nothing to undo');
}
room.teams = snap.teams;
room.coopScore = snap.coopScore;
room.coopCountries = snap.coopCountries;
room.askedNumbers = snap.askedNumbers;
room.round.phase = snap.round.phase;
room.round.painted = snap.round.painted;
room.round.activeTeamId =
snap.round.activeTeamId;
room.round.currentQuestion =
snap.round.currentQuestion;
room.round.queue = snap.round.queue;
room.round.wrongTotal =
snap.round.wrongTotal;
room.round.hintsTotal =
snap.round.hintsTotal;
room.round.undoSnapshot = null;
pushEvent('undo', {});
saveDb();
}

// rebuild queue from current pack file
// filters asked and painted countries
function syncRoomQueue(room) {
var pack = questions.loadPackByFile(
room.packFile
);
var qList = pack.list;
var painted =
(room.round && room.round.painted) || {};
var rawQueue = questions.buildQueue(
qList,
room.askedNumbers,
room.isRandomOrder
);
var byNum = {};
for (var i = 0; i < qList.length; i++) {
byNum[qList[i].number] = qList[i];
}
room.round.queue = rawQueue.filter(
function (num) {
var item = byNum[num];
return item && !painted[item.country];
}
);
return qList;
}

// pick random non-yellow coop color
// avoids matching painted neighbor colors
function pickCoopColor(room, code) {
var pool = config.COOP_COLORS;
var painted =
(room.round && room.round.painted) || {};
var country = europe.getCountry(code);
var usedByNb = {};
if (country) {
for (
var i = 0;
i < country.neighbors.length;
i++
) {
var nb = country.neighbors[i];
if (painted[nb] && painted[nb].color) {
usedByNb[painted[nb].color] = true;
}
}
}
var choices = pool.filter(function (c) {
return !usedByNb[c];
});
if (choices.length === 0) {
choices = pool;
}
var idx = Math.floor(
Math.random() * choices.length
);
return choices[idx];
}

// return public state snapshot for tv
// includes room info, packs, and events
function getPublicState() {
var room = getActiveRoom();
var packs = questions.listAvailablePacks();
var totalCountries = Object.keys(
europe.COUNTRIES
).length;
var packTotal = 0;
if (room) {
var p = questions.loadPackByFile(
room.packFile
);
packTotal = p.list.length;
}
return {
activeRoomId: db.activeRoomId,
roomsSummary: db.rooms.map(function (r) {
var pCount = Object.keys(
r.round.painted || {}
).length;
return {
id: r.id,
name: r.name,
gameNumber: r.gameNumber,
theme: r.theme,
lang: r.lang,
gameMode: r.gameMode,
packFile: r.packFile,
paintedCount: pCount,
teamsCount: r.teams.length
};
}),
room: room,
packs: packs,
packTotal: packTotal,
totalCountries: totalCountries,
events: db.events,
nextEventId: db.nextEventId
};
}

// create and enter a new room
// uses chosen name, lang, and theme
function createRoom(name, lang, theme) {
var room = makeRoom(name, lang, theme);
db.rooms.push(room);
db.activeRoomId = room.id;
pushEvent('room_changed', {
roomId: room.id
});
saveDb();
return room;
}

// switch active room by id
// moves tv to that room state
function selectRoom(roomId) {
db.activeRoomId = roomId;
var room = requireRoom();
pushEvent('room_changed', {
roomId: room.id
});
saveDb();
}

// leave room back to room selector
// puts tv on waiting splash screen
function leaveRoom() {
db.activeRoomId = null;
saveDb();
}

// delete room from database
// returns to room list if active
function deleteRoom(roomId) {
db.rooms = db.rooms.filter(function (r) {
return r.id !== roomId;
});
if (db.activeRoomId === roomId) {
db.activeRoomId = null;
}
if (db.rooms.length === 0) {
var fallback = makeRoom(
'Кімната #1',
'uk',
'standard'
);
db.rooms.push(fallback);
}
saveDb();
}

// rename currently active room
// trims whitespace before saving
function renameRoom(name) {
var room = requireRoom();
var clean = String(name || '').trim();
if (!clean) {
throw new Error('Name required');
}
room.name = clean;
saveDb();
}

// update room settings fields
// applies theme, lang, mode, or pack
function updateSettings(opts) {
var room = requireRoom();
if (opts.lang === 'uk' || opts.lang === 'en') {
room.lang = opts.lang;
}
if (
opts.theme &&
config.THEMES.indexOf(opts.theme) !== -1
) {
room.theme = opts.theme;
pushEvent('theme_changed', {
theme: room.theme
});
}
if (
opts.gameMode === 'teams' ||
opts.gameMode === 'coop'
) {
room.gameMode = opts.gameMode;
}
if (
opts.scoreboardPos === 'top_right' ||
opts.scoreboardPos === 'top_left' ||
opts.scoreboardPos === 'bottom' ||
opts.scoreboardPos === 'hidden'
) {
room.scoreboardPos = opts.scoreboardPos;
}
if (
typeof opts.showQuestionOnTv ===
'boolean'
) {
room.showQuestionOnTv =
opts.showQuestionOnTv;
}
if (typeof opts.isRandomOrder === 'boolean') {
room.isRandomOrder = opts.isRandomOrder;
syncRoomQueue(room);
}
if (typeof opts.neighborBonus === 'boolean') {
room.neighborBonus = opts.neighborBonus;
}
if (typeof opts.tvSound === 'boolean') {
room.tvSound = opts.tvSound;
}
if (opts.packFile) {
var loaded = questions.loadPackByFile(
opts.packFile
);
if (loaded.list.length > 0) {
room.packFile = loaded.fileName;
syncRoomQueue(room);
if (
room.round.phase === 'exhausted' &&
room.round.queue.length > 0
) {
room.round.phase = 'ready';
}
}
}
saveDb();
}

// add team to active room
// assigns next distinct map color
function addTeam(name) {
var room = requireRoom();
var clean = String(name || '').trim();
if (!clean) {
throw new Error('Team name required');
}
if (room.teams.length >= 8) {
throw new Error('Max 8 teams');
}
var usedColors = {};
for (var i = 0; i < room.teams.length; i++) {
usedColors[room.teams[i].color] = true;
}
var color = config.TEAM_COLORS[0];
for (
var c = 0;
c < config.TEAM_COLORS.length;
c++
) {
if (!usedColors[config.TEAM_COLORS[c]]) {
color = config.TEAM_COLORS[c];
break;
}
}
var team = {
id: makeId('tm'),
name: clean,
color: color,
score: 0,
countries: 0
};
room.teams.push(team);
if (!room.round.activeTeamId) {
room.round.activeTeamId = team.id;
}
saveDb();
return team;
}

// remove team from room
// keeps active team valid
function removeTeam(teamId) {
var room = requireRoom();
room.teams = room.teams.filter(function (t) {
return t.id !== teamId;
});
if (room.round.activeTeamId === teamId) {
room.round.activeTeamId =
room.teams.length > 0
? room.teams[0].id
: null;
}
saveDb();
}

// set active answering team id
// updates sticky selector on phone
function setActiveTeam(teamId) {
var room = requireRoom();
if (findTeam(room, teamId)) {
room.round.activeTeamId = teamId;
saveDb();
}
}

// adjust team score manually
// lets host fix points anytime
function adjustScore(teamId, delta) {
var room = requireRoom();
saveUndo(room);
var d = parseInt(delta, 10) || 0;
if (room.gameMode === 'coop') {
room.coopScore = Math.max(
0,
room.coopScore + d
);
} else {
var tm = findTeam(room, teamId);
if (tm) {
tm.score = Math.max(0, tm.score + d);
}
}
saveDb();
}

// start map display on tv from splash
// switches phase from waiting to ready
function startSessionOnTv() {
var room = requireRoom();
if (room.round.phase === 'waiting') {
room.round.phase = 'ready';
syncRoomQueue(room);
pushEvent('round_start', {
theme: room.theme
});
saveDb();
}
}

// start a fresh round keeping teams
// resets map and scores for new round
function startNewRound() {
var room = requireRoom();
room.gameNumber += 1;
for (var i = 0; i < room.teams.length; i++) {
room.teams[i].score = 0;
room.teams[i].countries = 0;
}
room.coopScore = 0;
room.coopCountries = 0;
var activeId =
room.teams.length > 0
? room.teams[0].id
: null;
room.round = makeEmptyRound([]);
room.round.phase = 'ready';
room.round.activeTeamId = activeId;
var qList = syncRoomQueue(room);
if (room.round.queue.length === 0) {
room.askedNumbers = [];
room.round.queue = questions.buildQueue(
qList,
[],
room.isRandomOrder
);
}
pushEvent('round_start', {
theme: room.theme
});
saveDb();
}

// clear asked question history
// restores queue for unpainted countries
function resetAskedHistory() {
var room = requireRoom();
room.askedNumbers = [];
syncRoomQueue(room);
if (
room.round.phase === 'exhausted' &&
room.round.queue.length > 0
) {
room.round.phase = 'ready';
}
saveDb();
}

// draw next unasked unpainted question
// enters exhausted phase if none left
function drawNextQuestion(forcedNumber) {
var room = requireRoom();
if (room.round.phase === 'waiting') {
room.round.phase = 'ready';
}
var pack = questions.loadPackByFile(
room.packFile
);
var list = pack.list;
if (list.length === 0) {
room.round.phase = 'exhausted';
pushEvent('questions_exhausted', {});
saveDb();
return;
}
var byNum = {};
for (var i = 0; i < list.length; i++) {
byNum[list[i].number] = list[i];
}
var painted = room.round.painted || {};
room.round.queue = (room.round.queue || [])
.filter(function (num) {
var item = byNum[num];
return item && !painted[item.country];
});
if (room.round.queue.length === 0) {
syncRoomQueue(room);
}

var qObj = null;
if (forcedNumber) {
var fNum = parseInt(forcedNumber, 10);
var fItem = byNum[fNum];
if (fItem && painted[fItem.country]) {
throw new Error(
'Country is already painted'
);
}
qObj = fItem || null;
} else if (room.round.queue.length > 0) {
qObj = byNum[room.round.queue[0]] || null;
}

if (!qObj) {
room.round.currentQuestion = null;
room.round.phase = 'exhausted';
pushEvent('questions_exhausted', {});
saveDb();
return;
}

saveUndo(room);
room.round.queue = room.round.queue.filter(
function (n) {
return n !== qObj.number;
}
);
if (
room.askedNumbers.indexOf(qObj.number) === -1
) {
room.askedNumbers.push(qObj.number);
}
room.round.phase = 'asking';
room.round.currentQuestion = {
number: qObj.number,
country: qObj.country,
part1: qObj.part1,
part2: qObj.part2,
hasPart2: qObj.hasPart2,
part2Revealed: false,
answerText: qObj.answerText,
wrongCount: 0,
canShowHint: false,
hintCount: 0,
lastHint: null,
guessedCodes: [],
basePoints: config.BASE_POINTS,
currentValue: config.BASE_POINTS,
isHalfValue: false,
neighborBonusApplied: 0,
winnerTeamId: null
};
pushEvent('question_open', {
number: qObj.number,
hasPart2: qObj.hasPart2
});
saveDb();
}

// record wrong answer and unlock hint
// optionally advances turn to next team
function recordWrongAnswer(advanceTurn) {
var room = requireRoom();
var cq = room.round.currentQuestion;
if (room.round.phase !== 'asking' || !cq) {
throw new Error('No active question');
}
saveUndo(room);
cq.wrongCount += 1;
cq.canShowHint = true;
room.round.wrongTotal += 1;
if (
advanceTurn &&
room.gameMode === 'teams' &&
room.teams.length > 1
) {
var idx = 0;
for (var i = 0; i < room.teams.length; i++) {
if (
room.teams[i].id ===
room.round.activeTeamId
) {
idx = i;
break;
}
}
var nextIdx = (idx + 1) % room.teams.length;
room.round.activeTeamId =
room.teams[nextIdx].id;
}
pushEvent('wrong_answer', {
wrongCount: cq.wrongCount
});
saveDb();
}

// compute and show distance hint on tv
// only allowed after a wrong answer
function giveDistanceHint(guessedCode, manualTier) {
var room = requireRoom();
var cq = room.round.currentQuestion;
if (room.round.phase !== 'asking' || !cq) {
throw new Error('No active question');
}
if (
room.gameMode !== 'coop' &&
!cq.canShowHint
) {
throw new Error(
'Wrong answer required before hint'
);
}
var tier = manualTier || 'far';
var cleanCode = guessedCode
? String(guessedCode).toUpperCase()
: '';
if (cleanCode && europe.getCountry(cleanCode)) {
tier = europe.getDistanceHint(
cleanCode,
cq.country
);
if (tier === 'exact') {
throw new Error(
'Guessed country matches answer'
);
}
if (cq.guessedCodes.indexOf(cleanCode) === -1) {
cq.guessedCodes.push(cleanCode);
}
}
saveUndo(room);
cq.hintCount += 1;
room.round.hintsTotal += 1;
if (cq.part2Revealed) {
cq.currentValue = Math.max(
config.MIN_FINAL_POINTS,
cq.currentValue - config.EXTRA_HINT_AFTER_P2
);
} else {
cq.currentValue = Math.max(
config.MIN_HINT_POINTS,
cq.currentValue - config.HINT_PENALTY
);
}
cq.lastHint = {
guessedCode: cleanCode || null,
tier: tier,
currentValue: cq.currentValue
};
pushEvent('distance_hint', {
guessedCode: cleanCode || null,
tier: tier,
currentValue: cq.currentValue
});
saveDb();
}

// reveal second part of double question
// requires prior hint and halves points
function revealPart2() {
var room = requireRoom();
var cq = room.round.currentQuestion;
if (room.round.phase !== 'asking' || !cq) {
throw new Error('No active question');
}
if (!cq.hasPart2) {
throw new Error('Not a double question');
}
if (
room.gameMode !== 'coop' &&
cq.hintCount < 1
) {
throw new Error(
'Give distance hint before part 2'
);
}
if (cq.part2Revealed) {
return;
}
saveUndo(room);
cq.part2Revealed = true;
cq.isHalfValue = true;
cq.currentValue = Math.min(
cq.currentValue,
config.DOUBLE_PART2_POINTS
);
pushEvent('part2_revealed', {
currentValue: cq.currentValue
});
saveDb();
}

// check if team already owns border country
// returns bonus points when neighborBonus on
function calcNeighborBonus(room, teamId, code) {
if (!room.neighborBonus) {
return 0;
}
if (room.gameMode !== 'teams') {
return 0;
}
var country = europe.getCountry(code);
if (!country) {
return 0;
}
var painted = room.round.painted;
for (var i = 0; i < country.neighbors.length; i++) {
var nb = country.neighbors[i];
if (
painted[nb] &&
painted[nb].teamId === teamId
) {
return config.NEIGHBOR_BONUS;
}
}
return 0;
}

// mark correct answer and paint country
// removes other questions for country
function recordCorrectAnswer(teamIdOverride) {
var room = requireRoom();
var cq = room.round.currentQuestion;
if (room.round.phase !== 'asking' || !cq) {
throw new Error('No active question');
}
saveUndo(room);
var targetTeamId =
teamIdOverride || room.round.activeTeamId;
var team = findTeam(room, targetTeamId);
var pts = cq.currentValue;
var bonus = 0;
var color = '#059669';
var teamName =
room.lang === 'en'
? 'Explorer Team'
: 'Команда';
if (room.gameMode === 'teams') {
if (!team && room.teams.length > 0) {
team = room.teams[0];
}
if (team) {
bonus = calcNeighborBonus(
room,
team.id,
cq.country
);
team.score += pts + bonus;
team.countries += 1;
color = team.color;
teamName = team.name;
cq.winnerTeamId = team.id;
}
} else {
room.coopScore += pts;
room.coopCountries += 1;
color = pickCoopColor(room, cq.country);
cq.winnerTeamId = 'coop';
}
cq.neighborBonusApplied = bonus;
room.round.painted[cq.country] = {
teamId: cq.winnerTeamId,
teamName: teamName,
color: color,
points: pts + bonus,
paintedAt: Date.now()
};
syncRoomQueue(room);
room.round.phase = 'revealed';
pushEvent('country_painted', {
code: cq.country,
color: color,
points: pts + bonus,
bonus: bonus,
teamName: teamName
});
saveDb();
}

// skip question and optionally reveal map
// unrevealed country stays eligible later
function skipQuestion(revealCountry) {
var room = requireRoom();
var cq = room.round.currentQuestion;
if (room.round.phase !== 'asking' || !cq) {
throw new Error('No active question');
}
saveUndo(room);
if (revealCountry) {
room.round.painted[cq.country] = {
teamId: null,
teamName: '-',
color: '#64748b',
points: 0,
paintedAt: Date.now()
};
syncRoomQueue(room);
room.round.phase = 'revealed';
pushEvent('skip_reveal', {
code: cq.country
});
} else {
room.round.currentQuestion = null;
room.round.phase =
room.round.queue.length > 0
? 'ready'
: 'exhausted';
}
saveDb();
}

// close revealed answer back to ready map
// enters exhausted if no questions left
function nextReady() {
var room = requireRoom();
room.round.currentQuestion = null;
syncRoomQueue(room);
room.round.phase =
room.round.queue.length > 0
? 'ready'
: 'exhausted';
if (room.round.phase === 'exhausted') {
pushEvent('questions_exhausted', {});
}
saveDb();
}

// finish current round and save record
// adds coop score to async leaderboard
function finishRound(teamLabel) {
var room = requireRoom();
room.round.phase = 'finished';
if (room.gameMode === 'coop') {
room.leaderboard.push({
id: makeId('lb'),
label:
teamLabel ||
(room.lang === 'en'
? 'Run #' + room.gameNumber
: 'Гра #' + room.gameNumber),
score: room.coopScore,
countries: room.coopCountries,
date: new Date().toISOString().slice(0, 10)
});
room.leaderboard.sort(function (a, b) {
return b.score - a.score;
});
if (room.leaderboard.length > 20) {
room.leaderboard = room.leaderboard.slice(
0,
20
);
}
}
pushEvent('round_end', {});
saveDb();
}

// export full database object for backup
// allows restoring on another device
function exportAll() {
return JSON.parse(JSON.stringify(db));
}

// import database backup payload
// validates rooms array before saving
function importAll(payload) {
if (
!payload ||
!Array.isArray(payload.rooms) ||
payload.rooms.length === 0
) {
throw new Error('Invalid backup JSON');
}
db = payload;
if (!db.nextEventId) {
db.nextEventId = 1;
}
if (!Array.isArray(db.events)) {
db.events = [];
}
saveDb();
}

module.exports = {
getPublicState: getPublicState,
createRoom: createRoom,
selectRoom: selectRoom,
leaveRoom: leaveRoom,
deleteRoom: deleteRoom,
renameRoom: renameRoom,
updateSettings: updateSettings,
addTeam: addTeam,
removeTeam: removeTeam,
setActiveTeam: setActiveTeam,
adjustScore: adjustScore,
startSessionOnTv: startSessionOnTv,
startNewRound: startNewRound,
resetAskedHistory: resetAskedHistory,
drawNextQuestion: drawNextQuestion,
recordWrongAnswer: recordWrongAnswer,
giveDistanceHint: giveDistanceHint,
revealPart2: revealPart2,
recordCorrectAnswer: recordCorrectAnswer,
skipQuestion: skipQuestion,
nextReady: nextReady,
finishRound: finishRound,
undoLast: undoLast,
exportAll: exportAll,
importAll: importAll
};
