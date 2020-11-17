This directory is for demo scripts and images

# wf-request.py

This script sends a workflow request to the workflow manager. It has the following command line arguments:

- `enter` or `exit` (required): Determines which workflow to request (entering vehicles or exiting vehicles)
- `--url` (optional): The base url to send the request to. Defaults to http://cluster3-1.utdallas.edu if not provided
- `--lot` (optional): The parking lot id. Defaults to 1 if not provided.
- `--reuse` or `--no-reuse` (optional): Indicates whether to request a shared / reusable workflow or a dedicated workflow. Defaults to `--reuse` if not provided.
- `--replicas` (optional): The desired number of replicas for each component

Example usage: `python wf-request.py enter --lot 3 --replicas 3 --no-reuse --url http://localhot:5000`

<br>

# data-generator.py

This script reads the jpg files in the `photos` directory to generate data for workflow input. It has the following command line arguments:


- `enter` or `exit` (required): Determines whether to simulate entering or exiting vehicles
- `--lot` (optional): The parking lot id. Defaults to 1 if not provided.
- `--url` (optional): The url to send the data to. Defaults to http://cluster3-1.utdallas.edu if not provided. This will make it easy to use a localhost url for local testing
- `--lambda` (optional): The Poisson rate parameter (avg vehicles per second). Defaults to 0.5 if not provided.

Example usage: `python data-generator.py enter --lot 2 --url http://localhot:5000 --lambda 1`
