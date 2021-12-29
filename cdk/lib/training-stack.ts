import { BuildSpec, LinuxBuildImage, Project } from "@aws-cdk/aws-codebuild";
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { Repository } from "@aws-cdk/aws-ecr";
import { Cluster } from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import {
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from "@aws-cdk/aws-iam";
import * as cdk from "@aws-cdk/core";

export class TrainingStack extends cdk.Stack {
    public readonly vpc: Vpc;
    public readonly alb: ApplicationLoadBalancer;
    public readonly albSg: SecurityGroup;
    public readonly cluster: Cluster;
    public readonly webInstanceSg: SecurityGroup;
    public readonly ecr: Repository;

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

        // Create Alb sg
        this.albSg = new SecurityGroup(this, "alb-sg", {
            vpc: this.vpc,
            allowAllOutbound: true,
            securityGroupName: "alb-sg",
        });
        this.albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        // Create Application Load Balancer
        this.alb = new ApplicationLoadBalancer(this, "alb", {
            vpc: this.vpc,
            internetFacing: true,
            securityGroup: this.albSg,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
                onePerAz: true,
            },
            loadBalancerName: "alb",
        });

        // Create cluster
        this.cluster = new Cluster(this, "cluster", {
            vpc: this.vpc,
            clusterName: "cluster",
        });

        // Create web instance sg
        this.webInstanceSg = new SecurityGroup(this, "web-instance-sg", {
            vpc: this.vpc,
            allowAllOutbound: true,
            securityGroupName: "web-instance-sg",
        });
        this.webInstanceSg.connections.allowFrom(this.albSg, Port.tcp(80));

        // Create ECR
        this.ecr = new Repository(this, "Repository", {
            repositoryName: "laravel-image",
        });

        // Create code build project
        new Project(this, "codebuild", {
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    build: {
                        commands: [
                            "apt update -y",
                            "git clone https://github.com/mrcyclo/aws-cdk.git .",

                            `
                            if [ -z "$IMAGE_TAG" ]
                            then
                                export IMAGE_TAG=$(date +\\%Y\\%m\\%d\\%H\\%M\\%S)
                                cd web
                                aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin ${this.ecr.repositoryUri}
                                docker build --build-arg IMAGE_TAG -t laravel .
                                docker tag laravel:latest ${this.ecr.repositoryUri}:$IMAGE_TAG
                                docker push ${this.ecr.repositoryUri}:$IMAGE_TAG
                                docker rmi ${this.ecr.repositoryUri}:$IMAGE_TAG
                                docker rmi laravel:latest
                                cd ..
                            fi
                            `,

                            "cd cdk",
                            "npm i -g aws-cdk",
                            "npm install",
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

                IMAGE_TAG: { value: "" },
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
                                    "ec2:*",
                                    "elasticloadbalancing:*",
                                    "application-autoscaling:*",
                                    "ecr:*",
                                    "ecs:*",
                                    "logs:*",
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
