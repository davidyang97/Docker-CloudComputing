## Description

Nodejs Web Service

- Create a nodejs container to access data in cassandra container

- API document see https://davidyang97.stoplight.io/docs/dockercloudcomputing/reference/ParkingLot.v1.yaml

- Finished API:
	- [GET, POST, DELETE] /parkingInfo
***
## Guidance
- Run cassandra container
```
	docker run -d -v parking-lot:/var/lib/cassandra --network cassandra-net  -p 7000:7000 -p 9042:9042 --name parking-lot-db cassandra:latest
```
- Go to Docker-CloudComputing/db/web_service
- Build image of nodejs
```
	docker build -t david/web-service .
```
- Run image and gets the result
```
	docker run -d --network cassandra-net -p 8090:8090 --name web-service david/web-service
```
***
## Sample Test
- **Warning:** should change the licensenumber because someone may have tested and added to db
- Retrieve the snapshot of parking lot
```
	curl localhost:8090/parkingInfo
```
- Insert the vehicle information when entering parking lot and return the corresponding parking slot type
```
	curl -X POST -H "Content-Type: application/json" \
    	-d '{"licensenumber": "AAA3333", "vehicletype": "truck", "timestamp":"2019-09-09 12:12:12"}' \
	localhost:8090/parkingInfo
```
- Delete the vehicle information
	- There are more than 1 parameter in the delete method, and I don't know how to use curl to achieve that
	- so I wrote another node file to do the test
```
	node test.js
```
