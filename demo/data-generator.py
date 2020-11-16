import requests
import time
from datetime import datetime
import os
import random
import math
import base64
import argparse

# Specifications for data flows
DATA_FLOW_ENTER = [
            {
                "src":"source",
                "dst":"vtype-recognizer",
                "dependency":"split"
            },
            {
                "src":"source",
                "dst":"plate-recognizer",
                "dependency":"split"
            },
            {
                "src":"plate-recognizer",
                "dst":"web-service",
                "dependency":"combine"
            },
            {
                "src":"vtype-recognizer",
                "dst":"web-service",
                "dependency":"combine"
            },
            {
                "src":"web-service",
                "dst":"display-creator",
                "dependency":"none"
            }
        ]

DATA_FLOW_EXIT = [
            {
                "src":"source",
                "dst":"plate-recognizer",
                "dependency":"none"
            },
            {
                "src":"plate-recognizer",
                "dst":"web-service",
                "dependency":"combine"
            },
            {
                "src":"web-service",
                "dst":"display-creator",
                "dependency":"none"
            }
        ]


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

##############################################################


# Create command line parser
parser = argparse.ArgumentParser(description='Generate data for a parking lot')
parser.add_argument('behavior', help='Simulate entering or exiting vehicles',
                    choices=['enter','exit'])
parser.add_argument('--lot', help='The parking lot id', default=1, type=int)
parser.add_argument('--url', help='The base URL of the workflow manager', 
                    default='http://cluster3-1.utdallas.edu')
parser.add_argument('--lambda', help='The Poisson rate parameter (avg vehicles per sec)', 
                    type=float, default=0.5, dest='lambd')
parser.add_argument('--reuse', dest='reuse', action='store_true')
parser.add_argument('--no-reuse', dest='reuse', action='store_false')
parser.set_defaults(reuse=True)

# Parse arguments
args = parser.parse_args()


# Set DB behavior flag and data flow spec according to desired workflow
if args.behavior == 'enter':
    db_behavior = True
    data_flow = DATA_FLOW_ENTER
else:
    db_behavior = False
    data_flow = DATA_FLOW_EXIT


# Append '/process' to the url
if args.url[-1] == '/':
    url = args.url + 'process'
else:
    url = args.url + '/process'


elapsed_times = []

# Data generation
directory = './photos/'
for filename in os.listdir(directory):
    if filename.endswith(".jpg"):
        # create timestamp
        now = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
        # Create Data
        data = {"db_behavior": db_behavior,
                "parking_lot_id": args.lot,
                "reuse": args.reuse,
                "timestamp": now}
        print("Filename: " + filename)
        with open(directory + filename, "rb") as img_file:
            img_base64 = base64.b64encode(img_file.read())
        data['img'] = img_base64.decode('utf-8')

        wf_input = {"data_flow": data_flow,
                    "data": data}

        # Send request and time it
        print('\nDetected vehicle...')
        start_time = time.perf_counter()
        response = requests.post(url, json=wf_input)
        finish_time = time.perf_counter()

        # Print response 
        try:
            print(response.json()['display'])
        except:
            print('Workflow returned an error: ')
            print(response.text)

        # Print and save processing time
        elapsed_time = finish_time - start_time
        elapsed_times.append(elapsed_time)
        print('Processed in ' + str(elapsed_time) + ' sec')

        # Divider
        print('----------------------------------------------------------\n')

        # Wait for next Poisson event
        time.sleep(sim_inter_event_time(args.lambd))
    else:
        continue

print('Average time: ', sum(elapsed_times)/len(elapsed_times), 'sec')
