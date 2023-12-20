import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import path = require('path');

import { SNIBaseStack } from './base';


export interface SNIECSStackProps extends StackProps {
    baseStack: SNIBaseStack;
}

export class SNIECSStack extends Stack {
  service: ecs.FargateService;
  constructor(scope: Construct, id: string, props: SNIECSStackProps) {
    super(scope, id, props);
    // create ecs cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
        vpc: props.baseStack.vpc,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
        memoryLimitMiB: 512,
        cpu: 256,
        runtimePlatform: {
            operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
            cpuArchitecture: ecs.CpuArchitecture.ARM64,
        }
    });

    taskDefinition.executionRole?.attachInlinePolicy(new iam.Policy(this, 'userpool-policy', {
        statements: [new iam.PolicyStatement({
            actions: [
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: ['*'],
        })],
      }));

    taskDefinition.addContainer('BlueContainer', {
        image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../../blue')),
        memoryLimitMiB: 256,
        cpu: 128,
        portMappings: [{ containerPort: 8081, hostPort: 8081 }],
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'blue' }),
        entryPoint: ['/docker-entrypoint.sh'],
        command: ['nginx', '-g', 'daemon off;'],
    });

    taskDefinition.addContainer('RedContainer', {
        image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../../red')),
        memoryLimitMiB: 256,
        cpu: 128,
        portMappings: [{ containerPort: 8080, hostPort: 8080 }],
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'red' }),
        entryPoint: ['/docker-entrypoint.sh'],
        command: ['nginx', '-g', 'daemon off;'],
    });

    this.service = new ecs.FargateService(this, 'Service', {
        cluster: cluster,
        taskDefinition: taskDefinition,
        desiredCount: 1,
        assignPublicIp: true,
    });
  }
}