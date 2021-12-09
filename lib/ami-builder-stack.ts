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
import { readFileSync } from "fs";
import * as path from "path";

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
        });

        const userDataScript = readFileSync(path.join(__dirname, "ami-user-data.sh"), 'utf8');
        webInstance.addUserData(userDataScript);

        // Create an Output
        new cdk.CfnOutput(this, "web-instance-id", {
            value: webInstance.instanceId,
            exportName: "webInstanceId",
        });
    }
}
