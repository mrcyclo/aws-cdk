import { BuildSpec, LinuxBuildImage, Project } from "@aws-cdk/aws-codebuild";
import {
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
import * as cdk from "@aws-cdk/core";
import moment = require("moment");

export class TrainingStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create VPC
        const vpc = new Vpc(this, "vpc", {
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
        const bastionSg = new SecurityGroup(this, "bastion-sg", {
            vpc,
            allowAllOutbound: true,
            securityGroupName: "bastion-sg",
        });
        bastionSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

        // Create bastion instance
        new Instance(this, "bastion", {
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
            },
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: MachineImage.latestAmazonLinux(),
            securityGroup: bastionSg,
            keyName: "ec2-key-pair",
            instanceName: "bastion",
        });

        // Create code build project
        const version = moment.utc().format("YYYYMMDDHHmmss");
        const webAmiName = `web-ami-${version}`;
        new Project(this, "codebuild", {
            vpc,
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    install: {
                        commands: [
                            "yum install -y git curl unzip",
                            "mkdir /tmp",
                            "cd /tmp",
                            `curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"`,
                            "unzip awscliv2.zip",
                            "./aws/install",
                            "curl -sL https://rpm.nodesource.com/setup_14.x | bash && yum install -y nodejs",
                            "npm i -g aws-cdk",
                        ],
                    },
                    build: {
                        commands: [
                            "git clone https://github.com/mrcyclo/aws-cdk.git .",
                            "npm install",
                            "cdk deploy ami-builder-stack --require-approval never",
                            `export INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name ami-builder-stack --output text --query="Stacks[0].Outputs[?OutputKey=='webinstanceid'].OutputValue")`,
                            `export AMI_ID=$(aws ec2 create-image --instance-id $INSTANCE_ID --name $AMI_NAME --output text)`,
                            "aws ec2 wait image-available --image-ids $AMI_ID",
                            "cdk destroy ami-builder-stack --force",
                            "cdk deploy websystem-stack --require-approval never",
                        ],
                    },
                },
            }),
            environment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2,
            },
            environmentVariables: {
                DEBUG: { value: process.env.DEBUG },

                VPC_ID: { value: vpc.vpcId },
                BASTION_SG_ID: { value: bastionSg.securityGroupId },
                AMI_NAME: { value: webAmiName },

                AWS_ACCESS_KEY_ID: { value: process.env.AWS_ACCESS_KEY_ID },
                AWS_SECRET_ACCESS_KEY: {
                    value: process.env.AWS_SECRET_ACCESS_KEY,
                },
                AWS_DEFAULT_REGION: { value: process.env.AWS_DEFAULT_REGION },

                CDK_DEFAULT_ACCOUNT: { value: process.env.CDK_DEFAULT_ACCOUNT },
                CDK_DEFAULT_REGION: { value: process.env.CDK_DEFAULT_REGION },
            },
            projectName: "websystem-build",
        });
    }
}
