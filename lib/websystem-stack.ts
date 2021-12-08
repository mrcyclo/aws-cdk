import { AutoScalingGroup } from "@aws-cdk/aws-autoscaling";
import {
    InstanceClass,
    InstanceSize,
    InstanceType,
    MachineImage,
    Peer,
    Port,
    SecurityGroup,
    SubnetType,
    Vpc,
} from "@aws-cdk/aws-ec2";
import {
    ApplicationLoadBalancer,
    ApplicationProtocol,
    ListenerAction,
    ListenerCertificate,
} from "@aws-cdk/aws-elasticloadbalancingv2";
import { ARecord, PublicHostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import { LoadBalancerTarget } from "@aws-cdk/aws-route53-targets";
import * as cdk from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";

export class WebSystemStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpcId = <string>process.env.VPC_ID;
        const bastionSgId = <string>process.env.BASTION_SG_ID;
        const webAmiName = <string>process.env.AMI_NAME;

        // Import VPC
        const vpc = Vpc.fromLookup(this, "vpc", {
            vpcId,
        });

        // Import bastion sg
        const bastionSg = SecurityGroup.fromLookupById(
            this,
            "bastion-sg",
            bastionSgId
        );

        // Create Alb sg
        const albSg = new SecurityGroup(this, "alb-sg", {
            vpc,
            allowAllOutbound: true,
            securityGroupName: "alb-sg",
        });
        albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        // Create web instance sg
        const webInstanceSg = new SecurityGroup(this, "web-instance-sg", {
            vpc,
            allowAllOutbound: true,
            securityGroupName: "web-instance-sg",
        });
        webInstanceSg.connections.allowFrom(bastionSg, Port.tcp(22));
        webInstanceSg.connections.allowFrom(albSg, Port.tcp(80));

        // Create Auto Scaling Group
        const asg = new AutoScalingGroup(this, "asg", {
            vpc: vpc,
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: MachineImage.lookup({
                name: webAmiName,
            }),
            securityGroup: webInstanceSg,
            minCapacity: 1,
            maxCapacity: 2,
            keyName: "ec2-key-pair",
        });

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

        httpsListener.addTargets("https-target", {
            port: 80,
            targets: [asg],
            stickinessCookieDuration: Duration.days(1),
            healthCheck: {
                healthyHttpCodes: "200",
                path: "/",
            },
        });

        // Set up dynamic scaling policy
        asg.scaleOnRequestCount("request-count-scale", {
            targetRequestsPerMinute: 1,
            estimatedInstanceWarmup: Duration.seconds(10),
            cooldown: Duration.seconds(10),
        });

        // Change setting of Route53
        const hostedZone = PublicHostedZone.fromPublicHostedZoneId(
            this,
            "hosted-zone",
            "Z1006312LKA67UQB22AD"
        );
        new ARecord(this, "a-record", {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
        });
    }
}
