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
  keyspace: 'parkinglot'
});

var typeMapping = new Map();
typeMapping['car'] = 'green';
typeMapping['truck'] = 'orange';
typeMapping['bus'] = 'orange';
typeMapping['motorcycle'] = 'blue';

var paramMapping = new Map();
paramMapping['licensenumber'] = 'plate';
paramMapping['vehicletype'] = 'vtype';
paramMapping['timestamp'] = 'timestamp';

var price = 2;

var running = false;

var ready = true;

var retry = 20;

var retryInterval = 5;

var enableLog = 0;


// send alive msg to workflow manager
app.get("/is-alive", function(req, res){
  let resObj = {'alive': running};
  res.send(resObj);
})


// set log level
app.get("/setEnableLog", function(req, res) {
  if(req.query.log != null) {
    enableLog = req.query.log;
  }
  res.status(200).send("OK");
})

// insert vehicle info into db when entering parking lot
async function insertObj(jsonStr) {

  var parkingLog_name;
  var parkingInfo_name;
  if(jsonStr.parking_lot_id) {
    parkingLog_name = 'parkingLog_' + jsonStr.parking_lot_id;
    parkingInfo_name = 'parkingInfo_' + jsonStr.parking_lot_id;
  }
  else {
    parkingLog_name = 'parkingLog';
    parkingInfo_name = 'parkingInfo';
  }

  const create_parkingLog = 'CREATE TABLE IF NOT EXISTS ' + parkingLog_name + ' (licenseNumber varchar, vehicleType varchar, enterOrExitTime timestamp, enterOrExit int, parkingSlotType varchar, PRIMARY KEY ((licenseNumber), enterOrExitTime));';
  const create_parkingInfo = "CREATE TABLE IF NOT EXISTS " + parkingInfo_name + " (licenseNumber varchar, parkingSlotType varchar, PRIMARY KEY (licenseNumber));";
  const result1 = await client.execute(create_parkingLog, [], { prepare: true });
  if(enableLog == 2)console.log('Result1: ', result1);
  const result2 = await client.execute(create_parkingInfo, [], { prepare: true });
  if(enableLog == 2)console.log('Result2: ', result2);

  const log_query = 'insert into ' + parkingLog_name + ' (licenseNumber, vehicleType, enterOrExitTime, enterOrExit, parkingSlotType) values (?, ?, ?, ?, ?)';
  let log_param = [jsonStr.licensenumber, jsonStr.vehicletype, jsonStr.timestamp, 0, typeMapping[jsonStr.vehicletype]];

  const result3 = await client.execute(log_query, log_param, { prepare: true });
  if(enableLog == 2)console.log('Result3: ', result3);

  const lot_query = 'insert into ' + parkingInfo_name  + ' (licenseNumber, parkingSlotType) values (?, ?)';
  let lot_param = [jsonStr.licensenumber, typeMapping[jsonStr.vehicletype]];

  const result4 = await client.execute(lot_query, lot_param, { prepare: true });
  if(enableLog == 2)console.log('Result4: ', result4);

  let parkingSlotType = {'parkingslottype': typeMapping[jsonStr.vehicletype]};

  return parkingSlotType;

}


// delete vehicle info when exiting parking lot
async function deleteObj(licensenumber, timestamp, parking_lot_id) {

  var parkingLog_name;
  var parkingInfo_name;
  if(parking_lot_id) {
    parkingLog_name = 'parkingLog_' + parking_lot_id;
    parkingInfo_name = 'parkingInfo_' + parking_lot_id;
  }
  else {
    parkingLog_name = 'parkingLog';
    parkingInfo_name = 'parkingInfo';
  }

  // select the start time and the vehicle type
  const selectQuery = "select * from " + parkingLog_name + " where licenseNumber = ? and enterOrExit = 0 order by enterOrExitTime desc limit 1 allow filtering";
  let selectParam = [licensenumber];
  const selectResult = await client.execute(selectQuery, selectParam, { prepare: true });
  if(enableLog >= 1)console.log('Result: ', selectResult.rows);

  // calculate the start time and end time of the parking
  let startTime = Date.parse(selectResult.rows[0].enterorexittime);
  let endTime = Date.parse(timestamp);
  console.log("startTime:", startTime);
  console.log("endTIme:", endTime);

  // calculate the parking fee
  var parkingFee = (endTime - startTime) / (3600 * 1000) * price;
  console.log("parkingFee:", parkingFee);

  let parkingSlotType = selectResult.rows[0].parkingslottype; // avoid inconsistency in case the map is modified
  let vehicleType = selectResult.rows[0].vehicletype;

  // log the exiting information
  const insertQuery = 'insert into ' + parkingLog_name + ' (licenseNumber, vehicleType, enterOrExitTime,  enterOrExit, parkingSlotType) values (?, ?, ?, ?, ?)';
  let insertParam = [licensenumber, vehicleType, timestamp, 1, parkingSlotType];
  const insertResult = await client.execute(insertQuery, insertParam, { prepare: true });
  if(enableLog == 2)console.log('InsertResult: ', insertResult);

  // delete the vehicle from the snapshot
  const deleteQuery = 'delete from ' + parkingInfo_name + ' where licenseNumber = ?'
  let deleteParam = [licensenumber];
  const deleteResult = await client.execute(deleteQuery, deleteParam, { prepare: true });
  if(enableLog == 2)console.log('DeleteResult: ', deleteResult);

  let parkingFeeObj = {'parkingfee': parkingFee};

  return parkingFeeObj;
}


// get parking lot snapshot
async function getObj(parking_lot_id) {

  let parkingInfo_name;
  if(parking_lot_id) {
    parkingInfo_name = 'parkingInfo_' + parking_lot_id;
  }
  else {
    parkingInfo_name = 'parkingInfo';
  }

  const query = 'select * from ' + parkingInfo_name;
  const param = [];

  const resObj = await client.execute(query, param, { prepare: true });
  if(enableLog == 2)console.log(resObj);
  return resObj;

}



app.get("/parkingInfo", async function(req, res) {
  if(!running || !ready) {
    res.status(500).send("waiting for database");
    return;
  }

  console.log("GET: /parkingInfo \n");
  const resObj =  await getObj(req.query.parking_lot_id); 
  if(enableLog >= 1)console.log('Result: ', resObj.rows);
  res.status(200).send(resObj.rows);
})



app.post("/parkingInfo", async function(req, res) {
  if(!running || !ready) {
    res.status(500).send("waiting for database");
    return;
  }

  let jsonStr;
  if(req.body)
  {
      console.log("POST: /parkingInfo \n", req.body);
      jsonStr = req.body;
      if(enableLog == 2)console.log(jsonStr);
  }
  else
  {
      res.status(400).send("Body Param Error!");
      return;
  }

  const parkingSlotType = await insertObj(jsonStr);

  res.status(200).send(parkingSlotType);
})



app.delete("/parkingInfo", async function(req, res){
  if(!running || !ready) {
    req.status(500).send("waiting for database");
    return;
  }

  console.log("DELETE: /parkingInfo \n", req.query);

  if(req.query.licensenumber == null || req.query.timestamp == null) {
    res.status(400).send("missing parameter");
    return;
  }

  let parkingFeeObj = await deleteObj(req.query.licensenumber, req.query.timestamp, req.query.parking_lot_id);

  res.status(200).send(parkingFeeObj);

})


app.post("/process", async function(req, res) {
  if(!running || !ready) {
    req.status(500).send("waiting for database");
    return;
  }

  let jsonStr;
  if(req.body)
  {
      console.log("POST: /process \n");
      jsonStr = req.body;
      if(enableLog == 2)console.log(jsonStr);
  }
  else
  {
      res.status(400).send("Body Param Error!");
      return;
  }

  if(jsonStr.parking_lot_id == null) {
    res.status(400).send("Missing parking_lot_id!");
    return;
  }

  if(jsonStr.db_behavior != null && jsonStr.licensenumber != null && jsonStr.vehicletype != null && jsonStr.timestamp != null) {
    if(jsonStr.db_behavior == true) {
      const insert_result = await insertObj(jsonStr);
      jsonStr.parkingslottype = insert_result.parkingslottype;
    }
    else {
      const delete_result = await deleteObj(jsonStr.licensenumber, jsonStr.timestamp, jsonStr.parking_lot_id);
      jsonStr.parkingfee = delete_result.parkingfee;
    }
  }

  const result = await getObj(jsonStr.parking_lot_id);
  jsonStr.snapshot = result.rows;
  jsonStr.DB_success = true;
  res.status(200).send(jsonStr);
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
        keyspace: 'parkinglot'
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
})
 
