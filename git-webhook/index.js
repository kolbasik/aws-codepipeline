'use strict';

// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CodeBuild.html#startBuild-property

var AWS = require('aws-sdk');
var codebuild = new AWS.CodeBuild();

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const done = (error, data) => {
        if (error) {
            console.log('Error:', JSON.stringify(error, null, 2));
        } else {
            console.log('Success:', JSON.stringify(data, null, 2));
        }

        callback(null, {
            statusCode: error ? '400' : '200',
            body: error ? error.message : JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    };

    try {
        if (event.httpMethod !== "POST") {
            return done(new Error('It only accepts POST request.'));
        }
        var body = JSON.parse(event.body);
        console.log('Received body:', JSON.stringify(body, null, 2));

        if (body.deleted) {
            return done(null, { message: '[SKIP] the git branch is deleted' });
        }
        if (!body.base_ref && !body.ref) {
            return done(null, { message: "[SKIP] it's not a commit." });
        }
        var buildParams = {
            projectName: event.queryStringParameters.projectName || body.repository.name,
            sourceVersion: (body.base_ref || body.ref).substr(11)
        };
        console.log('Build parameters:', JSON.stringify(buildParams, null, 2))
        codebuild.startBuild(buildParams, done);
    } catch (error) {
        done(error, null);
    }
};