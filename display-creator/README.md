 # Parking Lot Display Generator

 Example Request

 `curl --header "Content-Type: application/json" --request POST --data '{"db_behavior": true, "parking_lot_id": 2, "plate": "ABC-123", "vtype": "Truck", "snapshot": [{"licensenumber": "ABC-123", "parkingslottype": "green"},{"licensenumber": "WER-3432", "parkingslottype": "purple"}]}' localhost:5000/process`
