import requests
from time import sleep
import os
import random
import math
import base64
import argparse


def sim_inter_event_time(l):
    """The inter-event time for a Poisson process is modeled with an
    Exponential(lambda) distribution. To simulate, we generate a
    random uniform probability and use it as the input to the 
    inverse Exponential CDF. 

    Args:
        l: The lambda incidence rate parameter, i.e. avg events per sec

    Returns: 
        A simulated inter-event time
    """

    p = random.random()
    inter_event_time = -math.log(1.0-p)/l
    return inter_event_time


# Create command line parser
parser = argparse.ArgumentParser(description='Generate data for a parking lot')
parser.add_argument('behavior', help='Simulate entering or exiting vehicles',
                    choices=['enter','exit'])
parser.add_argument('--lot', help='The parking lot id', default=1, type=int)
parser.add_argument('--url', help='The base URL of the workflow manager', 
                    default='http://cluster3-1.utdallas.edu')
parser.add_argument('--lambda', help='The Poisson rate parameter (avg vehicles per sec)', 
                    type=float, default=2.0, dest='lambd')


# Parse arguments
args = parser.parse_args()


# Set DB behavior flag and services list according to desired workflow
if args.behavior == 'enter':
    db_behavior = True
    services = ['plate-recognizer', 'vtype-recognizer', 'web-service', 'display-creator']
else:
    db_behiavior = False
    services = ['plate-recognizer', 'web-service', 'display-creator']


# Append '/process' to the url
if args.url[-1] == '/':
    url = args.url + 'process'
else:
    url = args.url + '/process'


# Data generation
for filename in os.listdir('.'):
    if filename.endswith(".jpg"):
        # Create JSON object
        data = {"services": services,
                "db_behavior": db_behavior,
                "parking_lot_id": args.lot}
        with open(filename, "rb") as img_file:
            data['img'] = base64.b64encode(img_file.read())

        # Send request and print response
        print('\nDetected Entering Vehicle...')
        response = requests.post(url, data=data)
        print(response.json()['display'])

        # Wait for next Poisson event
        sleep(sim_inter_event_time(args.lambd))
    else:
        continue
