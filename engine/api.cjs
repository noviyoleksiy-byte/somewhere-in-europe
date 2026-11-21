// express api routes for tv and phone
// maps http calls to game engine
var express = require('express');
var os = require('os');
var path = require('path');
var game = require('./game.cjs');
var europe = require('./europe.cjs');
var questions = require('./questions.cjs');

var router = express.Router();

// find local wifi ipv4 address
// helps host open tv url on lan
function getLocalIp() {
var nets = os.networkInterfaces();
for (var name in nets) {
if (!nets.hasOwnProperty(name)) {
continue;
}
var list = nets[name];
for (var i = 0; i < list.length; i++) {
var net = list[i];
if (
net.family === 'IPv4' &&
!net.internal
) {
return net.address;
}
}
}
return '127.0.0.1';
}

// wrap action handler with json reply
// returns updated state on every call
function runAction(fn) {
return function (req, res) {
try {
fn(req, res);
res.json({
ok: true,
state: game.getPublicState()
});
} catch (err) {
res.status(400).json({
ok: false,
error: err.message || 'Action error'
});
}
};
}

// send current full state to clients
// polled periodically by tv and phone
router.get('/api/state', function (req, res) {
res.json(game.getPublicState());
});

// send local lan ip and port
// displayed in host top bar
router.get('/api/ip', function (req, res) {
res.json({
ip: getLocalIp(),
port: process.env.PORT || 3000
});
});

// send country directory list
// used by phone distance hint picker
router.get('/api/countries', function (req, res) {
res.json({
ok: true,
countries: europe.listCountries()
});
});

// send full question list of active pack
// lets host pick a specific country
router.get('/api/pack-questions', function (req, res) {
var state = game.getPublicState();
var file =
(req.query && req.query.file) ||
(state.room && state.room.packFile) ||
'christmas_uk.txt';
var pack = questions.loadPackByFile(file);
res.json({
ok: true,
fileName: pack.fileName,
questions: pack.list
});
});

// download raw txt pack or template
// sends attachment header for browser
router.get('/api/download-pack', function (req, res) {
var file =
(req.query && req.query.file) ||
'christmas_uk.txt';
var safe = path.basename(String(file));
var full = questions.resolvePackPath(safe);
if (!full) {
res.status(404).send('Pack not found');
return;
}
res.download(full, safe);
});

// upload custom txt question pack
// saves file and selects it in room
router.post(
'/api/upload-pack',
function (req, res) {
try {
var body = req.body || {};
var saved = questions.savePackFile(
body.fileName,
body.content
);
var st = game.getPublicState();
if (st.room) {
game.updateSettings({
packFile: saved.fileName
});
}
res.json({
ok: true,
saved: saved,
state: game.getPublicState()
});
} catch (err) {
res.status(400).json({
ok: false,
error: err.message
});
}
}
);

router.post(
'/api/create-room',
runAction(function (req) {
var b = req.body || {};
game.createRoom(b.name, b.lang, b.theme);
})
);

router.post(
'/api/select-room',
runAction(function (req) {
game.selectRoom(req.body.roomId);
})
);

router.post(
'/api/leave-room',
runAction(function () {
game.leaveRoom();
})
);

router.post(
'/api/delete-room',
runAction(function (req) {
game.deleteRoom(req.body.roomId);
})
);

router.post(
'/api/rename-room',
runAction(function (req) {
game.renameRoom(req.body.name);
})
);

router.post(
'/api/settings',
runAction(function (req) {
game.updateSettings(req.body || {});
})
);

router.post(
'/api/add-team',
runAction(function (req) {
game.addTeam(req.body.name);
})
);

router.post(
'/api/remove-team',
runAction(function (req) {
game.removeTeam(req.body.teamId);
})
);

router.post(
'/api/set-active-team',
runAction(function (req) {
game.setActiveTeam(req.body.teamId);
})
);

router.post(
'/api/adjust-score',
runAction(function (req) {
game.adjustScore(
req.body.teamId,
req.body.delta
);
})
);

router.post(
'/api/start-tv',
runAction(function () {
game.startSessionOnTv();
})
);

router.post(
'/api/new-round',
runAction(function () {
game.startNewRound();
})
);

router.post(
'/api/reset-asked',
runAction(function () {
game.resetAskedHistory();
})
);

router.post(
'/api/draw-question',
runAction(function (req) {
game.drawNextQuestion(
req.body && req.body.number
);
})
);

router.post(
'/api/wrong-answer',
runAction(function (req) {
game.recordWrongAnswer(
Boolean(req.body && req.body.advanceTurn)
);
})
);

router.post(
'/api/distance-hint',
runAction(function (req) {
var b = req.body || {};
game.giveDistanceHint(
b.guessedCode,
b.manualTier
);
})
);

router.post(
'/api/reveal-part2',
runAction(function () {
game.revealPart2();
})
);

router.post(
'/api/correct-answer',
runAction(function (req) {
game.recordCorrectAnswer(
req.body && req.body.teamId
);
})
);

router.post(
'/api/skip-question',
runAction(function (req) {
game.skipQuestion(
Boolean(req.body && req.body.reveal)
);
})
);

router.post(
'/api/next-ready',
runAction(function () {
game.nextReady();
})
);

router.post(
'/api/finish-round',
runAction(function (req) {
game.finishRound(
req.body && req.body.teamLabel
);
})
);

router.post(
'/api/undo',
runAction(function () {
game.undoLast();
})
);

router.get('/api/export-json', function (req, res) {
var data = game.exportAll();
res.setHeader(
'Content-Type',
'application/json; charset=utf-8'
);
res.setHeader(
'Content-Disposition',
'attachment; filename="europe-quiz-backup.json"'
);
res.send(JSON.stringify(data, null, 2));
});

router.post(
'/api/import-json',
runAction(function (req) {
var b = req.body || {};
game.importAll(b.data ? b.data : b);
})
);

module.exports = router;
