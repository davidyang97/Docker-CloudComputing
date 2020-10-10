CREATE KEYSPACE IF NOT EXISTS parkingLot
WITH REPLICATION = {'class': 'SimpleStrategy','replication_factor':1};

USE parkingLot;

CREATE TABLE IF NOT EXISTS parkingLog(
licenseNumber varchar,
vehicleType varchar,
enterOrExitTime timestamp,
enterOrExit int,
parkingSlotType varchar,
PRIMARY KEY ((licenseNumber), enterOrExitTime));

CREATE TABLE IF NOT EXISTS parkingInfo(
licenseNumber varchar,
parkingSlotType varchar,
PRIMARY KEY (licenseNumber));

INSERT INTO parkingLog(licenseNumber, vehicleType, enterOrExitTime, enterOrExit, parkingSlotType) VALUES ('ABC-1234','car','2020-05-05 08:12:54',0,'green');

INSERT INTO parkingLog(licenseNumber, vehicleType, enterOrExitTime, enterOrExit, parkingSlotType) VALUES ('ABC-1234','car','2020-05-05 09:12:54',1,'green');

INSERT INTO parkingLog(licenseNumber, vehicleType, enterOrExitTime, enterOrExit, parkingSlotType) VALUES ('ABC-1234','car','2020-05-05 11:12:54',0,'green');

INSERT INTO parkingLog(licenseNumber, vehicleType, enterOrExitTime, enterOrExit, parkingSlotType) VALUES ('CCC1234','bus','2020-05-05 18:12:54',0,'orange');

INSERT INTO parkingInfo(licenseNumber, parkingSlotType)
VALUES ('CCC1234', 'orange');

INSERT INTO parkingInfo(licenseNumber, parkingSlotType)
VALUES ('ABC-1234', 'green');
