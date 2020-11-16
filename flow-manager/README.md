
# flow-manager

After building this image, it must be run with a command similar to the following:

`docker run -v /var/run/docker.sock:/var/run/docker.sock -p 80:5000 --name flow-manager -d <IMAGE>`

The volume mount is required for it to work correctly
