#!/usr/bin/env node

import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
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
    vpc: trainingStack.vpc,
    alb: trainingStack.alb,
    albSg: trainingStack.albSg,
    cluster: trainingStack.cluster,
    webInstanceSg: trainingStack.webInstanceSg,
});
