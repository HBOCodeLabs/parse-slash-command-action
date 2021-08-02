// Copyright (c) WarnerMedia Direct, LLC. All rights reserved. Licensed under the MIT license.
// See the LICENSE file for license information.

const core = require('@actions/core');
const github = require('@actions/github');
const YAML = require('js-yaml');

const action = {
    async main() {
        const token = core.getInput('repo-token', { required: true });
        const configPath = core.getInput('configuration-path') || '.github/slash-commands.yaml'

        const octokit = github.getOctokit(token);
        const config = await action.getConfig(octokit, configPath);
        const comment = github.context.payload.comment.body;
        const args = String(comment).trim().split(/ +/);

        core.info(`Using config: ${JSON.stringify(config, undefined, 2)}`);
        core.info(`Parsing comment: ${comment}`);

        // Add in the implied forward slash for the first layer of commands. This makes
        // it easier to parse and format error messages later.
        for (let command of config.commands) {
            command.name = `/${command.name}`;
        }

        let commands = config.commands;
        let consumed = [];
        let result;

        for (let arg of args) {
            consumed.push(arg);

            let command = commands.find(command => command.name === arg);
            if (!command) break;

            if (command.result) {
                result = command.result;
            }

            if (command.commands) {
                commands = command.commands;
            }
        }

        core.info(result);

        if (result) {
            core.info(`Success: ${JSON.stringify(result)}`);
            core.setOutput('result', JSON.stringify(result));
            core.setOutput('reaction', 'rocket');
        } else {
            let failed = consumed.join(' ');
            let options = commands.map(command => command.name).join(', ');
            let suggest = consumed.slice(0, -1).concat(`[${options}]`).join(' ');
            let error = `> Unknown command \`${failed}\` - try one of \`${suggest}\``;
            core.info(`Failed: ${error}`);
            core.setOutput('result', '{}');
            core.setOutput('message', error);
            core.setOutput('reaction', 'confused');
        }
    },
    async getConfig(octokit, configPath) {
        let params = {
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: configPath,
            ref: github.context.sha
        };
        core.info(`Retrieve: ${JSON.stringify(params)}`);

        const response = await octokit.repos.getContent({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: configPath,
            ref: github.context.sha
        });
        const text = Buffer.from(response.data.content, response.data.encoding).toString();

        return YAML.load(text);
    }
};

module.exports = action;

/* istanbul ignore if */
if (require.main === module) {
    // If this file is the entry point for node, run main() immediately.
    // Unexpected errors are passed back to GitHub as failures.
    action.main().catch(error => core.setFailed(error));
}
