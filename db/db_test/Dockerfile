# specify the node base image with your desired version node:<version>
FROM node:10
# Create app directory
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
# Bundle app source
COPY . .
# replace this with your application's default port
EXPOSE 8081
CMD [ "node", "db.js" ]
