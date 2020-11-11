import requests
import argparse
import time

# Create command line parser
parser = argparse.ArgumentParser(description='Generate data for a parking lot')
parser.add_argument('behavior', help='The workflow to request',
                    choices=['enter','exit'])
parser.add_argument('--url', help='The base URL of the workflow manager', 
                    default='http://cluster3-1.utdallas.edu')


# Parse arguments
args = parser.parse_args()


# Create services list according to desired workflow
if args.behavior == 'enter':
    services = ['plate-recognizer', 'vtype-recognizer', 'web-service', 'display-creator']
else:
    services = ['plate-recognizer', 'web-service', 'display-creator']


# Append '/start' to the url
if args.url[-1] == '/':
    url = args.url + 'start'
else:
    url = args.url + '/start'


data = {'services': services}


# start requested workflow
start_time = time.perf_counter()
response = requests.post(url, json=data).json()
finish_time = time.perf_counter()

elapsed_time = finish_time - start_time
if response['success']:
	print('Workflow deployed in ' + str(elapsed_time) + ' sec')
else:
	print('Error Deploying Workflow: ' + response['message'])


