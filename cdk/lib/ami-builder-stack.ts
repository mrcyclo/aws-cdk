import {
    AmazonLinuxGeneration,
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    MachineImage,
    SecurityGroup,
    SubnetType,
    Vpc
} from "@aws-cdk/aws-ec2";
import * as cdk from "@aws-cdk/core";
import { readFileSync } from "fs";
import * as path from "path";

interface AmiBuilderStackProps extends cdk.StackProps {
    vpc: Vpc;
    bastionSg: SecurityGroup;
}

export class AmiBuilderStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: AmiBuilderStackProps) {
        super(scope, id, props);

        // Import VPC
        const vpc = props.vpc;

        // Import bastion sg
        const bastionSg = props.bastionSg;

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

        const userDataScript = readFileSync(
            path.join(__dirname, "ami-user-data.sh"),
            "utf8"
        );
        webInstance.addUserData(userDataScript);

        // Create an Output
        new cdk.CfnOutput(this, "web-instance-id", {
            value: webInstance.instanceId,
            exportName: "webInstanceId",
        });
    }
}
