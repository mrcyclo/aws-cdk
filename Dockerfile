FROM node:16-alpine

# WORKDIR /tmp/aws-cli
# RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
#     unzip awscliv2.zip && \
#     ./aws/install && \
#     rm -rf /tmp/aws-cli

WORKDIR /target

RUN npm i -g aws-cdk
