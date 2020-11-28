from flask import Flask, request, jsonify
import math

def barchart(data):
    dot = '∎'
    total = sum(data.values())

    
    max_length = max([len(key) for key in data.keys()])
    max_length = min(max_length, 30)
    value_characters = 50 - max_length
    max_value = max(data.values())
    scale = int(math.ceil(float(max_value) / value_characters))
    scale = max(1, scale)
    
    output = "\nOCCUPIED SPACES\n"
    output += "%d vehicles in parking lot, " % total
    output += "each " + dot + " represents a count of %d.\n\n" % scale
    
    
    str_format = "%" + str(max_length) + "s [%6d] %s%s\n"
    percentage = ""
    for key, value in data.items():
        # Uncomment to display percentages
        # percentage = " (%0.2f%%)" % (100 * value / total)
        output += str_format % (key[:max_length], value, int((value / scale)) * dot, percentage)
        
    return output + '\n'


app = Flask(__name__)

@app.route('/is-alive', methods=['GET'])
def is_alive():
    return jsonify({"alive": True})


@app.route('/process', methods=['POST'])
def process():

    output = ''

    if 'timestamp' in request.json:
        output += request.json['timestamp'] + '\n'
        
    if 'vtype' in request.json:
        output += request.json['vtype'] + ' '
    else:
        output += 'Vehicle '

    if 'plate' in request.json:
        output += 'with license plate ' + request.json['plate'] + ' '

    if 'db_behavior' in request.json:
        entering = request.json['db_behavior']
        if entering:
            output += 'has entered parking lot '
        else:
            output += 'has exited parking lot '

    if 'parking_lot_id' in request.json:
        output += str(request.json['parking_lot_id'])

    if 'parkingfee' in request.json:
        output += '\nparking fee is ' + str(request.json['parkingfee'])

    output += '\n'

    if 'snapshot' in request.json and len(request.json['snapshot']) > 0:
        slot_type_counts = {}
        for vehicle in request.json['snapshot']:
            if vehicle['parkingslottype'] in slot_type_counts:
                slot_type_counts[vehicle['parkingslottype']] += 1
            else:
                slot_type_counts[vehicle['parkingslottype']] = 1
    
        output += barchart(slot_type_counts)

    return jsonify({"display": output})