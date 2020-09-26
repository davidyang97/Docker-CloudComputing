const cassandra = require('cassandra-driver');
var express = require('express');
var app = express();

app.get("/cassandra/v1", function(req, res) {
  if(req.query.id == null) {
    console.log("Parameter Error! Missing 'id'!");
    res.send("Parameter Error! Missing 'id'!");
    return;
}

  const client = new cassandra.Client({
    contactPoints: ['10.176.67.88:9042'],
    localDataCenter: 'datacenter1',
    keyspace: 'pimin_net'
  });

  const query = 'select * from users where id = ?';
  const param = [req.query.id];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    console.log('Result: ', result.rows);
    res.send(result.rows);
  })  
})

app.listen(8081, function(){
    console.log("address is localhost:8081");
})
 
