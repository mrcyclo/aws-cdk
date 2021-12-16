FROM ubuntu:latest

ENV DEBIAN_FRONTEND="noninteractive"

RUN apt update -y && \
    apt install -y curl unzip

WORKDIR /tmp

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf aws && \
    rm -f awscliv2.zip

RUN apt install -y nodejs
RUN apt install -y npm
RUN npm i -g aws-cdk

RUN apt install -y ca-certificates curl gnupg lsb-release && \
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt update -y && \
    apt install -y docker-ce docker-ce-cli containerd.io

WORKDIR /target
