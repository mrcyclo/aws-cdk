FROM node:16-alpine

WORKDIR /target

RUN npm i -g aws-cdk
