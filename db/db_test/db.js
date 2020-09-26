const cassandra = require('cassandra-driver');
var express = require('express');
var app = express();

app.get("/cassandra/v1", function(req, res) {
  if(req.query.keyspace == null) {
      console.log("Parameter Error! Missing 'keyspace'!");
      res.send("Parameter Error! Missing 'keyspace'!");
      return;
  }

  if(req.query.id == null) {
    console.log("Parameter Error! Missing 'id'!");
    res.send("Parameter Error! Missing 'id'!");
    return;
}

  const client = new cassandra.Client({
    contactPoints: ['10.176.67.88:9042'],
    localDataCenter: 'datacenter1',
    keyspace: req.query.keyspace
  });

  const query = 'select * from users where id = ?';
  const param = [req.query.id];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    console.log('Result: ', result);
    res.send(result);
  }  
})
 
