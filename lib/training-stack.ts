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
    public bastionSg: SecurityGroup;

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

        // Create bastion sg
        this.bastionSg = new SecurityGroup(this, "bastion-sg", {
            vpc: this.vpc,
            allowAllOutbound: true,
            securityGroupName: "bastion-sg",
        });
        this.bastionSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

        // Create bastion instance
        new Instance(this, "bastion", {
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
            },
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: MachineImage.latestAmazonLinux({
                generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
            }),
            securityGroup: this.bastionSg,
            keyName: "ec2-key-pair",
            instanceName: "bastion",
        });

        // Create code build project
        new Project(this, "codebuild", {
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    install: {
                        commands: [
                            "apt update -y",
                            "apt install -y git nodejs",
                            "npm i -g aws-cdk",
                        ],
                    },
                    build: {
                        commands: [
                            "export VERSION=$(date +\\%Y\\%m\\%d\\%H\\%M\\%S)",
                            "git clone https://github.com/mrcyclo/aws-cdk.git .",
                            "npm install",
                            "cdk deploy ami-builder-stack --require-approval never",
                            `export INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name ami-builder-stack --output text --query="Stacks[0].Outputs[?OutputKey=='webinstanceid'].OutputValue")`,
                            "export AMI_NAME=web-ami-$VERSION",
                            `export AMI_ID=$(aws ec2 create-image --instance-id $INSTANCE_ID --name $AMI_NAME --output text)`,
                            "aws ec2 wait image-available --image-ids $AMI_ID",
                            "cdk destroy ami-builder-stack --force",
                            "export WEBSYSTEM_STACK_NAME=websystem-stack-$VERSION",
                            "cdk deploy websystem-stack --require-approval never",
                        ],
                    },
                },
            }),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_5_0,
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
                    "codebuild-policy": new PolicyDocument({
                        statements: [
                            new PolicyStatement({
                                actions: [
                                    "ec2:*",
                                    "cloudformation:*",
                                    "autoscaling:*",
                                    "elasticloadbalancing:*",
                                    "ssm:GetParameters",
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
