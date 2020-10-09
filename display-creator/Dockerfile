FROM python:3.7.0-alpine3.8

WORKDIR /usr/src/app

RUN pip install 'flask==1.1.2'

COPY . .

ENV FLASK_APP=parkinglot-display.py

CMD flask run --host=0.0.0.0