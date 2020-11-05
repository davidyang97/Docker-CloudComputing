const cassandra = require('cassandra-driver');
const { types } = cassandra;

var express = require('express');
var app = express();

var cors = require('cors');

app.use(cors());

var bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '1mb'}));  
app.use(bodyParser.urlencoded({           
  extended: true
}));

var client;

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

app.delete("/clr", async function(req, res) {
  if(req.query.parking_lot_id) {
    const parkingInfo_name = "parkingInfo_" + req.query.parking_lot_id;
    const parkingLog_name = "parkingLog_" + req.query.parking_lot_id;
    const query1 = "truncate " + parkingInfo_name; 
    const query2 = "truncate " + parkingLog_name;

    await client.execute(query1, []);
    await client.execute(query2, []);

    console.log("Clr:", req.query.parking_lot_id);
    res.status(200).send('OK');
  }
  else {
    //const query = "DESCRIBE tables";
    //const result = await client.execute(query, []);
    //const tables = result.rows;
    /*const tables = await client.metadata.getTable('parkingInfo');
    console.log(tables);
    /*tables.forEach(async function(element) {
      if(element != "parkingInfo" && element != "parkingLog") {
        const query = "truncate " + element; 
        await client.execute(query, []);
      }
    });*/

    console.log("Clr: Missing parking_lot_id");
    res.status(400).send("Clr Error: Missing parking_lot_id")
  }

})

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

async function createTable(parkingLog_name, parkingInfo_name) {
  if(parkingLog_name) {
    const create_parkingLog = 'CREATE TABLE IF NOT EXISTS ' + parkingLog_name + ' (licenseNumber varchar, vehicleType varchar, enterOrExitTime timestamp, enterOrExit int, parkingSlotType varchar, PRIMARY KEY ((licenseNumber), enterOrExitTime));';
    const result1 = await client.execute(create_parkingLog, [], { prepare: true });
    if(enableLog == 2)console.log('Result1: ', result1);
  }
  
  if(parkingInfo_name) {
    const create_parkingInfo = "CREATE TABLE IF NOT EXISTS " + parkingInfo_name + " (licenseNumber varchar, parkingSlotType varchar, PRIMARY KEY (licenseNumber));";
    const result2 = await client.execute(create_parkingInfo, [], { prepare: true });
    if(enableLog == 2)console.log('Result2: ', result2);
  }
  
}

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

  await createTable(parkingLog_name, parkingInfo_name);

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

  await createTable(parkingLog_name, parkingInfo_name);

  // select the start time and the vehicle type
  const selectQuery = "select * from " + parkingLog_name + " where licenseNumber = ? and enterOrExit = 0 order by enterOrExitTime desc limit 1 allow filtering";
  let selectParam = [licensenumber];
  const selectResult = await client.execute(selectQuery, selectParam, { prepare: true });
  if(enableLog >= 1)console.log('Result: ', selectResult.rows);

  if(!selectResult.rows || selectResult.rows.length == 0) {
    console.log("Query failed!");
    throw new Error("Query failed!");
  }

  const snapshot = await getObj(parking_lot_id);
  if(!snapshot.rows || snapshot.rows.length == 0) {
    console.log("Query failed!");
    throw new Error("Query failed!");
  }
  let found = false;
  snapshot.rows.forEach(function(element) {
    if(element.licensenumber == licensenumber) {
      found = true;
    }
  });

  if(!found) {
    console.log("Missing license number!");
    throw new Error("Missing license number!");
  }

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

  await createTable(parkingLog_name, parkingInfo_name);

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
  try {
    const resObj =  await getObj(req.query.parking_lot_id);
    if(enableLog >= 1)console.log('Result: ', resObj.rows);
    res.status(200).send(resObj.rows);
  }
  catch(err) {
    console.log(err);
    res.status(400).send(err);
  }
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

  try {
    const result = await insertObj(jsonStr);
    res.status(200).send(result);
  }
  catch(err) {
    console.log(err);
    res.status(400).send(err);
  }
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

  try {
    let result = await deleteObj(req.query.licensenumber, req.query.timestamp, req.query.parking_lot_id);
    res.status(200).send(result);
  }
  catch(err) {
    console.log(err);
    res.status(400).send(err);
  }
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

  try {
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
  }
  catch(err) {
    console.log(err);
    jsonStr.DB_success = false;
    jsonStr.DB_err = err;
    res.status(400).send(jsonStr);
  }
})



async function retryConnect() {	
  client = new cassandra.Client({
    contactPoints: ['parking-lot-db'],
    localDataCenter: 'datacenter1',
    queryOptions: { consistency: types.consistencies.all }
  });

  try {
    await client.connect();

    const query1 = "CREATE KEYSPACE IF NOT EXISTS parkingLot WITH replication =" +
          "{'class': 'SimpleStrategy','replication_factor':1}";
    await client.execute(query1);

    const query2 = "use parkingLot";
    await client.execute(query2);

    console.log("DB connection succeeded");
		running = true;
  }
  catch(err) {
    console.log(err);
    console.log("DB connection failed");
    retry--;
    client.shutdown();
    setTimeout(async function() {
			if(retry > 0) await retryConnect();
			else {
				console.log("DB connection failed for too many times");
				console.log("Process exit");
				process.exit();
			}
    }, (retryInterval * 1000));
  }
}

app.listen(8090, async function(){
    console.log("address is localhost:8090");
    process.on('SIGINT', function() {
      console.log("\n Caught interrupt signal");
          process.exit();
    });
    await retryConnect();
})
 
