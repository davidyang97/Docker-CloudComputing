### Description
Nodejs db test
Create a nodejs container, access data from cassandra container
### Guidance
- Run cassandra container
- Go to Docker-CloudComputing/db/db_test
- Run `npm install`
- Build image of nodejs
```
	docker build -t david/node-db-app .
```
- Run image and gets the result
```
	docker run -d --network cassandra-net -p 8090:8090 david/node-db-app
```
- Use curl command to insert and retrieve data
```
	curl -X POST -H "Content-Type: application/json" \
    	-d '{"id": "9", "user_name": "Janet"}' \
	localhost:8090/cassandra/v1
```
```
	curl localhost:8090/cassandra/v1?id=9
```
