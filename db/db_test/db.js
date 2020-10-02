const cassandra = require('cassandra-driver');
var express = require('express');
var app = express();

var cors = require('cors');

app.use(cors());

var bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '1mb'}));  
app.use(bodyParser.urlencoded({           
  extended: true
}));

const client = new cassandra.Client({
  contactPoints: ['cassandra-test'],
  localDataCenter: 'datacenter1',
  keyspace: 'pimin_net'
});

app.get("/cassandra/v1", function(req, res) {
  if(req.query.id == null) {
    console.log("Parameter Error! Missing 'id'!");
    res.send("Parameter Error! Missing 'id'!");
    return;
  } 

  const query = 'select * from users where id = ?';
  const param = [req.query.id];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    console.log('Result: ', result.rows);
    res.send(result.rows);
  })  
})

app.post("/cassandra/v1", function(req, res) {
  var jsonStr;
  if(req.body)
  {
      console.log(req.body);
      jsonStr = req.body;
  }
  else
  {
	res.send("Error Body Param");
	return;
  }

  const query = 'insert into users (id, user_name) values (?, ?)';
  const param = [jsonStr.id, jsonStr.user_name];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    console.log('Result: ', result);
    res.status(200).send("OK");
  })  
})

app.listen(8090, function(){
    console.log("address is localhost:8081");
})
 
