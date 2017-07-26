'use strict';

// http://docs.aws.amazon.com/codepipeline/latest/userguide/actions-invoke-lambda-function.html
// http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingAWSSDK.html
// https://nodejs.org/dist/latest-v6.x/docs/api/fs.html
// https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options

var aws = require('aws-sdk');

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var s3 = new S3(context);
    var codepipeline = new CodePipeline(context);

    var job = event["CodePipeline.job"];

    return Promise.resolve({ job: job })
        .then(data => {
            var defaults = {
                accountName: 'sandbox',
                bucketName: '',
                objectKey: ''
            };
            data.params = Object.assign(defaults, getEnvParameters(process.env), getUserParameters(data.job));
            return data;
        })
        .then(data => s3.pull(getInputArtifactS3Path(data.job))
            .then(archive => (data.archive = archive, data)))
        .then(data => unzip(data.archive.Body)
            .then(artifacts => (data.version = getVersion(artifacts), data)))
        .then(data => {
            if (canPush(data.params['accountName'], data.version)) {
                console.log('Pushing to the ' + data.params['accountName'] + ' account.')
                return s3.push(data.params['bucketName'], data.params['objectKey'], data.archive.Body);
            } else {
                console.log('Skip pushing to the ' + data.params['accountName'] + ' account.')
            }
        })
        .then(() => codepipeline.succeed(job), error => codepipeline.fail(job, error))
        .then(response => context.succeed(response), error => context.fail(error));
};

function S3(context) {
    var s3 = new aws.S3({ maxRetries: 3, signatureVersion: 'v4' });
    return {
        pull: function(path) {
            return s3.getObject(path).promise();
        },
        push: function(bucketName, objectKey, body) {
            if (!bucketName || !objectKey) {
                return Promise.reject(new Error('The bucketName or objectKey data are not defined in userParameters.'))
            }
            var params = {
                Bucket: bucketName,
                Key: objectKey,
                Body: body,
                ACL: 'bucket-owner-full-control'
            };
            return s3.putObject(params).promise();
        }
    }
}

function CodePipeline(context) {
    var codepipeline = new aws.CodePipeline();
    return {
        succeed: function(job) {
            console.log('Success');
            var params = {
                jobId: job.id
            };
            return codepipeline.putJobSuccessResult(params).promise();
        },
        fail: function(job, error) {
            console.log('Failure:', error);
            var params = {
                jobId: job.id,
                failureDetails: {
                    type: 'JobFailed',
                    message: JSON.stringify(error.message || error),
                    externalExecutionId: context.invokeid
                }
            };
            return codepipeline.putJobFailureResult(params).promise();
        }
    };
}

function getEnvParameters(env) {
    var params = {};
    if (env['GITPIPELINE_ACCOUNT']) {
        params.accountName = env['GITPIPELINE_ACCOUNT'];
    }
    if (env['GITPIPELINE_S3BUCKET']) {
        params.bucketName = env['GITPIPELINE_S3BUCKET'];
    }
    if (env['GITPIPELINE_S3KEY']) {
        params.objectKey = env['GITPIPELINE_S3KEY'];
    }
    return params;
}

function getUserParameters(job) {
    var querystring = require('querystring');
    var params = querystring.parse(job["data"]["actionConfiguration"]["configuration"]["UserParameters"]);
    return params;
}

function getInputArtifactS3Path(job) {
    var artifact = job.data.inputArtifacts[0];
    if (artifact['location']['type'] === 'S3') {
        return {
            Bucket: artifact['location']['s3Location']['bucketName'],
            Key: artifact['location']['s3Location']['objectKey']
        };
    } else {
        throw new Error('Could not handle the artifact of ' + artifact['location']['type'] + ' type.');
    }
}

function unzip(buffer) {
    var fs = require('fs');
    var tmp = fs.mkdtempSync('/tmp/artifact-');
    var dst = tmp + '/artifacts';
    fs.writeFileSync(tmp + '/s3.zip', buffer);
    return new Promise(function(resolve, reject) {
        var spawn = require('child_process').spawn;
        var unzip = spawn('unzip', ['-o', tmp + '/s3.zip', '-d', dst]);
        unzip.stderr.on('data', (data) => {
            var message = data.toString('ascii');
            console.log('unzip error:', message);
            reject(new Error(message));
        });
        unzip.on('close', (code) => {
            if (code === 0) {
                resolve(dst);
            } else {
                console.log('unzip exited with code ' + code);
                reject(new Error('unzip exited with code ' + code));
            }
        });
    });
}

function getVersion(path) {
    var version = '';
    try {
        var fs = require('fs');
        version = fs.readFileSync(path + '/VERSION', 'utf8');
        console.log('VERSION:', version);
    } catch (error) {
        console.log('Could not resolve the version.', error);
    }
    return version;
}

function canPush(accountName, version) {
    var result = false;
    var release = /^\d+\.\d+\.\d+$/i.test(version); // e.g. 1.5.0
    var candidate = /^\d+\.\d+\.\d+\+\d+$/i.test(version); // e.g. 1.5.1+3
    switch (accountName.toLocaleLowerCase()) {
        case 'acc':
        case 'accp':
        case 'acceptance':
        case 'nonprod':
            {
                result = release || candidate;
                break;
            }
        case 'prod':
        case 'production':
            {
                result = release;
                break;
            }
    }
    return result;
}