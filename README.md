# CS6343 Cloud Computing Project

- (optional) stop and remove the existing flow-manager container
```
docker rm -f flow-manager
```
- workflow manager deployment
```
docker run -v /var/run/docker.sock:/var/run/docker.sock -p 80:5000 --name flow-manager -d davidyang97/flow-manager:v1.8
```
- (optional) attach the terminal to flow-manager
```
docker attach flow-manager
```
- clean all the existing services (run in browser)
```
http://cluster3-1.utdallas.edu/stop-all
```
- workflow request
```
python wf-request.py enter --lot 3 --replicas 3 --no-reuse
```
- generate data
  - entering
  ```
  python data-generator.py enter --lot 3 --lambda 1
  ```
  - exiting
  ```
  python data-generator.py exit --lot 3 --lambda 1
  ```
