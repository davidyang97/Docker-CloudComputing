

The application in `flow-manager.py` runs in a non-swarm container on the manager node. It acts as a REST service to accept incoming workflow requests from clients (i.e., our laptops), and it deploys the services to the Swarm dynamically if they are not already active. Once all services are active, it executes the workflow and returns the response to the client.


The workflow manager can be started on a manager node with the following command


```docker run -v /var/run/docker.sock:/var/run/docker.sock -p 5000:5000 --name flow-manager alexneal/flow-manager:v1.0```

The -v parameter allows the swarm to be controlled from within this container

---

The test workflow I used here includes 3 components:
* A 'flower-app' component which accepts data features for a new flower, sends a request to the svm component to get a species prediction, and stores the features and predicted species in the cassandra database
* A 'flower-svm' component
* A cassandra db component

All three components are on Docker Hub, if by chance you want to build the flow-manager image locally and experiment with it.

---

To execute the workflow, you can send a request such as the following:

```curl --header "Content-Type: application/json" --request POST --data '{"pedal_length":3.1, "pedal_width":2.3, "sepal_length":2.8, "sepal_width":1.3}' localhost:5000/flowers```

To view entire contents of db, you can just send a GET request instead of POST:

```curl localhost:5000/flowers```

Note that since this is for testing purposes, the database does not persist. In other words, if you stop the cassandra service the data will be erased.
