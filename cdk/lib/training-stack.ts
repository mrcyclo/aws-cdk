import { BuildSpec, LinuxBuildImage, Project } from "@aws-cdk/aws-codebuild";
import { Repository as CodecommitRepository } from "@aws-cdk/aws-codecommit";
import { Artifact, Pipeline } from "@aws-cdk/aws-codepipeline";
import {
    CodeBuildAction,
    CodeCommitSourceAction,
} from "@aws-cdk/aws-codepipeline-actions";
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { Repository as EcrRepository } from "@aws-cdk/aws-ecr";
import { Cluster } from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import {
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from "@aws-cdk/aws-iam";
import * as cdk from "@aws-cdk/core";

export class TrainingStack extends cdk.Stack {
    public readonly vpc: Vpc;
    public readonly alb: ApplicationLoadBalancer;
    public readonly albSg: SecurityGroup;
    public readonly cluster: Cluster;
    public readonly webInstanceSg: SecurityGroup;
    public readonly ecr: EcrRepository;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const githubOAuthToken = <string>process.env.GITHUB_OAUTH_TOKEN;

        // Create VPC
        this.vpc = new Vpc(this, "Vpc", {
            cidr: "13.0.0.0/16",
            maxAzs: 2,
            natGateways: process.env.DEBUG ? 0 : 1,
            subnetConfiguration: [
                {
                    subnetType: process.env.DEBUG
                        ? SubnetType.PUBLIC
                        : SubnetType.PRIVATE_WITH_NAT,
                    name: "PrivateSubnet",
                    cidrMask: 24,
                },
                {
                    subnetType: SubnetType.PUBLIC,
                    name: "PublicSubnet",
                    cidrMask: 24,
                },
            ],
        });

        // Create Alb sg
        this.albSg = new SecurityGroup(this, "AlbSg", {
            vpc: this.vpc,
            allowAllOutbound: true,
            securityGroupName: "AlbSg",
        });
        this.albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        // Create Application Load Balancer
        this.alb = new ApplicationLoadBalancer(this, "Alb", {
            vpc: this.vpc,
            internetFacing: true,
            securityGroup: this.albSg,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
                onePerAz: true,
            },
            loadBalancerName: "Alb",
        });

        // Create cluster
        this.cluster = new Cluster(this, "Cluster", {
            vpc: this.vpc,
            clusterName: "Cluster",
        });

        // Create web instance sg
        this.webInstanceSg = new SecurityGroup(this, "WebInstanceSg", {
            vpc: this.vpc,
            allowAllOutbound: true,
            securityGroupName: "WebInstanceSg",
        });
        this.webInstanceSg.connections.allowFrom(this.albSg, Port.tcp(80));

        // Create ECR
        this.ecr = new EcrRepository(this, "Repository", {
            repositoryName: "laravel-image-repository",
        });

        // Create code build project
        const codebuild = new Project(this, "Codebuild", {
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    build: {
                        commands: [
                            "apt update -y",
                            "export SOURCE_DIR=$(pwd)",
                            "mkdir /my-cdk",
                            "cd /my-cdk",
                            "git clone https://github.com/mrcyclo/aws-cdk.git .",

                            `
                            if [ -z "$IMAGE_TAG" ]
                            then
                                export REPOSITORY_URI=$(aws cloudformation describe-stacks --stack-name training-stack --output text --query="Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue")
                                export IMAGE_TAG=$(date +\\%Y\\%m\\%d\\%H\\%M\\%S)
                                cd web
                                cp -a $SOURCE_DIR/. src
                                aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $REPOSITORY_URI
                                docker build -t laravel .
                                docker tag laravel:latest $REPOSITORY_URI:$IMAGE_TAG
                                docker push $REPOSITORY_URI:$IMAGE_TAG
                                docker rmi $REPOSITORY_URI:$IMAGE_TAG
                                docker rmi laravel:latest
                                cd ..
                            fi
                            `,

                            "cd cdk",
                            "npm i -g aws-cdk",
                            "npm install",
                            "cdk deploy websystem-stack --require-approval never",
                        ],
                    },
                },
            }),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_5_0,
                privileged: true,
            },
            environmentVariables: {
                DEBUG: { value: process.env.DEBUG },

                AWS_DEFAULT_REGION: { value: process.env.AWS_DEFAULT_REGION },

                CDK_DEFAULT_ACCOUNT: { value: process.env.CDK_DEFAULT_ACCOUNT },
                CDK_DEFAULT_REGION: { value: process.env.CDK_DEFAULT_REGION },

                IMAGE_TAG: { value: "" },
            },
            projectName: "WebsystemBuild",
            role: new Role(this, "CodebuildRole", {
                assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
                inlinePolicies: {
                    CodebuildPolicies: new PolicyDocument({
                        statements: [
                            new PolicyStatement({
                                actions: [
                                    "ssm:GetParameters",
                                    "sts:AssumeRole",
                                    "cloudformation:*",
                                    "iam:*",
                                    "ec2:*",
                                    "elasticloadbalancing:*",
                                    "application-autoscaling:*",
                                    "ecr:*",
                                    "ecs:*",
                                    "logs:*",
                                ],
                                resources: ["*"],
                            }),
                        ],
                    }),
                },
            }),
        });

        // Create CodePipeline
        const sourceOutput = new Artifact();

        new Pipeline(this, "GitPushMaster", {
            pipelineName: "GitPushMaster",
            crossAccountKeys: false,
            enableKeyRotation: false,
            stages: [
                {
                    stageName: "Source",
                    actions: [
                        new CodeCommitSourceAction({
                            actionName: "CodeCommitSource",
                            repository: CodecommitRepository.fromRepositoryName(
                                this,
                                "LaravelRepo",
                                "laravel-repo"
                            ),
                            branch: "master",
                            output: sourceOutput,
                            codeBuildCloneOutput: true,
                        }),
                    ],
                },
                {
                    stageName: "CodeBuild",
                    actions: [
                        new CodeBuildAction({
                            actionName: "CodeBuild",
                            input: sourceOutput,
                            project: codebuild,
                        }),
                    ],
                },
            ],
        });

        // 👇 create an Output
        new cdk.CfnOutput(this, "RepositoryUri", {
            value: this.ecr.repositoryUri,
            exportName: "RepositoryUri",
        });
    }
}
