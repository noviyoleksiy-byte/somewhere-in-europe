// commonjs server entry for android apk
// runs same api and static public dir
var express = require('express');
var path = require('path');
var api = require('./engine/api.cjs');

var PORT = Number(process.env.PORT) || 3000;
var app = express();

app.use(express.json({ limit: '5mb' }));

// serve mobile controller on /host
// points directly to public phone page
app.get('/host', function (req, res) {
res.sendFile(
path.join(__dirname, 'public', 'phone.html')
);
});

app.use(
express.static(
path.join(__dirname, 'public')
)
);
app.use(api);

app.listen(PORT, '0.0.0.0', function () {
console.log(
'Somewhere in Europe server on :' + PORT
);
});
