from flask import Flask, request, jsonify
import docker
import requests
from time import sleep
from datetime import datetime

# Connect to docker daemon on host machine (requires volume mount)
client = docker.from_env()

# Get overlay network if it exists already, otherwise create it
network = client.networks.list(names=['parking-lot-net'])
if len(network) == 1:
	network = network[0]
else:
	network = client.networks.create('parking-lot-net', driver='overlay', 
		attachable=True)

# Connect this container to the network
try:
	network.connect('flow-manager')
except:
	print('flow-manager is already connected to network')


app = Flask(__name__)


# ENDPOINT FOR WORKFLOW REQUEST
@app.route('/start', methods=['GET'])
def start():

	# Get a dictionary of services currently running on the swarm
	existing_services = {service.name:service.id for service in client.services.list()}

	service_list = []


	# # CASSANDRA SERVICE -- commented out due to shared volume problem. See temp solution below
	# if 'parking-lot-db' in existing_services:
	# 	parking_lot_db = client.services.get(existing_services['parking-lot-db'])
	# else:
	# 	parking_lot_db = client.services.create('cassandra:latest', name='parking-lot-db',
	# 		networks=['parking-lot-net'], mounts=['parking-lot:/var/lib/cassandra'])
	# service_list.append(parking_lot_db)

	# TEMPORARY SOLUTION: Cassandra is standalone container on manager node
	try:
		parking_lot_db = client.containers.get('parking-lot-db')
	except docker.errors.NotFound:
		mount = docker.types.Mount('/var/lib/cassandra', 'parking-lot')
		parking_lot_db = client.containers.run('cassandra:latest', name='parking-lot-db', 
			detach=True, network='parking-lot-net', mounts=[mount])


	# DATABASE API SERVICE
	# TODO: Add docker hub repository for the image
	if 'web-service' in existing_services:
		web_service = client.services.get(existing_services['web-service'])
	else:
		web_service = client.services.create('davidyang97/web-service:latest', name='web-service',
			networks=['parking-lot-net'], endpoint_spec=docker.types.EndpointSpec(ports={8090:8090}))
	service_list.append(web_service)


	# PLATE RECOGNIZER
	# TODO: Add docker hub repository for the image, configure port with EndpointSpec if necessary
	if 'plate-recognizer' in existing_services:
		plate_recognizer = client.services.get(existing_services['plate-recognizer'])
	else:
		plate_recognizer = client.services.create('sethbedford/alpr:latest', name='plate-recognizer',
			networks=['parking-lot-net'], endpoint_spec=docker.types.EndpointSpec(ports={8081:8081}))
	service_list.append(plate_recognizer)


	# VEHICLE TYPE RECOGNIZER
	# TODO: Add docker hub repository for the image, configure port with EndpointSpec if necessary
	if 'vtype-recognizer' in existing_services:
		vtype_recognizer = client.services.get(existing_services['vtype-recognizer'])
	else:
		vtype_recognizer = client.services.create('emwoj/detectron2:latest', name='vtype-recognizer',
			networks=['parking-lot-net'], endpoint_spec=docker.types.EndpointSpec(ports={8080:5000}))
	service_list.append(vtype_recognizer)


	# DISPLAY CREATOR
	if 'display-creator' in existing_services:
		display_creator = client.services.get(existing_services['display-creator'])
	else:
		display_creator = client.services.create('alexneal/parkinglot-display:v1.0', name='display-creator',
			networks=['parking-lot-net'], endpoint_spec=docker.types.EndpointSpec(ports={5001:5000}))
	service_list.append(display_creator)


	# Scale all the services to desired number of replicas
	NUM_REPLICAS = 1
	for service in service_list:
		service.scale(NUM_REPLICAS)


	# The manager should confirm that all services are ready before telling the client it is ok to send data
	# Somehow, get confirmation that all containers are up and running. If not, wait 2 sec and try again
	# Each component could implement an 'is-alive' endpoint that returns a JSON like {"alive": True}
	MAX_ATTEMPTS = 30
	attempt = 0

	while attempt < MAX_ATTEMPTS:
		ready = True

		try:
			if not requests.get('http://plate-recognizer:8081/is-alive').json()['alive']:
				ready = False
			if not requests.get('http://vtype-recognizer:5000/is-alive').json()['alive']:
				ready = False
			if not requests.get('http://display-creator:5000/is-alive').json()['alive']:
				ready = False
			if not requests.get('http://web-service:8090/is-alive').json()['alive']:
				ready = False
			if ready:
				return jsonify(success=True)
		except:
			print('Failed to establish connection to a service. Trying again...')

		attempt +=1
		sleep(2)

	return jsonify(success=False, message='Max retries exceeded')

	



# ENDPOINT FOR ENTERING VEHICLES
@app.route('/entry', methods=['POST'])
def entry():

	# Image sent as part of request from client
	image_base64 = request.form.get('img_base64')

	# Send image to license plate recognizer
	plateObj = {'img': image_base64}
	plateNumber = requests.post('http://plate-recognizer:8081/plate', data=plateObj).json()['plate']

	# Send image to vtype recognizer
	# TODO: update img file name
	files={'file':open(img,'rb')}
	vtype = requests.post('http://vtype-recognizer:5000/image-file',files=files).json()['type']


	# Add vehicle to DB
	now = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
	vehicleInfo = {'timestamp': now, 'vehicletype': vtype, 'licensenumber': plateNumber}
	parkingSlotType = requests.post('http://web-service:8090/parkingInfo', vehicleInfo).json()['parkingslottype'] 
	snapshot = requests.get('http://web-service:8090/parkingInfo').json() # return an array


	# Get output display
	chart_display = requests.post('http://display-creator:5000', json=snapshot).text


	# Return output display to client
	message = vtype + " with license plate " + plateNumber + " has been assigned to " + parkingSlotType + "\n"
	return message + chart_display


# ENDPOINT FOR EXITING VEHICLES
@app.route('/exit', methods=['GET'])
def exit():
	# Not needed for midterm demo
	return


