from flask import Flask, request, jsonify
import docker
import base64
import requests
from time import sleep
from datetime import datetime

SERVICE_PARAMS = {'web-service': {'image': 'davidyang97/web-service:latest', 'port': '8090'},
                 'plate-recognizer': {'image': 'sethbedford/alpr:latest', 'port': '8081'},
                 'vtype-recognizer': {'image': 'emwoj/detectron2:latest', 'port': '5000'},
                 'display-creator': {'image': 'alexneal/parkinglot-display:v2.0', 'port': '5000'}}

NUM_REPLICAS = 1  # Number of replicas to deploy of the services


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
@app.route('/start', methods=['POST'])
def start():

    # Get a dictionary of services currently running on the swarm
    existing_services = {service.name:service.id for service in client.services.list()}


    # TEMPORARY SOLUTION: Cassandra is standalone container on manager node
    # Keep this solution in place until we solve shared volume problem
    try:
        parking_lot_db = client.containers.get('parking-lot-db')
    except docker.errors.NotFound:
        mount = docker.types.Mount('/var/lib/cassandra', 'parking-lot')
        parking_lot_db = client.containers.run('cassandra:latest', name='parking-lot-db', 
            detach=True, network='parking-lot-net', mounts=[mount])


    # Start requested services (if necessary) and scale them
    for service_name in request.json['services']:
        name = SERVICE_PARAMS[service_name]['image']
        if service_name in existing_services:
            service = client.services.get(existing_services[service_name])
        else:
            service = client.services.create(SERVICE_PARAMS[service_name]['image'], name=service_name,
                networks=['parking-lot-net'])
        service.scale(NUM_REPLICAS)



    # Confirm that all services are ready before returning success method to client
    MAX_ATTEMPTS = 30
    attempt = 0

    while attempt < MAX_ATTEMPTS:
        ready = True

        try:
            for service_name in request.json['services']:
                port = SERVICE_PARAMS[service_name]['port']
                url = 'http://' + service_name + ':' + port + '/is-alive'
                if not requests.get(url).json()['alive']:
                    ready = False
            if ready:
                return jsonify(success=True)
        except:
            print('Failed to establish connection to a service. Trying again...')

        attempt +=1
        sleep(2)

    return jsonify(success=False, message='Max retries exceeded')

    


# ENDPOINT FOR INCOMING DATA
@app.route('/process', methods=['POST'])
def process():

    # TODO: everything

    # input
    input = request.json
    tmpData = ""
    dependency = "none"
    # parse the order of components
    for flow in input['data_flow']:
        src = flow['src']
        dst = flow['dst']

        inputData = tmpData
        if src == "source":
            inputData = input['data']

        result = requests.post('http://' + flow['dst'] + ':' + SERVICE_PARAMS[flow['dst']]['port'] + '/process', json=inputData)

        if dependency == "none": # overwrite previous results with new ones
            tmpData = result
        elif dependency == "split": # update previous results with new ones
            tmpData.update(result)
        else: # ignore multiple combines
            if flow['dependency'] != "combine": # update results from component after last combine
                tmpData = result

        dependency = flow['dependency']

    return tmpData['output'] 
    # OLD CODE:
    # # Image sent as part of request from client
    # img = request.files['file']
    # img_as_np_array = np.frombuffer(img.read(), np.uint8)
    # image_bytes = image_as_np_array.tobytes()
    # image_base64 = base64.b64encode(image_bytes)

    # # Send image to license plate recognizer
    # plateObj = {'img': image_base64}
    # plateNumber = requests.post('http://plate-recognizer:8081/plate', data=plateObj).json()['plate']

    # # Send image to vtype recognizer
    # # TODO: update img file name
    # files={'file': image_bytes}
    # vtype = requests.post('http://vtype-recognizer:5000/image-file',files=files).json()['type']


    # # Add vehicle to DB
    # now = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    # vehicleInfo = {'timestamp': now, 'vehicletype': vtype, 'licensenumber': plateNumber}
    # parkingSlotType = requests.post('http://web-service:8090/parkingInfo', vehicleInfo).json()['parkingslottype'] 
    # snapshot = requests.get('http://web-service:8090/parkingInfo').json() # return an array


    # # Get output display
    # chart_display = requests.post('http://display-creator:5000', json=snapshot).text


    # # Return output display to client
    # message = now + ": " + vtype + " with license plate " + plateNumber + " has been assigned to " + parkingSlotType + "\n"
    # return message + chart_display
    #return(True)




