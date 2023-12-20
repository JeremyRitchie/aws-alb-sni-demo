import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { SNIBaseStack } from './base';
import { SNIECSStack } from './ecs';


export interface SNIALBStackProps extends StackProps {
    baseStack: SNIBaseStack;
    ecsStack: SNIECSStack;
}

export class SNIALBStack extends Stack {
  constructor(scope: Construct, id: string, props: SNIALBStackProps) {
    super(scope, id, props);

    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
        vpc: props.baseStack.vpc,
        internetFacing: true,
    });

    const redTargetGroup = new elbv2.ApplicationTargetGroup(this, 'RedTargetGroup', {
        vpc: props.baseStack.vpc,
        port: 8080,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        targets: [props.ecsStack.service],
    });

    props.ecsStack.service.connections.allowFrom(alb, ec2.Port.tcp(8080));

   const blueTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BlueTargetGroup', {
        vpc: props.baseStack.vpc,
        port: 8081,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        targets: [props.ecsStack.service],
    });

    props.ecsStack.service.connections.allowFrom(alb, ec2.Port.tcp(8081));

    const https = alb.addListener('Listener', {
        port: 443,
        certificates: [props.baseStack.redCert, props.baseStack.blueCert],
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
        zone: props.baseStack.hostedZone,
        target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb)),
        recordName: 'blue',
    });

    new route53.ARecord(this, 'RedRecord', {
        zone: props.baseStack.hostedZone,
        target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb)),
        recordName: 'red',
    });

  }
}