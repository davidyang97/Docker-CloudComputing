### Description
Nodejs web service
Create a nodejs container, access data from cassandra container
API document see https://davidyang97.stoplight.io/docs/dockercloudcomputing/reference/ParkingLot.v1.yaml
### Guidance
- Run cassandra container
```
	docker run -d -v parking-lot:/var/lib/cassandra --network cassandra-net  -p 7000:7000 -p 9042:9042 --name parking-lot-db cassandra:latest
```
- Go to Docker-CloudComputing/db/db_test
- Run `npm install`
- Build image of nodejs
```
	docker build -t david/web-service .
```
- Run image and gets the result
```
	docker run -d --network cassandra-net -p 8090:8090 david/web-service
```

