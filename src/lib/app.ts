import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import path = require('path');



export interface SNIApplicationStackProps extends StackProps {
}

export class SNIApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props: SNIApplicationStackProps) {
    super(scope, id, props);

    // import hosted zone
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: 'jeremyritchie.com',
    });

    // create two acm certs
    const redCert = new acm.Certificate(this, 'Certificate1', {
        domainName: 'red.jeremyritchie.com',
        validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const blueCert = new acm.Certificate(this, 'Certificate2', {
        domainName: 'blue.jeremyritchie.com',
        validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // create one vpc
    const vpc = new ec2.Vpc(this, 'VPC', {
        maxAzs: 2,
        createInternetGateway: true,
        subnetConfiguration: [
            {
                name: 'public',
                subnetType: ec2.SubnetType.PUBLIC,
            },
        ],
        natGateways: 0,
    })

    // create ecs cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
        vpc: vpc,
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
        portMappings: [{ containerPort: 80, hostPort: 80 }],
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'blue' }),
    });

    taskDefinition.addContainer('RedContainer', {
        image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../../red')),
        memoryLimitMiB: 256,
        cpu: 128,
        portMappings: [{ containerPort: 8080, hostPort: 8080 }],
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'red' }),
    });

    const service = new ecs.FargateService(this, 'Service', {
        cluster: cluster,
        taskDefinition: taskDefinition,
        desiredCount: 0,
        assignPublicIp: true,
    });


    // create alb with one listener, one target group, one rule
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
        vpc: vpc,
        internetFacing: true,
    });

    const redTargetGroup = new elbv2.ApplicationTargetGroup(this, 'RedTargetGroup', {
        vpc: vpc,
        port: 8080,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        targets: [service],
    });

   const blueTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BlueTargetGroup', {
        vpc: vpc,
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        targets: [service],
    });

    const https = alb.addListener('Listener', {
        port: 443,
        certificates: [redCert, blueCert],
        protocol: elbv2.ApplicationProtocol.HTTPS,
        defaultAction: elbv2.ListenerAction.fixedResponse(404, {
            contentType: "text/plain",
            messageBody: 'Not Found',
        }),
    });

    alb.addListener('HTTP', {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.redirect({
            protocol: 'HTTPS',
            port: '443',
        }),
    });

    new elbv2.ApplicationListenerRule(this, 'BlueRule', {
        listener: https,
        priority: 1,
        conditions: [
            elbv2.ListenerCondition.hostHeaders(['blue.jeremyritchie.com']),
        ],
        action: elbv2.ListenerAction.forward([blueTargetGroup]),
    });

    new elbv2.ApplicationListenerRule(this, 'RedRule', {
        listener: https,
        priority: 2,
        conditions: [
            elbv2.ListenerCondition.hostHeaders(['red.jeremyritchie.com']),
        ],
        action: elbv2.ListenerAction.forward([redTargetGroup]),
    });

    // create route53 records
    new route53.ARecord(this, 'BlueRecord', {
        zone: hostedZone,
        target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb)),
        recordName: 'blue',
    });

    new route53.ARecord(this, 'RedRecord', {
        zone: hostedZone,
        target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb)),
        recordName: 'red',
    });

  }
}