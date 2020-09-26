from flask import Flask, request, jsonify
import docker
import requests
from time import sleep
app = Flask(__name__)


@app.route('/flowers', methods=['POST', 'GET'])
def index():

	# Connect to docker daemon on host machine (requires volume mount)
	client = docker.from_env()

	# Get overlay network if it exists already, otherwise create it
	network = client.networks.list(names=['test-workflow-net'])
	if len(network) == 1:
		network = network[0]
	else:
		network = client.networks.create('test-workflow-net', driver='overlay', 
			attachable=True)

	# Connect this container to the network
	try:
		network.connect('flow-manager')
	except:
		print('flow-manager is already connected to network')


	# Get a dictionary of services currently running on the swarm
	existing_services = {service.name:service.id for service in client.services.list()}



	# Deploy only the services that aren't already running

	# Cassandra DB
	if 'cass' in existing_services:
		db_service = client.services.get(existing_services['cass'])
	else:
		db_service = client.services.create('cassandra:latest', name='cass',
			networks=['test-workflow-net'])
	# db_service.scale(num_replicas)
	
	# app
	if 'flower-app' in existing_services:
		app_service = client.services.get(existing_services['flower-app'])
	else:
		app_service = client.services.create('alexneal/test-workflow-app:v1.1', 
			name='flower-app', networks=['test-workflow-net'])
	# app_service.scale(num_replicas)

	# svm
	if 'flower-svm' in existing_services:
		svm_service = client.services.get(existing_services['flower-svm'])
	else:
		svm_service = client.services.create('alexneal/svm-docker-test:v2.0', 
			name='flower-svm', networks=['test-workflow-net'])
	# svm_service.scale(num_replicas)


	# Begin processing workflow
	# If request fails or response contains error message, container(s) are not
	#		ready yet, wait 3sec and try again
	response = None 
	while not response or 'message' in response:
		try:
			if request.method == 'POST':
				response = requests.post('http://flower-app:5000/', json=request.json).json()

			elif request.method == 'GET':
				response = requests.get('http://flower-app:5000/').json()
		except:
			# containers not ready yet, wait 3 sec and try again
			sleep(3)

	# Return response to client
	return jsonify(response)

