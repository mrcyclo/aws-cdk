import {
    AmazonLinuxGeneration,
    AmazonLinuxImage,
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    Peer,
    Port,
    SecurityGroup,
    SubnetType,
    UserData,
    Vpc,
} from "@aws-cdk/aws-ec2";
import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import { InstanceIdTarget } from "@aws-cdk/aws-elasticloadbalancingv2-targets";
import * as cdk from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";

export class TrainingStack extends cdk.Stack {
    public vpc: Vpc;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create VPC
        this.vpc = new Vpc(this, "vpc", {
            cidr: "13.0.0.0/16",
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                {
                    subnetType: SubnetType.PRIVATE_WITH_NAT,
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

        // Create Security Group
        const bastionSg = new SecurityGroup(this, "bastion-sg", {
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        bastionSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

        const elbSg = new SecurityGroup(this, "elb-sg", {
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        elbSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        const webserverSg = new SecurityGroup(this, "webserver-sg", {
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        webserverSg.connections.allowFrom(bastionSg, Port.tcp(22));
        webserverSg.connections.allowFrom(elbSg, Port.tcp(80));

        // Create EC2 Instance
        new Instance(this, "bastion", {
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
            },
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: new AmazonLinuxImage({
                generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
            }),
            securityGroup: bastionSg,
            keyName: "ec2-key-pair",
        });

        const userData = UserData.forLinux();
        userData.addCommands(
            "sudo -i",
            "yum install -y httpd",
            "systemctl start httpd",
            "systemctl enable httpd",
            'echo "<h1>Hello World!</h1>" > /var/www/html/index.html'
        );

        const webserverEc2 = new Instance(this, "webserver", {
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_NAT,
            },
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: new AmazonLinuxImage({
                generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
            }),
            securityGroup: webserverSg,
            keyName: "ec2-key-pair",
            userData,
        });

        // Create Application Load Balancer
        const alb = new ApplicationLoadBalancer(this, "alb", {
            vpc: this.vpc,
            internetFacing: true,
            securityGroup: elbSg,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
            },
        });
        const listener = alb.addListener("alb-listener", {
            port: 80,
        });
        listener.addTargets("alb-listener-target", {
            port: 80,
            targets: [new InstanceIdTarget(webserverEc2.instanceId)],
            stickinessCookieDuration: Duration.days(1),
            healthCheck: {
                healthyHttpCodes: "200",
                path: "/",
            },
        });
    }
}
