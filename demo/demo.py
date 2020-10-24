import requests
import json
from time import sleep
import os

# These URL's should work from your laptop as long as you are on VPN
#		and flow manager is exposed at cluster3-1 port 80
entryUrl = 'http://cluster3-1.utdallas.edu/entry'
startUrl = 'http://cluster3-1.utdallas.edu/start'


# start workflow
start_response = requests.get(startUrl).json()

if start_response['success']:
	print('Workflow Deployed')
else:
	print('Error Deploying Workflow: ' + start_response['message'])

# Begin sending vehicle images every 3 seconds
for filename in os.listdir('.'):
	if filename.endswith(".jpg"):
		file = {'file': open(filename, 'rb')}

		print('\nDetected Entering Vehicle...')
		response = requests.post(entryUrl, files=file)
		print(response.text)
		sleep(3)
	else:
		continue

