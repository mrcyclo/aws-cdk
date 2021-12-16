#!/usr/bin/env node

import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
import { AmiBuilderStack } from "../lib/ami-builder-stack";
import { TrainingStack } from "../lib/training-stack";
import { WebSystemStack } from "../lib/websystem-stack";

const app = new cdk.App();

const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
};

const trainingStack = new TrainingStack(app, "training-stack", {
    env,
});

new WebSystemStack(app, "websystem-stack", {
    env,
    stackName: process.env.WEBSYSTEM_STACK_NAME,
    vpc: trainingStack.vpc,
});

new AmiBuilderStack(app, "ami-builder-stack", {
    env,
    vpc: trainingStack.vpc,
});
