## Description

Service for license plate recognition. Deployed as a python flask web service.
***
## Deployment
- Build the image (from within this directory)
```
	docker build -t sethbedford/alpr .
```
- Create a service with the image
```
	sudo docker service create -p 8081:8081 --name="alpr-endpoint" sethbedford/alpr:latest
```
***
## Usage
- POST a base64-encoded image to `/plate1` named `img` 
- Will return JSON with two values: `plate` and `confidence`
- GET `/is-alive` will return `alive: true` if the service is running
