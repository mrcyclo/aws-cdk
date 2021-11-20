#!/usr/bin/env node

import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { TrainingStack } from "../lib/training-stack";

const app = new cdk.App();

new TrainingStack(app, "training-stack");
