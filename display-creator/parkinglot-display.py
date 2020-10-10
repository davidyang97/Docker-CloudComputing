from flask import Flask, request, jsonify
import math

def barchart(data):
    dot = '∎'
    total = sum(data.values())

    
    max_length = max([len(key) for key in data.keys()])
    max_length = min(max_length, 50)
    value_characters = 80 - max_length
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


@app.route('/', methods=['POST'])
def index():
    slot_type_counts = {}
    for vehicle in request.json:
        if vehicle['parkingslottype'] in slot_type_counts:
            slot_type_counts[vehicle['parkingslottype']] += 1
        else:
            slot_type_counts[vehicle['parkingslottype']] = 1
    
    return barchart(slot_type_counts)