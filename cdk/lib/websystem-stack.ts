import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { Repository } from "@aws-cdk/aws-ecr";
import { Cluster, ContainerImage } from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "@aws-cdk/aws-ecs-patterns";
import {
    ApplicationLoadBalancer,
    ApplicationProtocol
} from "@aws-cdk/aws-elasticloadbalancingv2";
import { HostedZone } from "@aws-cdk/aws-route53";
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

        // Create ALB Service
        const imageTag = <string>process.env.VERSION;
        const albService = new ApplicationLoadBalancedFargateService(
            this,
            "alb-service",
            {
                cluster,
                loadBalancer: alb,
                desiredCount: 1,
                certificate: Certificate.fromCertificateArn(
                    this,
                    "cert",
                    "arn:aws:acm:ap-southeast-1:903969887945:certificate/4a614376-9c78-4b5c-90c4-6eb5d9b40987"
                ),
                listenerPort: 443,
                protocol: ApplicationProtocol.HTTPS,
                targetProtocol: ApplicationProtocol.HTTP,
                redirectHTTP: true,
                publicLoadBalancer: true,
                assignPublicIp: true,
                taskImageOptions: {
                    image: ContainerImage.fromEcrRepository(
                        Repository.fromRepositoryName(
                            this,
                            "laravel",
                            "laravel"
                        ),
                        imageTag
                    ),
                    containerPort: 80,
                },
                taskSubnets: {
                    subnetType: process.env.DEBUG
                        ? SubnetType.PUBLIC
                        : SubnetType.PRIVATE_WITH_NAT,
                },
                securityGroups: [webInstanceSg],
            }
        );

        // Setup autoscaling
        const scalableTarget = albService.service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 5,
        });

        scalableTarget.scaleOnRequestCount("request-count-scale", {
            requestsPerTarget: 1,
            targetGroup: albService.targetGroup,
            scaleInCooldown: Duration.seconds(60),
            scaleOutCooldown: Duration.seconds(60),
        });
    }
}
