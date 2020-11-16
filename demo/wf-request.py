import requests
import argparse
import time

# Create command line parser
parser = argparse.ArgumentParser(description='Generate data for a parking lot')
parser.add_argument('behavior', help='The workflow to request',
                    choices=['enter','exit'])
parser.add_argument('--lot', help='The parking lot id', default=1, type=int)
parser.add_argument('--url', help='The base URL of the workflow manager', 
                    default='http://cluster3-1.utdallas.edu')
parser.add_argument('--replicas', help='Number of replicas for each service', default=2, type=int)
parser.add_argument('--reuse', dest='reuse', action='store_true')
parser.add_argument('--no-reuse', dest='reuse', action='store_false')
parser.set_defaults(reuse=True)

# Parse arguments
args = parser.parse_args()

NUM_REPLICAS = args.replicas

# Create services list according to desired workflow
if args.behavior == 'enter':
    # services = ['cassandra', 'plate-recognizer', 'vtype-recognizer', 'web-service', 'display-creator']
    services = [{
        'name': 'cassandra',
        'replicas': NUM_REPLICAS
    },{
        'name': 'plate-recognizer',
        'replicas': NUM_REPLICAS
    },{
        'name': 'vtype-recognizer',
        'replicas': NUM_REPLICAS
    },{
        'name': 'web-service',
        'replicas': NUM_REPLICAS,
    },{
        'name': 'display-creator',
        'replicas': NUM_REPLICAS
    }]
else:
    # services = ['cassandra', 'plate-recognizer', 'web-service', 'display-creator']
    services = [{
        'name': 'cassandra',
        'replicas': NUM_REPLICAS,
    },{
        'name': 'plate-recognizer',
        'replicas': NUM_REPLICAS,
    },{
        'name': 'web-service',
        'replicas': NUM_REPLICAS,
    },{
        'name': 'display-creator',
        'replicas': NUM_REPLICAS,
    }]



# Append '/start' to the url
if args.url[-1] == '/':
    url = args.url + 'start'
else:
    url = args.url + '/start'


data = {'services': services,
        'data_flow': data_flow,
        'reuse': args.reuse,
        'parking_lot_id': args.lot}


# start requested workflow
start_time = time.perf_counter()
response = requests.post(url, json=data).json()
finish_time = time.perf_counter()

elapsed_time = finish_time - start_time
if response['success']:
	print('Workflow deployed in ' + str(elapsed_time) + ' sec')
else:
	print('Error Deploying Workflow: ' + response['message'])


