import { AmazonLinuxGeneration, AmazonLinuxImage, Instance, InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup, SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import * as cdk from "@aws-cdk/core";

export class TrainingStack extends cdk.Stack {
    public vpc: Vpc;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create VPC
        this.vpc = new Vpc(this, "vpc", {
            cidr: "11.0.0.0/16",
            maxAzs: 2,
            natGateways: 0,
            subnetConfiguration: [
                // {
                //     subnetType: SubnetType.PRIVATE_WITH_NAT,
                //     name: "private-subnet",
                //     cidrMask: 24,
                // },
                {
                    subnetType: SubnetType.PUBLIC,
                    name: "public-subnet",
                    cidrMask: 24,
                },
            ],
        });

        // Create Security Group
        const bastionSg = new SecurityGroup(this, 'bastion-sg', {
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        bastionSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

        const elbSg = new SecurityGroup(this, 'elb-sg', {
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        elbSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        const webserverSg = new SecurityGroup(this, 'webserver-sg', {
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        webserverSg.connections.allowFrom(bastionSg, Port.tcp(22));
        webserverSg.connections.allowFrom(elbSg, Port.tcp(80));

        // Create EC2 Instance
        new Instance(this, 'bastion', {
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
            },
            instanceType: InstanceType.of(
                InstanceClass.T2,
                InstanceSize.MICRO,
            ),
            machineImage: new AmazonLinuxImage({
                generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
            }),
            securityGroup: bastionSg,
            keyName: 'ec2-key-pair',
        });
    }
}
