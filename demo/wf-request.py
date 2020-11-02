import requests
import argparse


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


data = {'services':['plate-recognizer', 'vtype-recognizer', 'web-service', 'display-creator']}


# start requested workflow
start_response = requests.post(url, json=data).json()

if start_response['success']:
	print('Workflow Deployed')
else:
	print('Error Deploying Workflow: ' + start_response['message'])


