import { Peer, Port, SecurityGroup, SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { Repository } from "@aws-cdk/aws-ecr";
import {
    Cluster,
    Compatibility,
    ContainerImage,
    FargateService,
    ListenerConfig,
    TaskDefinition
} from "@aws-cdk/aws-ecs";
import {
    ApplicationLoadBalancer,
    ApplicationProtocol,
    ListenerAction,
    ListenerCertificate
} from "@aws-cdk/aws-elasticloadbalancingv2";
import * as cdk from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";
import moment = require("moment");

interface WebSystemStackProps extends cdk.StackProps {
    vpc: Vpc;
}

export class WebSystemStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: WebSystemStackProps) {
        super(scope, id, props);

        const webAmiName = <string>process.env.AMI_NAME;

        // Import VPC
        const vpc = props.vpc;

        // Create cluster
        const cluster = new Cluster(this, "cluster", {
            vpc,
        });

        // Create Task Definition
        const taskDefinition = new TaskDefinition(this, "task-definition", {
            memoryMiB: "512",
            cpu: "256",
            compatibility: Compatibility.FARGATE,
        });

        // Add container to Task Definition
        const imageTag = <string>process.env.VERSION;
        const containerDefinition = taskDefinition.addContainer("container", {
            containerName: "laravel",
            image: ContainerImage.fromEcrRepository(
                Repository.fromRepositoryName(this, "laravel", "laravel"),
                imageTag
            ),
            portMappings: [
                {
                    containerPort: 80,
                },
            ],
        });

        // Create Alb sg
        const albSg = new SecurityGroup(this, "alb-sg", {
            vpc,
            allowAllOutbound: true,
        });
        albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        // Create web instance sg
        const webInstanceSg = new SecurityGroup(this, "web-instance-sg", {
            vpc,
            allowAllOutbound: true,
        });
        webInstanceSg.connections.allowFrom(albSg, Port.tcp(80));

        // Create Application Load Balancer
        const alb = new ApplicationLoadBalancer(this, "alb", {
            vpc: vpc,
            internetFacing: true,
            securityGroup: albSg,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
                onePerAz: true,
            },
        });

        // Redirect http to https
        const httpListener = alb.addListener("http", {
            port: 80,
        });

        httpListener.addAction("redirect-to-https", {
            action: ListenerAction.redirect({
                protocol: ApplicationProtocol.HTTPS,
                port: "443",
            }),
        });

        // Default listener
        const httpsListener = alb.addListener("https", {
            port: 443,
            certificates: [
                ListenerCertificate.fromArn(
                    "arn:aws:acm:ap-southeast-1:903969887945:certificate/4a614376-9c78-4b5c-90c4-6eb5d9b40987"
                ),
            ],
        });

        // Create Service
        const service = new FargateService(this, "service", {
            cluster,
            taskDefinition,
            vpcSubnets: {
                subnetType: process.env.DEBUG
                    ? SubnetType.PUBLIC
                    : SubnetType.PRIVATE_WITH_NAT,
            },
            securityGroups: [webInstanceSg],
            assignPublicIp: true,
        });

        service.registerLoadBalancerTargets({
            containerName: containerDefinition.containerName,
            containerPort: 80,
            newTargetGroupId: "ECS",
            listener: ListenerConfig.applicationListener(httpsListener, {
                protocol: ApplicationProtocol.HTTPS,
                stickinessCookieDuration: Duration.days(1),
            }),
        });
    }
}
