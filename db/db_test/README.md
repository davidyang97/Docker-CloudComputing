### Description
Nodejs db test
Create a nodejs container, access data from cassandra container
### Guidance
- Run cassandra container
- Go to Docker-CloudComputing/db/db_test
- Run `npm install`
- Build image of nodejs
```
	docker build -t david/node-db-app
```
- Run image and gets the result
```
	docker run -it --network host david/node-db-app
```
## Remaining Problems
- after retrieving the data, the bash interface doesn't exit, even if using Ctrl + C
