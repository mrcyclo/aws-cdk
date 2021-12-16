import { BuildSpec, LinuxBuildImage, Project } from "@aws-cdk/aws-codebuild";
import {
    AmazonLinuxGeneration,
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    MachineImage,
    Peer,
    Port,
    SecurityGroup,
    SubnetType,
    Vpc
} from "@aws-cdk/aws-ec2";
import {
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal
} from "@aws-cdk/aws-iam";
import * as cdk from "@aws-cdk/core";

export class TrainingStack extends cdk.Stack {
    public vpc: Vpc;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create VPC
        this.vpc = new Vpc(this, "vpc", {
            cidr: "13.0.0.0/16",
            maxAzs: 2,
            natGateways: process.env.DEBUG ? 0 : 1,
            subnetConfiguration: [
                {
                    subnetType: process.env.DEBUG
                        ? SubnetType.PUBLIC
                        : SubnetType.PRIVATE_WITH_NAT,
                    name: "private-subnet",
                    cidrMask: 24,
                },
                {
                    subnetType: SubnetType.PUBLIC,
                    name: "public-subnet",
                    cidrMask: 24,
                },
            ],
        });

        // Create code build project
        new Project(this, "codebuild", {
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    build: {
                        commands: [
                            "apt update -y",
                            "export VERSION=$(date +\\%Y\\%m\\%d\\%H\\%M\\%S)",
                            "git clone https://github.com/mrcyclo/aws-cdk.git .",

                            "cd web",
                            "aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 903969887945.dkr.ecr.ap-southeast-1.amazonaws.com",
                            "docker build -t laravel .",
                            "docker tag laravel:latest 903969887945.dkr.ecr.ap-southeast-1.amazonaws.com/laravel:$VERSION",
                            "docker push 903969887945.dkr.ecr.ap-southeast-1.amazonaws.com/laravel:$VERSION",
                            "docker rmi 903969887945.dkr.ecr.ap-southeast-1.amazonaws.com/laravel:$VERSION",
                            "docker rmi laravel:latest",
                            "cd ..",

                            "cd cdk",
                            "npm i -g aws-cdk",
                            "npm install",
                            "export WEBSYSTEM_STACK_NAME=websystem-stack-$VERSION",
                            "export IMAGE_TAG=903969887945.dkr.ecr.ap-southeast-1.amazonaws.com/laravel:$VERSION",
                            "cdk deploy websystem-stack --require-approval never",
                        ],
                    },
                },
            }),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_5_0,
                privileged: true,
            },
            environmentVariables: {
                DEBUG: { value: process.env.DEBUG },

                AWS_DEFAULT_REGION: { value: process.env.AWS_DEFAULT_REGION },

                CDK_DEFAULT_ACCOUNT: { value: process.env.CDK_DEFAULT_ACCOUNT },
                CDK_DEFAULT_REGION: { value: process.env.CDK_DEFAULT_REGION },
            },
            projectName: "websystem-build",
            role: new Role(this, "codebuild-role", {
                assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
                inlinePolicies: {
                    "codebuild-policies": new PolicyDocument({
                        statements: [
                            new PolicyStatement({
                                actions: [
                                    "ssm:GetParameters",
                                    "sts:AssumeRole",
                                    "cloudformation:*",
                                    "iam:*",
                                    "elasticloadbalancing:*",
                                    "ecr:*",
                                    "ecs:*",
                                ],
                                resources: ["*"],
                            }),
                        ],
                    }),
                },
            }),
        });
    }
}
