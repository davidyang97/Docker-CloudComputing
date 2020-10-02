const cassandra = require('cassandra-driver');
var express = require('express');
var app = express();

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
  if(req.body.data)
  {
      console.log(req.body.data);
      jsonStr = req.body.data;
  }

  const query = 'insert into users (id, user_name) values (?, ?)';
  const param = [jsonStr.id, jsonStr.user_name];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    console.log('Result: ', result);
    res.send(result);
  })  
})

app.listen(8081, function(){
    console.log("address is localhost:8081");
})
 
