# AWS CDK
## Installation
- Rename `.env.example` to `.env` and fill all variable in there.
- Build docker container.
    ```
    docker-compose build cdk
    docker-compose run --rm --no-deps cdk npm install
    ```

## Deploy cdk
```
docker-compose run --rm --no-deps cdk deploy training-stack
```

## Codebuild
After cdk deployed, a new item will be show in your codebuild list. Run that and you will get a new web systems (ALB, ASG, AMI, ...)
