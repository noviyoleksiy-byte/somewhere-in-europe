// question pack parser and loader
// reads txt packs with optional part 2
var fs = require('fs');
var path = require('path');

var PACKS_DIR = path.join(
__dirname,
'..',
'data',
'packs'
);

// make packs directory if missing
// avoids crash on custom pack upload
function ensurePacksDir() {
if (!fs.existsSync(PACKS_DIR)) {
fs.mkdirSync(PACKS_DIR, {
recursive: true
});
}
}

// trim blank lines around text block
// preserves internal line breaks
function trimBlock(lines) {
var start = 0;
var end = lines.length;
while (
start < end &&
lines[start].trim() === ''
) {
start += 1;
}
while (
end > start &&
lines[end - 1].trim() === ''
) {
end -= 1;
}
return lines
.slice(start, end)
.join('\n');
}

// build one question object from lines
// splits part 1, optional part 2, answer
function buildQuestion(num, country, lines) {
var sepAns = lines.indexOf('---');
var bodyLines =
sepAns === -1
? lines
: lines.slice(0, sepAns);
var ansLines =
sepAns === -1
? []
: lines.slice(sepAns + 1);
var sepPart2 = bodyLines.indexOf('+++');
var part1Lines =
sepPart2 === -1
? bodyLines
: bodyLines.slice(0, sepPart2);
var part2Lines =
sepPart2 === -1
? []
: bodyLines.slice(sepPart2 + 1);
var part1 = trimBlock(part1Lines);
var part2 = trimBlock(part2Lines);
var answer = trimBlock(ansLines);
return {
number: num,
country: String(country || '').toUpperCase(),
part1: part1,
part2: part2,
hasPart2: part2.length > 0,
answerText: answer
};
}

// parse raw txt content into questions
// matches #number [CODE] header lines
function parseQuestionsText(raw) {
var lines = String(raw || '').split(/\r?\n/);
var list = [];
var curNum = null;
var curCountry = '';
var curLines = [];
var re = /^#(\d+)\s*\[([A-Za-z]{2})\]\s*$/;
for (var i = 0; i < lines.length; i++) {
var line = lines[i];
var m = re.exec(line.trim());
if (m) {
if (curNum !== null) {
list.push(
buildQuestion(
curNum,
curCountry,
curLines
)
);
}
curNum = parseInt(m[1], 10);
curCountry = m[2].toUpperCase();
curLines = [];
} else if (curNum !== null) {
curLines.push(line);
}
}
if (curNum !== null) {
list.push(
buildQuestion(
curNum,
curCountry,
curLines
)
);
}
return list;
}

// load a single pack file by name
// returns parsed question list
function loadPackByFile(fileName) {
ensurePacksDir();
var safeName = path.basename(
String(fileName || 'christmas_uk.txt')
);
var fullPath = path.join(
PACKS_DIR,
safeName
);
if (!fs.existsSync(fullPath)) {
return {
fileName: safeName,
list: []
};
}
var raw = fs.readFileSync(
fullPath,
'utf8'
);
return {
fileName: safeName,
list: parseQuestionsText(raw)
};
}

// save uploaded custom txt pack to disk
// validates parsed question count first
function savePackFile(fileName, rawContent) {
ensurePacksDir();
var cleanName = path
.basename(String(fileName || 'custom.txt'))
.replace(/[^a-zA-Z0-9._-]/g, '_');
if (!/\.txt$/i.test(cleanName)) {
cleanName += '.txt';
}
var parsed = parseQuestionsText(rawContent);
if (parsed.length === 0) {
throw new Error(
'No valid #N [CC] questions found'
);
}
var fullPath = path.join(
PACKS_DIR,
cleanName
);
fs.writeFileSync(
fullPath,
String(rawContent),
'utf8'
);
return {
fileName: cleanName,
count: parsed.length
};
}

// list all available txt packs
// includes built-in labels and counts
function listAvailablePacks() {
ensurePacksDir();
var labels = {
'christmas_uk.txt': {
uk: 'Різдвяні традиції Європи (UA)',
en: 'Christmas Traditions in Europe (UA)',
category: 'christmas',
lang: 'uk'
},
'christmas_en.txt': {
uk: 'Різдвяні традиції Європи (EN)',
en: 'Christmas Traditions in Europe (EN)',
category: 'christmas',
lang: 'en'
},
'kids_uk.txt': {
uk: 'Дитячий квіз: Казки та дива (UA)',
en: 'Kids Quiz: Tales & Wonders (UA)',
category: 'kids',
lang: 'uk'
},
'kids_en.txt': {
uk: 'Дитячий квіз: Казки та дива (EN)',
en: 'Kids Quiz: Tales & Wonders (EN)',
category: 'kids',
lang: 'en'
},
'general_uk.txt': {
uk: 'Європа: Культура та факти (UA)',
en: 'Europe: Culture & Facts (UA)',
category: 'general',
lang: 'uk'
},
'general_en.txt': {
uk: 'Європа: Культура та факти (EN)',
en: 'Europe: Culture & Facts (EN)',
category: 'general',
lang: 'en'
}
};
var files = fs.readdirSync(PACKS_DIR);
var out = [];
for (var i = 0; i < files.length; i++) {
var f = files[i];
if (!/\.txt$/i.test(f)) {
continue;
}
var pack = loadPackByFile(f);
var meta = labels[f] || {
uk: f,
en: f,
category: 'custom',
lang: 'uk'
};
out.push({
file: f,
labelUk: meta.uk,
labelEn: meta.en,
category: meta.category,
lang: meta.lang,
count: pack.list.length
});
}
var order = [
'christmas_uk.txt',
'christmas_en.txt',
'kids_uk.txt',
'kids_en.txt',
'general_uk.txt',
'general_en.txt'
];
out.sort(function (a, b) {
var ia = order.indexOf(a.file);
var ib = order.indexOf(b.file);
if (ia !== -1 && ib !== -1) {
return ia - ib;
}
if (ia !== -1) return -1;
if (ib !== -1) return 1;
return a.file.localeCompare(b.file);
});
return out;
}

// build randomized or ordered id queue
// filters out already asked questions
function buildQueue(list, askedNums, isRandom) {
var askedSet = {};
for (var i = 0; i < askedNums.length; i++) {
askedSet[askedNums[i]] = true;
}
var queue = [];
for (var j = 0; j < list.length; j++) {
if (!askedSet[list[j].number]) {
queue.push(list[j].number);
}
}
if (isRandom) {
for (var k = queue.length - 1; k > 0; k--) {
var r = Math.floor(Math.random() * (k + 1));
var tmp = queue[k];
queue[k] = queue[r];
queue[r] = tmp;
}
}
return queue;
}

module.exports = {
parseQuestionsText: parseQuestionsText,
loadPackByFile: loadPackByFile,
savePackFile: savePackFile,
listAvailablePacks: listAvailablePacks,
buildQueue: buildQueue
};
