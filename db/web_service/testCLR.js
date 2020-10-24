var http = require('http');
var qs = require('querystring');

var data = {
    'parking_lot_id': '0'
};
var content = qs.stringify(data);

var options = {
    hostname: 'localhost',
    port: 8090,
    path: '/clr',
    method: 'DELETE'
};


let result = '';
http.get(options, function(req, res){
    req.on('data', function(data){
        result += data;
    })
    req.on('end', function(){
        console.log(result);
    });
});

