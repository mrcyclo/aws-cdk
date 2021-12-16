#!/usr/bin/env node

import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
import { AmiBuilderStack } from "../lib/ami-builder-stack";
import { TrainingStack } from "../lib/training-stack";
import { WebSystemStack } from "../lib/websystem-stack";

const app = new cdk.App();

const trainingStack = new TrainingStack(app, "training-stack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});

new WebSystemStack(app, "websystem-stack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
    stackName: process.env.WEBSYSTEM_STACK_NAME,
    vpc: trainingStack.vpc,
    bastionSg: trainingStack.bastionSg,
});

new AmiBuilderStack(app, "ami-builder-stack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
    vpc: trainingStack.vpc,
    bastionSg: trainingStack.bastionSg,
});
