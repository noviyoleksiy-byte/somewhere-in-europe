// host mobile controller in strict es5
// manages rooms, hints, themes, packs
(function () {
var state = null;
var countries = [];
var packQuestions = [];
var activeView = 'live';
var pickerOpen = false;
var newRoomTheme = 'christmas';
var uiLang = 'uk';
var confirmTimers = {};
var errTimer = null;

// fetch dom node by id shorthand
// keeps wiring readable on narrow line
function $(id) {
return document.getElementById(id);
}

// show temporary error banner at top
// auto-hides after 4.5 seconds
function showError(msg) {
var b = $('error-banner');
b.innerHTML = msg || 'Error';
b.style.display = 'block';
if (errTimer) clearTimeout(errTimer);
errTimer = setTimeout(function () {
b.style.display = 'none';
}, 4500);
}

// send xhr json request to api route
// updates local state on success
function apiPost(url, body, cb) {
var xhr = new XMLHttpRequest();
xhr.open('POST', url, true);
xhr.setRequestHeader(
'Content-Type',
'application/json;charset=UTF-8'
);
xhr.onreadystatechange = function () {
if (xhr.readyState !== 4) return;
try {
var res = JSON.parse(xhr.responseText);
if (!res.ok) {
showError(res.error || 'Error');
return;
}
if (res.state) {
state = res.state;
render();
}
if (cb) cb(res);
} catch (e) {
showError('Network error');
}
};
xhr.send(JSON.stringify(body || {}));
}

// send xhr get request for json data
// used for state, ip, and countries
function apiGet(url, cb) {
var xhr = new XMLHttpRequest();
xhr.open('GET', url, true);
xhr.onreadystatechange = function () {
if (
xhr.readyState === 4 &&
xhr.status === 200
) {
try {
cb(JSON.parse(xhr.responseText));
} catch (e) {}
}
};
xhr.send();
}

// require two taps for destructive btns
// avoids window.confirm in iframe
function withConfirm(btn, label, fn) {
var key = btn.id || label;
var curLang =
(state && state.room && state.room.lang) ||
uiLang;
var t = window.APP_I18N[curLang] ||
window.APP_I18N.uk;
if (confirmTimers[key]) {
clearTimeout(confirmTimers[key]);
delete confirmTimers[key];
btn.className = btn.className.replace(
' btn-confirming',
''
);
fn();
return;
}
btn.innerHTML = t.confirmAgain;
btn.className += ' btn-confirming';
confirmTimers[key] = setTimeout(function () {
delete confirmTimers[key];
btn.className = btn.className.replace(
' btn-confirming',
''
);
render();
}, 3000);
}

// load full countries list once
// builds fast hint picker chips
function loadCountries() {
apiGet('/api/countries', function (res) {
if (res && res.countries) {
countries = res.countries;
renderCountryChips();
}
});
}

// load questions for picker list
// updates when active pack changes
function loadPackQuestions() {
apiGet('/api/pack-questions', function (res) {
if (res && res.questions) {
packQuestions = res.questions;
renderQuestionPicker();
}
});
}

// return active localization dictionary
// reads room lang or local uiLang
function getT() {
var lang =
(state && state.room && state.room.lang) ||
uiLang;
if (lang !== 'en') lang = 'uk';
return {
lang: lang,
t: window.APP_I18N[lang]
};
}

// apply localized labels across ui
// updates buttons, hints, placeholders
function applyI18n(lang, t) {
$('lbl-tv-addr').innerHTML = t.tvAddr;
$('btn-switch-tv').innerHTML = t.btnTv;
$('btn-lang-uk').className =
lang === 'uk'
? 'lang-pill active'
: 'lang-pill';
$('btn-lang-en').className =
lang === 'en'
? 'lang-pill active'
: 'lang-pill';

$('lbl-rooms-title').innerHTML =
t.roomsTitle;
$('lbl-rooms-desc').innerHTML =
t.roomsDesc;
$('new-room-name').placeholder =
t.newRoomPh;
$('btn-create-room').innerHTML =
t.btnCreateRoom;
$('new-theme-std').innerHTML =
t.themeStandard;
$('new-theme-dark').innerHTML =
t.themeDark;
$('new-theme-xmas').innerHTML =
t.themeChristmas;
$('lbl-saved-rooms').innerHTML =
t.savedRooms;
$('lbl-backup-title').innerHTML =
t.backupTitle;
$('lbl-backup-desc').innerHTML =
t.backupDesc;
$('btn-export-json').innerHTML =
t.btnExport;
$('btn-import-json').innerHTML =
t.btnImport;

$('sticky-hint').innerHTML =
t.activeTeamHint;
$('lbl-phase').innerHTML = t.phaseLbl;
$('lbl-map').innerHTML = t.mapLbl;
$('lbl-theme-bar').innerHTML =
t.themeBarTitle;
$('live-theme-std').innerHTML =
t.themeStandard;
$('live-theme-dark').innerHTML =
t.themeDark;
$('live-theme-xmas').innerHTML =
t.themeChristmas;
$('lbl-sb-pos').innerHTML = t.sbPosTitle;
$('sb-bottom').innerHTML = t.sbBottom;
$('sb-hidden').innerHTML = t.sbHidden;

$('input-add-team').placeholder =
t.addTeamPh;
$('btn-add-team').innerHTML = t.btnAddTeam;
$('lbl-wait-title').innerHTML =
t.waitingCardTitle;
$('lbl-wait-desc').innerHTML =
t.waitingCardDesc;
$('btn-start-tv').innerHTML = t.btnStartTv;
$('lbl-draw-title').innerHTML =
t.drawCardTitle;
$('lbl-draw-desc').innerHTML =
t.drawCardDesc;
$('btn-draw-next').innerHTML =
t.btnDrawNext;
$('btn-toggle-picker').innerHTML =
t.btnPickCountry;

$('lbl-host-eyes').innerHTML =
t.hostEyesOnly;
$('btn-correct').innerHTML = t.btnCorrect;
$('btn-wrong-stay').innerHTML =
t.btnWrongStay;
$('btn-wrong-pass').innerHTML =
t.btnWrongPass;
$('lbl-hint-title').innerHTML =
t.hintBoxTitle;
$('hint-country-search').placeholder =
t.hintSearchPh;
$('lbl-manual-hint').innerHTML =
t.hintManualLbl;
$('btn-hint-neighbor').innerHTML =
t.btnManualNeighbor;
$('btn-hint-close').innerHTML =
t.btnManualClose;
$('btn-hint-far').innerHTML =
t.btnManualFar;
$('btn-reveal-part2').innerHTML =
t.btnRevealPart2;
$('part2-locked-tip').innerHTML =
t.part2LockedTip;
$('btn-skip-reveal').innerHTML =
t.btnSkipReveal;
$('btn-skip-next').innerHTML =
t.btnSkipNext;
$('revealed-title').innerHTML =
t.tvCorrectTitle;
$('btn-next-ready').innerHTML =
t.btnNextQuestionPhase;
$('exhausted-title').innerHTML =
t.exhaustedTitle;
$('exhausted-desc').innerHTML =
t.exhaustedDesc;
$('btn-exhausted-pack').innerHTML =
t.btnPickOtherPack;
$('btn-exhausted-reset').innerHTML =
t.btnResetContinue;
$('finished-title').innerHTML =
t.phaseFinished;
$('btn-new-round-fin').innerHTML =
t.btnNewRound;
$('btn-undo').innerHTML = t.btnUndo;
if (!confirmTimers['btn-new-round-live']) {
$('btn-new-round-live').innerHTML =
t.btnNewRound;
}
$('btn-switch-room-live').innerHTML =
t.btnSwitchRoom;

$('lbl-set-mode').innerHTML =
t.setModeTitle;
$('lbl-set-mode-desc').innerHTML =
t.setModeDesc;
$('mode-teams-btn').innerHTML = t.modeTeams;
$('mode-coop-btn').innerHTML = t.modeCoop;
$('lbl-set-pack').innerHTML =
t.setPackTitle;
$('lbl-set-pack-desc').innerHTML =
t.setPackDesc;
$('btn-upload-pack').innerHTML =
t.btnUploadPack;
$('btn-download-pack').innerHTML =
t.btnDownloadPack;
$('btn-reset-asked').innerHTML =
t.btnResetAsked;
$('lbl-set-order').innerHTML =
t.setOrderTitle;
$('btn-order-random').innerHTML =
t.orderRandom;
$('btn-order-seq').innerHTML = t.orderSeq;
$('btn-tv-q-on').innerHTML = t.tvShowQ;
$('btn-tv-q-off').innerHTML = t.tvHideQ;
$('btn-bonus-on').innerHTML = t.bonusOn;
$('btn-bonus-off').innerHTML = t.bonusOff;
$('lbl-set-teams').innerHTML =
t.setTeamsTitle;
$('lbl-set-room').innerHTML = t.setRoomTitle;
$('input-rename-room').placeholder =
t.renamePh;
$('btn-rename-room').innerHTML = t.btnRename;
if (!confirmTimers['btn-delete-room']) {
$('btn-delete-room').innerHTML =
t.btnDeleteRoom;
}
}

// render country chips for distance hint
// filters by search input value
function renderCountryChips() {
var box = $('hint-country-chips');
if (!box) return;
var q = $('hint-country-search')
.value.trim()
.toLowerCase();
var info = getT();
var cq =
state &&
state.room &&
state.room.round &&
state.room.round.currentQuestion;
var tried = (cq && cq.guessedCodes) || [];
box.innerHTML = '';
for (var i = 0; i < countries.length; i++) {
var c = countries[i];
var name =
info.lang === 'en' ? c.en : c.uk;
if (
q &&
name.toLowerCase().indexOf(q) === -1 &&
c.code.toLowerCase().indexOf(q) === -1
) {
continue;
}
if (cq && cq.country === c.code) {
continue;
}
var btn = document.createElement('button');
btn.type = 'button';
btn.className =
tried.indexOf(c.code) !== -1
? 'country-chip tried'
: 'country-chip';
btn.innerHTML = c.code + ' ' + name;
btn.setAttribute('data-code', c.code);
btn.onclick = function () {
var gc = this.getAttribute('data-code');
apiPost('/api/distance-hint', {
guessedCode: gc
});
};
box.appendChild(btn);
}
}

// render selectable question list
// allows host to pick specific country
function renderQuestionPicker() {
var box = $('question-picker-list');
if (!box) return;
var asked =
(state &&
state.room &&
state.room.askedNumbers) ||
[];
var painted =
(state &&
state.room &&
state.room.round &&
state.room.round.painted) ||
{};
box.innerHTML = '';
for (var i = 0; i < packQuestions.length; i++) {
var q = packQuestions[i];
var isAsked = asked.indexOf(q.number) !== -1;
var isPainted = !!painted[q.country];
var btn = document.createElement('button');
btn.type = 'button';
btn.className =
isAsked || isPainted
? 'pick-row asked'
: 'pick-row';
btn.disabled = isPainted;
btn.setAttribute('data-num', q.number);
btn.innerHTML =
'<b>#' +
q.number +
' [' +
q.country +
(isPainted ? ' ✓' : '') +
']</b> ' +
(q.hasPart2 ? '★½ ' : '') +
q.part1.slice(0, 56) +
'…';
btn.onclick = function () {
var num = this.getAttribute('data-num');
pickerOpen = false;
$('question-picker-box').style.display =
'none';
apiPost('/api/draw-question', {
number: parseInt(num, 10)
});
};
box.appendChild(btn);
}
}

// render rooms selector list
// builds open and delete cards
function renderRooms(t) {
var box = $('rooms-list');
var list =
(state && state.roomsSummary) || [];
box.innerHTML = '';
if (list.length === 0) {
box.innerHTML =
'<div class="muted">' +
t.noRooms +
'</div>';
return;
}
for (var i = 0; i < list.length; i++) {
var r = list[i];
var card = document.createElement('div');
card.className = 'room-card';
card.innerHTML =
'<div class="room-card-title">' +
r.name +
'</div>' +
'<div class="room-card-meta">#' +
r.gameNumber +
' • ' +
r.theme +
' • ' +
r.paintedCount +
'/37</div>';
var row = document.createElement('div');
row.className = 'row-list';
row.style.marginBottom = '0';

var openBtn = document.createElement('button');
openBtn.type = 'button';
openBtn.className = 'pill-btn selected';
openBtn.innerHTML = t.btnOpenRoom;
openBtn.setAttribute('data-id', r.id);
openBtn.onclick = function () {
apiPost('/api/select-room', {
roomId: this.getAttribute('data-id')
});
};

var delBtn = document.createElement('button');
delBtn.type = 'button';
delBtn.className = 'pill-btn';
delBtn.innerHTML = t.btnDelete;
delBtn.setAttribute('data-id', r.id);
delBtn.onclick = function () {
var rid = this.getAttribute('data-id');
withConfirm(this, 'del_' + rid, function () {
apiPost('/api/delete-room', {
roomId: rid
});
});
};
row.appendChild(openBtn);
row.appendChild(delBtn);
card.appendChild(row);
box.appendChild(card);
}
}

// render sticky top active team bar
// updates dropdown list of all teams
function renderStickyTeam(room, t) {
var slot = $('sticky-slot');
if (
!room ||
room.gameMode !== 'teams' ||
activeView === 'settings'
) {
slot.style.display = 'none';
return;
}
slot.style.display = 'block';
var active = null;
for (var i = 0; i < room.teams.length; i++) {
if (
room.teams[i].id === room.round.activeTeamId
) {
active = room.teams[i];
break;
}
}
if (!active && room.teams.length > 0) {
active = room.teams[0];
}
if (active) {
$('sticky-dot').style.background =
active.color;
$('sticky-label').innerHTML =
active.name +
' (' +
active.score +
' pts • ' +
active.countries +
' 🗺)';
} else {
$('sticky-label').innerHTML = t.selectTeam;
}
var dd = $('sticky-dropdown');
dd.innerHTML = '';
for (var k = 0; k < room.teams.length; k++) {
var tm = room.teams[k];
var item = document.createElement('button');
item.type = 'button';
item.className =
active && tm.id === active.id
? 'dropdown-item selected'
: 'dropdown-item';
item.setAttribute('data-tid', tm.id);
item.innerHTML =
'<span><span class="color-dot" style="display:inline-block;margin-right:6px;background:' +
tm.color +
';"></span>' +
tm.name +
'</span><span>' +
tm.score +
' pts</span>';
item.onclick = function () {
dd.style.display = 'none';
apiPost('/api/set-active-team', {
teamId: this.getAttribute('data-tid')
});
};
dd.appendChild(item);
}
}

// render full phone ui from state
// switches rooms, live, and settings
function render() {
if (!state) return;
var info = getT();
var lang = info.lang;
var t = info.t;
applyI18n(lang, t);

var sndBtn = $('btn-tv-sound');
var room = state.room;
if (!room) {
if (sndBtn) sndBtn.style.display = 'none';
$('sticky-slot').style.display = 'none';
$('room-header').style.display = 'none';
$('screen-live').style.display = 'none';
$('screen-settings').style.display = 'none';
$('screen-rooms').style.display = 'block';
renderRooms(t);
return;
}

if (sndBtn) {
sndBtn.style.display = '';
sndBtn.innerHTML = room.tvSound
? '🔊'
: '🔇';
sndBtn.title = room.tvSound
? t.tvSoundBtnOn
: t.tvSoundBtnOff;
sndBtn.className = room.tvSound
? 'lang-pill sound-on'
: 'lang-pill sound-off';
}

$('screen-rooms').style.display = 'none';
$('room-header').style.display = 'block';
$('header-room-name').innerHTML = room.name;

var paintedCount = Object.keys(
(room.round && room.round.painted) || {}
).length;
var leftQ =
(room.round &&
room.round.queue &&
room.round.queue.length) ||
0;
$('header-badge').innerHTML =
'#' +
room.gameNumber +
' • 🗺 ' +
paintedCount +
'/37 • Q ' +
leftQ +
'/' +
(state.packTotal || 0);

$('btn-toggle-settings').innerHTML =
activeView === 'settings'
? t.btnBackLive
: t.btnSettings;
$('btn-toggle-settings').className =
activeView === 'settings'
? 'btn-settings-toggle active'
: 'btn-settings-toggle';

renderStickyTeam(room, t);

if (activeView === 'settings') {
$('screen-live').style.display = 'none';
$('screen-settings').style.display = 'block';
renderSettings(room, lang, t);
return;
}

$('screen-settings').style.display = 'none';
$('screen-live').style.display = 'block';
renderLive(room, lang, t);
}

// render live control screen cards
// updates phase buttons and hint box
function renderLive(room, lang, t) {
var round = room.round || {};
var phase = round.phase || 'waiting';
var phaseMap = {
waiting: t.phaseWaiting,
ready: t.phaseReady,
asking: t.phaseAsking,
revealed: t.phaseRevealed,
exhausted: t.phaseExhausted,
finished: t.phaseFinished
};
$('val-phase').innerHTML =
phaseMap[phase] || phase;
var paintedCount = Object.keys(
round.painted || {}
).length;
$('val-map').innerHTML =
paintedCount +
'/37 • Q ' +
((round.queue && round.queue.length) || 0);

var sb = room.scoreboardPos || 'bottom';
$('sb-bottom').className =
sb !== 'hidden'
? 'pill-btn selected'
: 'pill-btn';
$('sb-hidden').className =
sb === 'hidden'
? 'pill-btn selected'
: 'pill-btn';

$('card-add-team').style.display =
room.gameMode === 'teams' ? 'block' : 'none';
$('card-waiting').style.display =
phase === 'waiting' ? 'block' : 'none';
$('card-ready').style.display =
phase === 'ready' ? 'block' : 'none';
$('card-asking').style.display =
phase === 'asking' ? 'block' : 'none';
$('card-revealed').style.display =
phase === 'revealed' ? 'block' : 'none';
$('card-exhausted').style.display =
phase === 'exhausted' ? 'block' : 'none';
$('card-finished').style.display =
phase === 'finished' ? 'block' : 'none';

var finTxt =
room.gameMode === 'coop'
? t.coopFinishBtn
: t.btnFinishRound;
if (!confirmTimers['btn-finish-round']) {
$('btn-finish-round').innerHTML = finTxt;
}
if (!confirmTimers['btn-exhausted-finish']) {
$('btn-exhausted-finish').innerHTML = finTxt;
}

$('btn-undo').disabled = !round.undoSnapshot;

if (phase === 'asking' && round.currentQuestion) {
var cq = round.currentQuestion;
var valBadge = $('val-q-points');
valBadge.innerHTML = cq.isHalfValue
? cq.currentValue + ' pts (½)'
: cq.currentValue + ' pts';
valBadge.className = cq.isHalfValue
? 'value-badge half'
: 'value-badge';

$('asking-q-num').innerHTML =
'#' + cq.number + ' [' + cq.country + ']';
$('asking-q-part1').innerHTML = cq.part1;

var p2Box = $('asking-q-part2-box');
if (cq.hasPart2) {
p2Box.style.display = 'block';
p2Box.innerHTML =
'<b>' +
t.part2HostLbl +
'</b><br>' +
cq.part2 +
(cq.part2Revealed
? ' <b>[OPEN ON TV]</b>'
: '');
} else {
p2Box.style.display = 'none';
}

var cName = cq.country;
for (var c = 0; c < countries.length; c++) {
if (countries[c].code === cq.country) {
cName =
lang === 'en'
? countries[c].en
: countries[c].uk;
break;
}
}
$('asking-answer-box').innerHTML =
t.answerCountryLbl +
' ' +
cName +
'<br><span style="font-weight:500;color:#cbd5e1;">' +
cq.answerText +
'</span>';

var isCoop = room.gameMode === 'coop';
$('btn-wrong-pass').style.display = isCoop
? 'none'
: '';
$('btn-wrong-stay').innerHTML = isCoop
? t.btnWrongCoop
: t.btnWrongStay;

var allowHints = isCoop || cq.canShowHint;
$('hint-controls-box').style.display = allowHints
? 'block'
: 'none';
if (allowHints) {
renderCountryChips();
}

var lhp = $('last-hint-pill');
if (cq.lastHint) {
lhp.style.display = 'block';
var tierLbl =
cq.lastHint.tier === 'neighbor'
? t.hintNeighbor
: cq.lastHint.tier === 'close'
? t.hintClose
: t.hintFar;
lhp.innerHTML =
(cq.lastHint.guessedCode
? cq.lastHint.guessedCode + ' → '
: '') + tierLbl;
} else {
lhp.style.display = 'none';
}

var p2Unlock = $('part2-unlock-box');
if (cq.hasPart2 && !cq.part2Revealed) {
p2Unlock.style.display = 'block';
var canP2 = isCoop || cq.hintCount >= 1;
$('btn-reveal-part2').disabled = !canP2;
$('part2-locked-tip').style.display = canP2
? 'none'
: 'block';
} else {
p2Unlock.style.display = 'none';
}
}

if (
phase === 'revealed' &&
round.currentQuestion
) {
$('revealed-answer').innerHTML =
round.currentQuestion.answerText;
}
}

// render settings screen packs and teams
// lets host switch packs or edit points
function renderSettings(room, lang, t) {
$('mode-teams-btn').className =
room.gameMode === 'teams'
? 'pill-btn selected'
: 'pill-btn';
$('mode-coop-btn').className =
room.gameMode === 'coop'
? 'pill-btn selected'
: 'pill-btn';

var packBox = $('pack-list');
packBox.innerHTML = '';
var packs = state.packs || [];
for (var i = 0; i < packs.length; i++) {
var pk = packs[i];
var btn = document.createElement('button');
btn.type = 'button';
btn.className =
pk.file === room.packFile
? 'pill-btn selected'
: 'pill-btn';
btn.setAttribute('data-file', pk.file);
btn.innerHTML =
(lang === 'en' ? pk.labelEn : pk.labelUk) +
' (' +
pk.count +
')';
btn.onclick = function () {
var fn = this.getAttribute('data-file');
apiPost(
'/api/settings',
{ packFile: fn },
function () {
loadPackQuestions();
}
);
};
packBox.appendChild(btn);
}

$('btn-order-random').className =
room.isRandomOrder
? 'pill-btn selected'
: 'pill-btn';
$('btn-order-seq').className =
!room.isRandomOrder
? 'pill-btn selected'
: 'pill-btn';
$('btn-tv-q-on').className =
room.showQuestionOnTv
? 'pill-btn selected'
: 'pill-btn';
$('btn-tv-q-off').className =
!room.showQuestionOnTv
? 'pill-btn selected'
: 'pill-btn';
$('btn-bonus-on').className =
room.neighborBonus
? 'pill-btn selected'
: 'pill-btn';
$('btn-bonus-off').className =
!room.neighborBonus
? 'pill-btn selected'
: 'pill-btn';

$('live-theme-std').className =
room.theme === 'standard'
? 'pill-btn selected'
: 'pill-btn';
$('live-theme-dark').className =
room.theme === 'dark'
? 'pill-btn selected'
: 'pill-btn';
$('live-theme-xmas').className =
room.theme === 'christmas'
? 'pill-btn selected'
: 'pill-btn';

var tList = $('settings-teams-list');
tList.innerHTML = '';
if (room.gameMode === 'coop') {
var cRow = document.createElement('div');
cRow.className = 'team-edit-row';
cRow.innerHTML =
'<span>' +
t.coopScoreLbl +
': <b>' +
room.coopScore +
'</b></span>';
var cBtns = document.createElement('div');
cBtns.className = 'team-edit-btns';
var m10 = document.createElement('button');
m10.type = 'button';
m10.className = 'mini-btn';
m10.innerHTML = '-10';
m10.onclick = function () {
apiPost('/api/adjust-score', { delta: -10 });
};
var p10 = document.createElement('button');
p10.type = 'button';
p10.className = 'mini-btn';
p10.innerHTML = '+10';
p10.onclick = function () {
apiPost('/api/adjust-score', { delta: 10 });
};
cBtns.appendChild(m10);
cBtns.appendChild(p10);
cRow.appendChild(cBtns);
tList.appendChild(cRow);
} else {
for (var k = 0; k < room.teams.length; k++) {
var tm = room.teams[k];
var row = document.createElement('div');
row.className = 'team-edit-row';
row.innerHTML =
'<div class="team-edit-left"><span class="color-dot" style="background:' +
tm.color +
'"></span><span>' +
tm.name +
' (' +
tm.score +
')</span></div>';
var btns = document.createElement('div');
btns.className = 'team-edit-btns';

var bm = document.createElement('button');
bm.type = 'button';
bm.className = 'mini-btn';
bm.innerHTML = '-10';
bm.setAttribute('data-tid', tm.id);
bm.onclick = function () {
apiPost('/api/adjust-score', {
teamId: this.getAttribute('data-tid'),
delta: -10
});
};

var bp = document.createElement('button');
bp.type = 'button';
bp.className = 'mini-btn';
bp.innerHTML = '+10';
bp.setAttribute('data-tid', tm.id);
bp.onclick = function () {
apiPost('/api/adjust-score', {
teamId: this.getAttribute('data-tid'),
delta: 10
});
};

var bd = document.createElement('button');
bd.type = 'button';
bd.className = 'mini-btn';
bd.innerHTML = '✕';
bd.setAttribute('data-tid', tm.id);
bd.onclick = function () {
apiPost('/api/remove-team', {
teamId: this.getAttribute('data-tid')
});
};
btns.appendChild(bm);
btns.appendChild(bp);
btns.appendChild(bd);
row.appendChild(btns);
tList.appendChild(row);
}
}
}

// wire all static dom event handlers
// runs once at page startup
function bindEvents() {
$('btn-switch-tv').onclick = function () {
if (
window.parent &&
window.parent !== window
) {
window.parent.postMessage(
{ type: 'CLOSE_HOST_DRAWER' },
'*'
);
} else {
window.location.href = '/';
}
};

$('btn-lang-uk').onclick = function () {
uiLang = 'uk';
if (state && state.room) {
apiPost('/api/settings', { lang: 'uk' });
} else {
render();
}
};

$('btn-lang-en').onclick = function () {
uiLang = 'en';
if (state && state.room) {
apiPost('/api/settings', { lang: 'en' });
} else {
render();
}
};

$('new-theme-std').onclick = function () {
newRoomTheme = 'standard';
$('new-theme-std').className =
'pill-btn selected';
$('new-theme-dark').className = 'pill-btn';
$('new-theme-xmas').className = 'pill-btn';
};
$('new-theme-dark').onclick = function () {
newRoomTheme = 'dark';
$('new-theme-std').className = 'pill-btn';
$('new-theme-dark').className =
'pill-btn selected';
$('new-theme-xmas').className = 'pill-btn';
};
$('new-theme-xmas').onclick = function () {
newRoomTheme = 'christmas';
$('new-theme-std').className = 'pill-btn';
$('new-theme-dark').className = 'pill-btn';
$('new-theme-xmas').className =
'pill-btn selected';
};

$('btn-create-room').onclick = function () {
var nm = $('new-room-name').value.trim();
$('new-room-name').value = '';
apiPost('/api/create-room', {
name: nm,
lang: uiLang,
theme: newRoomTheme
});
};

$('sticky-btn').onclick = function () {
var dd = $('sticky-dropdown');
dd.style.display =
dd.style.display === 'none'
? 'block'
: 'none';
};

$('btn-toggle-settings').onclick = function () {
activeView =
activeView === 'settings'
? 'live'
: 'settings';
render();
};

$('btn-tv-sound').onclick = function () {
var cur =
state && state.room && state.room.tvSound;
apiPost('/api/settings', { tvSound: !cur });
};

$('live-theme-std').onclick = function () {
apiPost('/api/settings', { theme: 'standard' });
};
$('live-theme-dark').onclick = function () {
apiPost('/api/settings', { theme: 'dark' });
};
$('live-theme-xmas').onclick = function () {
apiPost('/api/settings', {
theme: 'christmas'
});
};

$('sb-bottom').onclick = function () {
apiPost('/api/settings', {
scoreboardPos: 'bottom'
});
};
$('sb-hidden').onclick = function () {
apiPost('/api/settings', {
scoreboardPos: 'hidden'
});
};

$('btn-add-team').onclick = function () {
var nm = $('input-add-team').value.trim();
if (!nm) return;
$('input-add-team').value = '';
apiPost('/api/add-team', { name: nm });
};

$('btn-start-tv').onclick = function () {
apiPost('/api/start-tv', {});
};

$('btn-draw-next').onclick = function () {
apiPost('/api/draw-question', {});
};

$('btn-toggle-picker').onclick = function () {
pickerOpen = !pickerOpen;
$('question-picker-box').style.display =
pickerOpen ? 'block' : 'none';
if (pickerOpen) {
loadPackQuestions();
}
};

$('btn-finish-round').onclick = function () {
withConfirm(
this,
'btn-finish-round',
function () {
apiPost('/api/finish-round', {});
}
);
};

$('btn-exhausted-pack').onclick = function () {
activeView = 'settings';
render();
};

$('btn-exhausted-reset').onclick = function () {
apiPost('/api/reset-asked', {});
};

$('btn-exhausted-finish').onclick = function () {
withConfirm(
this,
'btn-exhausted-finish',
function () {
apiPost('/api/finish-round', {});
}
);
};

$('btn-correct').onclick = function () {
apiPost('/api/correct-answer', {});
};

$('btn-wrong-stay').onclick = function () {
apiPost('/api/wrong-answer', {
advanceTurn: false
});
};

$('btn-wrong-pass').onclick = function () {
apiPost('/api/wrong-answer', {
advanceTurn: true
});
};

$('hint-country-search').oninput = function () {
renderCountryChips();
};

$('btn-hint-neighbor').onclick = function () {
apiPost('/api/distance-hint', {
manualTier: 'neighbor'
});
};
$('btn-hint-close').onclick = function () {
apiPost('/api/distance-hint', {
manualTier: 'close'
});
};
$('btn-hint-far').onclick = function () {
apiPost('/api/distance-hint', {
manualTier: 'far'
});
};

$('btn-reveal-part2').onclick = function () {
apiPost('/api/reveal-part2', {});
};

$('btn-skip-reveal').onclick = function () {
apiPost('/api/skip-question', {
reveal: true
});
};

$('btn-skip-next').onclick = function () {
apiPost('/api/skip-question', {
reveal: false
});
};

$('btn-next-ready').onclick = function () {
apiPost('/api/next-ready', {});
};

$('btn-new-round-fin').onclick = function () {
apiPost('/api/new-round', {});
};

$('btn-undo').onclick = function () {
apiPost('/api/undo', {});
};

$('btn-new-round-live').onclick = function () {
withConfirm(this, 'new_round', function () {
apiPost('/api/new-round', {});
});
};

$('btn-switch-room-live').onclick = function () {
activeView = 'live';
apiPost('/api/leave-room', {});
};

$('mode-teams-btn').onclick = function () {
apiPost('/api/settings', {
gameMode: 'teams'
});
};

$('mode-coop-btn').onclick = function () {
apiPost('/api/settings', {
gameMode: 'coop'
});
};

$('btn-order-random').onclick = function () {
apiPost('/api/settings', {
isRandomOrder: true
});
};

$('btn-order-seq').onclick = function () {
apiPost('/api/settings', {
isRandomOrder: false
});
};

$('btn-tv-q-on').onclick = function () {
apiPost('/api/settings', {
showQuestionOnTv: true
});
};

$('btn-tv-q-off').onclick = function () {
apiPost('/api/settings', {
showQuestionOnTv: false
});
};

$('btn-bonus-on').onclick = function () {
apiPost('/api/settings', {
neighborBonus: true
});
};

$('btn-bonus-off').onclick = function () {
apiPost('/api/settings', {
neighborBonus: false
});
};

$('btn-reset-asked').onclick = function () {
apiPost('/api/reset-asked', {});
};

$('btn-download-pack').onclick = function () {
var file =
(state &&
state.room &&
state.room.packFile) ||
'christmas_uk.txt';
window.location.href =
'/api/download-pack?file=' +
encodeURIComponent(file);
};

$('btn-upload-pack').onclick = function () {
$('input-upload-pack').click();
};

$('input-upload-pack').onchange = function () {
var f =
this.files && this.files[0];
if (!f) return;
var reader = new FileReader();
reader.onload = function (ev) {
apiPost('/api/upload-pack', {
fileName: f.name,
content: ev.target.result
});
};
reader.readAsText(f);
this.value = '';
};

$('btn-rename-room').onclick = function () {
var nm = $('input-rename-room').value.trim();
if (!nm) return;
$('input-rename-room').value = '';
apiPost('/api/rename-room', { name: nm });
};

$('btn-delete-room').onclick = function () {
if (!state || !state.room) return;
var rid = state.room.id;
withConfirm(
this,
'btn-delete-room',
function () {
activeView = 'live';
apiPost('/api/delete-room', {
roomId: rid
});
}
);
};

$('btn-export-json').onclick = function () {
window.location.href = '/api/export-json';
};

$('btn-import-json').onclick = function () {
$('input-import-json').click();
};

$('input-import-json').onchange = function () {
var f =
this.files && this.files[0];
if (!f) return;
var reader = new FileReader();
reader.onload = function (ev) {
try {
var data = JSON.parse(ev.target.result);
apiPost('/api/import-json', { data: data });
} catch (e) {
showError('Invalid JSON');
}
};
reader.readAsText(f);
this.value = '';
};
}

// poll state every 1200ms while open
// keeps tv and host remote synchronized
function poll() {
apiGet('/api/state', function (res) {
state = res;
render();
});
}

bindEvents();
loadCountries();
loadPackQuestions();
apiGet('/api/ip', function (info) {
if (info && info.ip) {
$('host-url-text').innerHTML =
'http://' + info.ip + ':' + info.port;
}
});
poll();
setInterval(poll, 1200);
})();
