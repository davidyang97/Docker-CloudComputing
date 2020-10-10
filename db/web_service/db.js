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

var client = new cassandra.Client({
  contactPoints: ['parking-lot-db'],
  localDataCenter: 'datacenter1',
  //keyspace: 'parkinglot'
});

var typeMapping = new Map();
typeMapping['car'] = 'green';
typeMapping['truck'] = 'orange';
typeMapping['bus'] = 'orange';
typeMapping['motorcycle'] = 'blue';

var price = 2;

var running = false;

var ready = false;

var retry = 20;

var retryInterval = 5;

app.get("/is-alive", function(req, res){
  let resObj = {'alive': running};
  res.send(resObj);
})

app.get("/parkingInfo", function(req, res) {
  if(!running || !ready) {
    res.status(500).send("waiting for database");
    return;
  }

  console.log("GET: /parkingInfo \n");
  const query = 'select * from parkingInfo';
  const param = [];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    console.log('Result: ', result.rows);
    res.status(200).send(result.rows);
  })  
})

app.post("/parkingInfo", function(req, res) {
  if(!running || !ready) {
    res.status(500).send("waiting for database");
    return;
  }

  

  let jsonStr;
  if(req.body)
  {
      console.log("POST: /parkingInfo \n", req.body);
      jsonStr = req.body;
  }
  else
  {
      res.status(400).send("Error Body Param");
      return;
  }

  const query = 'insert into parkingLog (licenseNumber, vehicleType, enterOrExitTime, enterOrExit, parkingSlotType) values (?, ?, ?, ?, ?)';
  let param = [jsonStr.licensenumber, jsonStr.vehicletype, jsonStr.timestamp, 0, typeMapping[jsonStr.vehicletype]];

  client.execute(query, param, { prepare: true })
  .then(function(result) {
    //console.log('Result: ', result);

    const query = 'insert into parkingInfo (licenseNumber, parkingSlotType) values (?, ?)';
    let param = [jsonStr.licensenumber, typeMapping[jsonStr.vehicletype]];

    client.execute(query, param, { prepare: true })
    .then(function(result) {

      let parkingSlotType = {'parkingslottype': typeMapping[jsonStr.vehicletype]};
      res.status(200).send(parkingSlotType);
    })
  })  
})

app.delete("/parkingInfo", function(req, res){
  if(!running || !ready) {
    req.status(500).send("waiting for database");
    return;
  }

  console.log("DELETE: /parkingInfo \n", req.query);

  if(req.query.licensenumber == null || req.query.timestamp == null) {
    res.status(400).send("missing parameter");
    return;
  }

  // select the start time and the vehicle type
  const selectQuery = "select * from parkingLog where licenseNumber = ? and enterOrExit = 0 order by enterOrExitTime desc limit 1 allow filtering";
  let selectParam = [req.query.licensenumber];

  client.execute(selectQuery, selectParam, { prepare: true })
  .then(function(selectResult) {
    console.log('Result: ', selectResult.rows);
    let startTime = Date.parse(selectResult.rows[0].enterorexittime);
    let endTime = Date.parse(req.query.timestamp);
    console.log("startTime:", startTime);
    console.log("endTIme:", endTime);
    var parkingFee = (endTime - startTime) / (3600 * 1000) * price;
    console.log("parkingFee:", parkingFee);
    let parkingSlotType = selectResult.rows[0].parkingslottype; // avoid inconsistency in case the map is modified
    let vehicleType = selectResult.rows[0].vehicletype;

    // insert the leaving log to db
    const insertQuery = 'insert into parkingLog (licenseNumber, vehicleType, enterOrExitTime,  enterOrExit, parkingSlotType) values (?, ?, ?, ?, ?)';
    let insertParam = [req.query.licensenumber, vehicleType, req.query.timestamp, 1, parkingSlotType];

    client.execute(insertQuery, insertParam, { prepare: true })
    .then(function(insertResult) {
      console.log('InsertResult: ', insertResult);

      // delete the vehicle info in current parkingLot snapshot
      const deleteQuery = 'delete from parkingInfo where licenseNumber = ?'
      let deleteParam = [req.query.licensenumber];
        client.execute(deleteQuery, deleteParam, { prepare: true })
      .then(function(deleteResult) {
        console.log('DeleteResult: ', deleteResult);
        let parkingFeeObj = {'parkingfee': parkingFee};
        res.status(200).send(parkingFeeObj);
      }) 
    })

  })  

})

function retryConnect() {	
	client.connect()
	//client.execute('SELECT cql_version FROM system.local;', [])
  .then(function() {
		console.log("DB connection succeeded");
		running = true;
		
  })
	.catch(function(err){
		client = new cassandra.Client({
  			contactPoints: ['parking-lot-db'],
			  localDataCenter: 'datacenter1',
		});
		//console.error(err);
		console.log("DB connection failed");
		retry--;
		//client.shutdown();
    setTimeout(function() {
			if(retry > 0) retryConnect();
			else {
				console.log("DB connection failed for too many times");
				console.log("Process exit");
				process.exit();
			}
    }, (retryInterval * 1000));
	});
	
}

app.listen(8090, function(){
    console.log("address is localhost:8090");
    process.on('SIGINT', function() {
	  console.log("Caught interrupt signal");
        process.exit();
    });
    retryConnect();

    const createKeySpace = "CREATE KEYSPACE IF NOT EXISTS parkingLot WITH REPLICATION = {'class': 'SimpleStrategy','replication_factor':1};USE parkingLot;"

    const createParkingLog = " CREATE TABLE IF NOT EXISTS parkingLog( \
    licenseNumber varchar, \
    vehicleType varchar, \
    enterOrExitTime timestamp, \
    enterOrExit int, \
    parkingSlotType varchar, \
    PRIMARY KEY ((licenseNumber), enterOrExitTime));"

    const createParkingInfo = "CREATE TABLE IF NOT EXISTS parkingInfo( \
      licenseNumber varchar, \
      parkingSlotType varchar, \
      PRIMARY KEY (licenseNumber));"

    client.execute(createKeySpace + createParkingLog + createParkingInfo, [])
    .then(function() {
      ready = true;
    })
    .catch(function(err) {
      console.log(err)
    })
})
 
