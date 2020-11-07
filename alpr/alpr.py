from flask import Flask, request, jsonify
import requests
import base64
import json

app = Flask(__name__)

@app.route('/process', methods=['POST'])
def plate():
    SECRET_KEY = 'sk_dd5891bbd0e246f345e7d1ac'

    #img_base64 = request.form.get('img')
    input = request.json
    url = 'https://api.openalpr.com/v3/recognize_bytes?recognize_vehicle=1&country=us&secret_key=%s' % (SECRET_KEY)
    r = requests.post(url, data = input['img'].encode())

    data = r.json()
    output = '{"plate": "' + str(data['results'][0]['plate']) + '", "confidence": "' + str(data['results'][0]['confidence']) + '"}'
    output = json.loads(output)
    input.update(output)
    return input

@app.route('/is-alive', methods=['GET'])
def alive():
    out = '{"alive": "true"}'
    return json.loads(out)
