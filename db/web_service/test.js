var http = require('http');
var qs = require('querystring');

var data = {
    'licensenumber': 'AAA3333',
    'timestamp': '2019-09-09 16:12:12'
};
var content = qs.stringify(data);

var options = {
    hostname: 'localhost',
    port: 8090,
    path: '/parkingInfo?' + content,
    method: 'DELETE'
};


let result = '';
http.get(options, function(req, res){
    req.on('data', function(data){
        result += data;
    })
    req.on('end', function(){
        let obj2 = JSON.parse(result);
        console.log(obj2);
    });
});
