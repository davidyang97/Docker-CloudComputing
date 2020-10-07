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
  contactPoints: ['parking-lot-db'],
  localDataCenter: 'datacenter1',
  keyspace: 'parkingLot'
});

var typeMapping = new Map();
typeMapping['car'] = 'green';
typeMapping['truck'] = 'orange';
typeMapping['bus'] = 'orange';
typeMapping['motorcycle'] = 'blue';

var price = 2;

var running = false;

app.get("/parkingInfo", function(req, res) {
  if(!running) {
    res.status(500).send("waiting for database");
    return;
  }

  const query = 'select * from parkingInfo';
  const param = [];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    console.log('Result: ', result.rows);
    res.status(200).send(result.rows);
  })  
})

app.post("/parkingInfo", function(req, res) {
  if(!running) {
    res.status(500).send("waiting for database");
    return;
  }

  let jsonStr;
  if(req.body)
  {
      console.log(req.body);
      jsonStr = req.body;
  }
  else
  {
      res.status(400).send("Error Body Param");
      return;
  }

  const query = 'insert into parkingLog (licenseNumber, vehicleType, enterOrExitTime, enterOrExit, parkingSlotType) values (?, ?, ?, ?, ?)';
  let param = [jsonStr.licenseNumber, jsonStr.vehicleType, jsonStr.timeStamp, 0, typeMapping[jsonStr.vehicleType]];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    console.log('Result: ', result);
    let parkingSlotType = {'parkingSlotType': typeMapping[jsonStr.vehicleType]};
    res.status(200).send(parkingSlotType);
  })  
})

app.delete("/parkingInfo", function(res, req){
  if(!running) {
    res.status(500).send("waiting for database");
    return;
  }

  // select the start time and the vehicle type
  const selectQuery = "select * from parkingLog where licenseNumber = ? and enterOrExit = 0 order by enterOrExitTime desc limit 1 allow filtering";
  let selectParam = [res.query.licenseNumber];

  client.execute(selectQuery, selectParam, { prepare: true })
  .then(function(selectResult) {
    console.log('Result: ', selectResult.rows);
    let startTime = Date.parse(selectResult.rows[0].enterOrExitTime);
    let endTime = Date.parse(res.query.timeStamp);
    let parkingFee = (endTime - startTime) / (3600.0 * 1000) * price;
    let parkingSlotType = selectResult.rows[0].parkingSlotType; // avoid inconsistency in case the map is modified
    let vehicleType = selectResult.rows[0].vehicleType;

    // insert the leaving log to db
    const insertQuery = 'insert into parkingLog (licenseNumber, vehicleType, enterOrExitTime,  enterOrExit, parkingSlotType) values (?, ?, ?, ?, ?)';
    let insertParam = [res.query.licenseNumber, vehicleType, res.query.timeStamp, 1, parkingSlotType];

    client.execute(insertQuery, insertParam, { prepare: true })
    .then(function(insertResult) {
      console.log('InsertResult: ', insertResult);

      // delete the vehicle info in current parkingLot snapshot
      const deleteQuery = 'delete from parkingInfo where licenseNumber = ?'
      let deleteParam = [res.query.licenseNumber];
        client.execute(deleteQuery, deleteParam, { prepare: true })
      .then(function(deleteResult) {
        console.log('DeleteResult: ', deleteResult);
        let parkingFeeObj = {'parkingFee': parkingFee};
        res.status(200).send(parkingFeeObj);
      }) 
    })

  })  

})

app.listen(8090, function(){
    console.log("address is localhost:8090");
    do {
      let result = await client.execute('SELECT now() FROM system.local;', []);
      if(result.rows) {
        running = true;
        console.log(result.rows[0]);
      }
      else {
        setTimeout(function() {
          ;
      }, (3 * 100));
      }
    }while(!running);
})
 
