import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { SecurityGroup, SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { Repository } from "@aws-cdk/aws-ecr";
import { Cluster, ContainerImage } from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "@aws-cdk/aws-ecs-patterns";
import {
    ApplicationLoadBalancer,
    ApplicationProtocol,
} from "@aws-cdk/aws-elasticloadbalancingv2";
import * as cdk from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";

interface WebSystemStackProps extends cdk.StackProps {
    vpc: Vpc;
    alb: ApplicationLoadBalancer;
    albSg: SecurityGroup;
    cluster: Cluster;
    webInstanceSg: SecurityGroup;
    ecr: Repository;
}

export class WebSystemStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: WebSystemStackProps) {
        super(scope, id, props);

        const imageTag = <string>process.env.IMAGE_TAG;

        // Create ALB Service
        const albService = new ApplicationLoadBalancedFargateService(
            this,
            "alb-service",
            {
                cluster: props.cluster,
                loadBalancer: props.alb,
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
                            "LaravelImage",
                            props.ecr.repositoryName
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
                securityGroups: [props.webInstanceSg],
                serviceName: "alb-service",
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
