import {
    AmazonLinuxGeneration,
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    MachineImage,
    SecurityGroup,
    SubnetType,
    UserData,
    Vpc
} from "@aws-cdk/aws-ec2";
import * as cdk from "@aws-cdk/core";

export class AmiBuilderStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpcId = <string>process.env.VPC_ID;
        const bastionSgId = <string>process.env.BASTION_SG_ID;

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

        // Create web instance
        const userData = UserData.forLinux();
        userData.addCommands(
            "sudo -i",
            "yum install -y httpd",
            "systemctl start httpd",
            "systemctl enable httpd",
            'echo "<h1>Hello World!</h1>" > /var/www/html/index.html'
        );

        const webInstance = new Instance(this, "web-instance", {
            vpc,
            vpcSubnets: {
                subnetType: process.env.DEBUG
                    ? SubnetType.PUBLIC
                    : SubnetType.PRIVATE_WITH_NAT,
            },
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: MachineImage.latestAmazonLinux({
                generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
            }),
            securityGroup: bastionSg,
            keyName: "ec2-key-pair",
            userData,
        });

        // Create an Output
        new cdk.CfnOutput(this, "web-instance-id", {
            value: webInstance.instanceId,
            exportName: "webInstanceId",
        });
    }
}
