#!/usr/bin/env node

import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
import { AmiBuilderStack } from "../lib/ami-builder-stack";
import { CodeBuildStack } from "../lib/codebuild-stack";
import { TrainingStack } from "../lib/training-stack";

const app = new cdk.App();

switch (process.env.APP_ENV) {
    case "local":
        new TrainingStack(app, "training-stack");
        break;

    case "codebuild":
        new CodeBuildStack(app, "codebuild-stack");
        new AmiBuilderStack(app, "ami-builder-stack");
        break;
}
