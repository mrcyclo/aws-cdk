#!/usr/bin/env node

import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
import { AmiBuilderStack } from "../lib/ami-builder-stack";
import { WebSystemStack } from "../lib/websystem-stack";
import { TrainingStack } from "../lib/training-stack";

const app = new cdk.App();

new TrainingStack(app, "training-stack", {
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
});

new AmiBuilderStack(app, "ami-builder-stack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});
