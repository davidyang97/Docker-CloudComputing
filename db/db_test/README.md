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
	docker run -d --network host david/node-db-app
```
- Use curl command to test
```
	curl localhost:8081/cassandra/v1?id=1
```
