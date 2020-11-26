from flask import Flask, request, jsonify
import docker
import base64
import requests
from time import sleep
import time
from datetime import datetime
from docker.types import ServiceMode

SERVICE_PARAMS = {'web-service': {'image': 'davidyang97/web-service:v2.6', 'port': '8090'},
                 'plate-recognizer': {'image': 'sethbedford/alpr:v1.2', 'port': '8081'},
                 'vtype-recognizer': {'image': 'emwoj/detectron2:latest', 'port': '5000'},
                 'display-creator': {'image': 'alexneal/parkinglot-display:v2.2', 'port': '5000'},
                 'cassandra': {'image': 'cassandra:latest'}}

SLEEP_TIME = 10 # Sleep time when waiting for services deployment

SEED_NAME = 'cassandra-001' # Seed name of Cassandra cluster

# Global dict mapping lot id to reuse flag
lot_map = {}

# Record current replicas 

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
    print("/start\n", flush=True)
    # Get a dictionary of services currently running on the swarm
    existing_services = {service.name:service.id for service in client.services.list()}

    # Store reuse flag for this client's workflow
    lot_id = request.json['parking_lot_id']
    lot_map[lot_id] = {}
    lot_map[lot_id]['reuse'] = request.json['reuse']
    # Can store additional client-related data in this dict

    start_time = time.perf_counter()
    # Start requested services (if necessary) and scale them
    for service in request.json['services']:
        service_name = service['name']
        replicas = service['replicas']
        image_name = SERVICE_PARAMS[service_name]['image']
        service_mode = ServiceMode('replicated', replicas)

        if service_name == 'cassandra':
            if SEED_NAME not in existing_services:
                # Create seed node
                print(SEED_NAME + " creating", flush=True)

                service = client.services.create(image_name, name=SEED_NAME,
                    env=['CASSANDRA_BROADCAST_ADDRESS=' + SEED_NAME], networks=['parking-lot-net'])

                print(SEED_NAME + " created", flush=True)

                # Create the rest of the nodes and let them point to the seed node
                for i in range(1, replicas):
                    j = ( i % 3 ) + 1

                    DB_name = 'cassandra-' + str(j)
                    DB_env = 'CASSANDRA_BROADCAST_ADDRESS=' + DB_name

                    print(DB_name + " creating", flush=True)

                    service = client.services.create(image_name, name=DB_name,
                        env=[DB_env, 'CASSANDRA_SEEDS=' + SEED_NAME], networks=['parking-lot-net'])

                    print(DB_name + " created", flush=True)
        else: 
            if not request.json['reuse']: # Append lot ID if reuse is not desired
                service_name = service_name + str(request.json['parking_lot_id'])

            print(service_name + " " + image_name + " creating", flush=True)
            if service_name in existing_services:
                service = client.services.get(existing_services[service_name])
            else:
                service = client.services.create(image_name, name=service_name,
                    networks=['parking-lot-net'], mode=service_mode)

            print(service_name + " " + image_name + " created", flush=True)
    end_time = time.perf_counter()
    print('Services deployment finished in ' + str(end_time - start_time) + ' sec', flush=True)


    # Confirm that all services are ready before returning success method to client
    MAX_ATTEMPTS = 30
    attempt = 0

    while attempt < MAX_ATTEMPTS:
        ready = True

        try:
            for service in request.json['services']:
                service_name = service['name']
                if service_name != 'cassandra':
                    port = SERVICE_PARAMS[service_name]['port']

                    if not request.json['reuse']: # Append lot id if non-reuse case
                        service_name = service_name + str(request.json['parking_lot_id'])

                    print("attempting to check " + service_name, flush=True)
                    url = 'http://' + service_name + ':' + port + '/is-alive'
                    if not requests.get(url).json()['alive']:
                        ready = False
                        print(service_name + " connection failed", flush=True)
            if ready:
                available_time = time.perf_counter()
                print('Services are available in ' + str(available_time - start_time) + ' sec', flush=True)
                return jsonify(success=True)
        except:
            print('Failed to establish connection to a service. Trying again...')

        attempt +=1
        sleep(SLEEP_TIME)

    return jsonify(success=False, message='Max retries exceeded')


# ENDPOINT TO STOP AND REMOVE ALL SERVICES
@app.route('/stop-all', methods=['GET'])
def stop_all():
    for service in client.services.list():
        service.remove()
    return "all services stopped"


# ENDPOINT FOR INCOMING DATA
@app.route('/process', methods=['POST'])
def process():

    lot_id = request.json['data']['parking_lot_id'] 
    if lot_id not in lot_map:
        return "Client has not yet requested a workflow"

    # input
    input = request.json
    
    # print("request.json", flush=True)
    # print(input, flush=True)
    tmpData = {}
    # parse the order of components
    for flow in request.json['data_flow']:
        src = flow['src']
        dst = flow['dst']
        dependency = flow["dependency"]

        inputData = tmpData
        if src == "source":
            inputData = input['data']


        if not lot_map[lot_id]['reuse']: # Append lot id if client's config is non-reuse
            if src != "source":
                src = src + str(lot_id)
            dst = dst + str(lot_id)

        if dependency != "together" or (dependency == "together" and stat == "end"):
            print("sending request from " + src + " to " + dst, flush=True)
            result = requests.post('http://' + dst + ':' + SERVICE_PARAMS[flow['dst']]['port'] + '/process', json=inputData)
            # print(result, flush=True)
            result = result.json()

        if dependency == "none": # overwrite previous results with new ones
            tmpData = result
        else:
            stat = flow["stat"]
            if dependency == "combine":
                if stat != "start":
                    tmpData.update(result)
                else:
                    tmpData = result
            elif dependency == "together": 
                if stat == "end": 
                    tmpData = result
    
    result = {'display', tmpData['display']}

    return jsonify(display=tmpData['display']) 




