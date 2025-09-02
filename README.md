# SQS consumer using undici

[![NPM version](https://img.shields.io/npm/v/@fgiova/sqs-consumer.svg?style=flat)](https://www.npmjs.com/package/@fgiova/sqs-consumer)
![CI workflow](https://github.com/fgiova/sqs-consumer/actions/workflows/node.js.yml/badge.svg)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![Maintainability](https://qlty.sh/gh/fgiova/projects/sqs-consumer/maintainability.svg)](https://qlty.sh/gh/fgiova/projects/sqs-consumer)
[![Code Coverage](https://qlty.sh/gh/fgiova/projects/sqs-consumer/coverage.svg)](https://qlty.sh/gh/fgiova/projects/sqs-consumer)

## Description
This module allows consuming SQS messages using @fgiova/mini-sqs-client thorough the aws-json protocol with "undici" as http agent .<br />
The @fgiova/aws-signature module is used for signing requests to optimize performance. <br />

## Installation
```bash
npm install @fgiova/sqs-consumer
```
## Usage

```typescript
import {SQSConsumer} from '@fgiova/sqs-consumer'

const consumer = new SQSConsumer({
    queueARN: "arn:aws:sqs:eu-central-1:000000000000:test-queue-hooks",
    handler: async (message) => {
        console.log(message.Body);
    }
});

```

## Options
| Option          | Type                                | Default | Description                                        |
|-----------------|-------------------------------------|---------|----------------------------------------------------|
| queueARN        | string                              |         | The ARN of the queue to consume                    |
| handler         | (message: Message) => Promise<void> |         | The handler function to be called for each message |
| logger          | Logger                              | console | The logger to be used                              |
| autoStart       | boolean                             | true    | Whether to start the consumer automatically        |
| handlerOptions  | HandlerOptions                      |         | The options for the handler                        |
| clientOptions   | ClientOptions                       |         | The options for the client                         |
| consumerOptions | ConsumerOptions                     |         | The options for the consumer                       |
| hooks           | Hooks                               |         | The hooks to be called on specific events          |

### HandlerOptions
| Option            | Type    | Default | Description                                                                                              |
|-------------------|---------|---------|----------------------------------------------------------------------------------------------------------|
| deleteMessage     | boolean | true    | Whether to delete the message after handling (if handler execute without any error)                      |
| extendVisibility  | boolean | true    | Whether to extend the visibility timeout during message handling                                         |
| excuteTimeout     | number  | 30000   | The timeout for the handler execution in ms                                                              |
| parallelExecution | boolean | true    | If true execute handler in parallel for each batch of messages received, otherwise execute consecutively |

### ClientOptions
| Option           | Type                   | Default | Description                                                                                               |
|------------------|------------------------|---------|-----------------------------------------------------------------------------------------------------------|
| sqsClient        | MiniSQSClient          |         | The MiniSQSClient client to be used. If not provided, a new client will be created using the queueARN.    |
| endpoint         | string                 |         | The endpoint to be used for the client. If not provided, the endpoint will be inferred from the queueARN. |
| undiciOptions    | Pool.Options           |         | The options for the undici client.                                                                        |
| signer           | Signer / SignerOptions |         | The signer to be used for signing requests. If not provided, a new singleton signer will be created.      |
| destroySigner    | boolean                | false   | Whether to destroy the signer when the consumer is destroyed.                                             |

### ConsumerOptions
| Option                  | Type     | Default | Description                                                |
|-------------------------|----------|---------|------------------------------------------------------------|
| visibilityTimeout       | number   | 30      | The visibility timeout for the messages in seconds         |
| waitTimeSeconds         | number   | 20      | The wait time for the receiveMessage call in seconds       |
| itemsPerRequest         | number   | 10      | The maximum number of messages to be received at once      |
| messageAttributeNames   | string[] | []      | The message attribute names to be included in the response |

### Hooks
| Option           | Type                                                                  | Description                                                          |
|------------------|-----------------------------------------------------------------------|----------------------------------------------------------------------|
| onPoll           | (messages: Message[]) => Promise<Message[]>                           | Called when the consumer polls for messages                          |
| onMessage        | (message: Message) => Promise<Message>                                | Called when the consumer receives a message                          |
| onHandle         | (message: Message) => Promise<Message>                                | Called when the consumer handles a message                           |
| onHandlerSuccess | (message: Message) => Promise<Message>                                | Called when the consumer handles a message successfully              |
| onHandlerTimeout | (message: Message) => Promise<Message>                                | Called when the consumer handler execution exceed executionTimeout   |
| onHandlerError   | (message: Message, error: Error) => Promise<Boolean>                  | Called when the consumer handler execution throws an error           |
| onSuccess        | (message: Message) => Promise<Message>                                | Called when the consumer handler execution finishes successfully     |
| onError          | ( hook: HookName, message: Message, error: Error) => Promise<Boolean> | Called when the consumer handler execution throws an uncaught error  |
| onSQSError       | (error: Error, message?: Message) => Promise<void>                    | Called when the consumer receives an error from the SQS service      |

## API

```typescript
SQSConsumer(options: SQSConsumerOptions)
SQSConsumer.start(): Promise<void>
SQSConsumer.stop(destroyConsumer = false): Promise<void>
SQSConsumer.addHook(hookname: string, func: Function): void
```

## License
Licensed under [MIT](./LICENSE).
